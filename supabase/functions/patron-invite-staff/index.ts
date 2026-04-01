import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(supabaseUrl, serviceRoleKey)

// CORS headers for all responses
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
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Verify the caller is a patron
    const token = authHeader.replace('Bearer ', '')
    
    // Use getUser to verify the token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError) {
      console.error('Auth error:', authError.message)
    }
    
    if (!user) {
      // Try to get user from jwt directly (fallback)
      return new Response(JSON.stringify({ error: 'Invalid token or token expired. Please reconnect.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get caller's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('Profile error:', profileError.message)
    }
    
    if (!profile) {
      return new Response(JSON.stringify({ error: 'Profile not found for this user' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Verify caller is patron
    if (profile.role !== 'patron') {
      return new Response(JSON.stringify({ error: 'Accès refusé. Seul le patron peut inviter des membres du personnel.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Verify establishment
    if (!profile.etablissement_id) {
      return new Response(JSON.stringify({ error: 'Votre compte n\'est lié à aucun établissement.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get request body
    const body = await req.json()
    const { p_email, p_password, p_role, p_nom, p_prenom } = body

    // Validate required fields
    if (!p_email || !p_password || !p_role || !p_nom || !p_prenom) {
      return new Response(JSON.stringify({ error: 'Tous les champs sont requis.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Validate role
    if (!['serveuse', 'comptoir', 'gerant'].includes(p_role)) {
      return new Response(JSON.stringify({ error: 'Rôle invalide. Les rôles autorisés sont: serveuse, comptoir, gerant' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check if user already exists
    const { data: existingUser } = await supabase.auth.admin.listUsers()
    const userExists = existingUser.users.some((u: any) => u.email === p_email)
    
    if (userExists) {
      return new Response(JSON.stringify({ error: 'Un utilisateur avec cet email existe déjà.' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Create user with service role (bypasses RLS)
    const { data: newUser, error: createUserError } = await supabase.auth.admin.createUser({
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

    if (createUserError) {
      console.error('Error creating user:', createUserError)
      return new Response(JSON.stringify({ error: createUserError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!newUser.user) {
      return new Response(JSON.stringify({ error: 'Erreur lors de la création de l\'utilisateur' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Update profile with etablissement_id
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        role: p_role,
        nom: p_nom,
        prenom: p_prenom,
        etablissement_id: profile.etablissement_id,
        actif: true
      })
      .eq('id', newUser.user.id)

    if (updateError) {
      console.error('Error updating profile:', updateError.message)
    }

    return new Response(JSON.stringify({ 
      success: true, 
      user_id: newUser.user.id,
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
