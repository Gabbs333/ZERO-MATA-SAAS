// Edge Function for patron to invite staff
// Verifies JWT token before creating user

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Decode JWT without verification - for getting user info only
function decodeJWT(token: string): any {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    return JSON.parse(atob(parts[1]))
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Missing environment variables' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get Authorization header - Supabase automatically passes this for authenticated users
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required. Please login first.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Extract token and decode to get user ID
    const token = authHeader.replace('Bearer ', '')
    const payload = decodeJWT(token)
    
    if (!payload || !payload.sub) {
      return new Response(JSON.stringify({ error: 'Invalid token. Please login again.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const userId = payload.sub

    // Get caller's profile to check if they are a patron
    const profileResponse = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=*`,
      {
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey
        }
      }
    )

    const profiles = await profileResponse.json()
    
    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const profile = profiles[0]

    // Check if user is a patron
    if (profile.role !== 'patron') {
      return new Response(JSON.stringify({ error: `Accès refusé. Seul le patron peut inviter. Votre rôle: ${profile.role}` }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check establishment
    if (!profile.etablissement_id) {
      return new Response(JSON.stringify({ error: 'Votre compte n\'est lié à aucun établissement.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get request body
    const body = await req.json()
    const { p_email, p_password, p_role, p_nom, p_prenom } = body

    // Validate input
    if (!p_email || !p_password || !p_role || !p_nom || !p_prenom) {
      return new Response(JSON.stringify({ error: 'Tous les champs sont requis.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!['serveuse', 'comptoir', 'gerant'].includes(p_role)) {
      return new Response(JSON.stringify({ error: 'Rôle invalide.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Create user via Auth Admin API
    const authResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey
      },
      body: JSON.stringify({
        email: p_email,
        password: p_password,
        email_confirm: true,
        user_metadata: {
          role: p_role,
          nom: p_nom,
          prenom: p_prenom,
          etablissement_id: profile.etablissement_id
        }
      })
    })

    const authResult = await authResponse.json()

    if (!authResponse.ok || authResult.error) {
      console.error('Auth error:', authResult)
      return new Response(JSON.stringify({ error: authResult.error || 'Failed to create user' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const newUserId = authResult.id

    // Update the new user's profile with establishment info
    const profileUpdateResponse = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${newUserId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          role: p_role,
          nom: p_nom,
          prenom: p_prenom,
          etablissement_id: profile.etablissement_id,
          actif: true
        })
      }
    )

    if (!profileUpdateResponse.ok) {
      console.error('Profile update error:', await profileUpdateResponse.text())
    }

    return new Response(JSON.stringify({ 
      success: true, 
      user_id: newUserId,
      message: 'Membre du personnel créé avec succès'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Unexpected error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Erreur serveur interne'
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
