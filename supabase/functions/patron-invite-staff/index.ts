// Simple Edge Function for patron to invite staff
// Uses the built-in Supabase client

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

    // Get the SUPABASE_URL and SERVICE_ROLE_KEY from environment
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Missing environment variables' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get request body
    const body = await req.json()
    const { p_email, p_password, p_role, p_nom, p_prenom, p_user_id } = body

    // Validate required fields
    if (!p_user_id) {
      return new Response(JSON.stringify({ error: 'User ID required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

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

    // Use fetch to call Supabase Auth Admin API directly
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
          prenom: p_prenom
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

    // Now update the profile in the public schema
    // Use fetch to call Supabase directly
    const profileResponse = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${newUserId}`, {
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
        actif: true
      })
    })

    if (!profileResponse.ok) {
      console.error('Profile update error:', await profileResponse.text())
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
