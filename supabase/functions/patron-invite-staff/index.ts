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
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
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

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
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
    const { p_email, p_password, p_role, p_nom, p_prenom } = await req.json()

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
    const userExists = existingUser.users.some(u => u.email === p_email)
    
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
      console.error('Error updating profile:', updateError)
      // User was created, just log the error
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
    return new Response(JSON.stringify({ error: 'Erreur serveur interne' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
