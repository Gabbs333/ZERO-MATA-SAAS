// Simple Edge Function for patron to invite staff
// With API key verification

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

console.log('Function starting...')

Deno.serve(async (req) => {
  console.log('Request received:', req.method)
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request')
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Get environment variables and API key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY')
    const anonKey = req.headers.get('apikey') // Supabase passes this automatically
    
    console.log('Environment check:', { 
      hasUrl: !!supabaseUrl, 
      hasKey: !!serviceRoleKey,
      hasAnonKey: !!anonKey
    })

    if (!supabaseUrl || !serviceRoleKey) {
      const error = 'Missing environment variables'
      console.error(error)
      return new Response(JSON.stringify({ error }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check authorization - either from header or apikey
    const authHeader = req.headers.get('Authorization')
    console.log('Has auth header:', !!authHeader)
    
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required - please login' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get request body
    let body
    try {
      body = await req.json()
      console.log('Request body received')
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    const { p_email, p_password, p_role, p_nom, p_prenom } = body

    // Validate input
    if (!p_email || !p_password || !p_role || !p_nom || !p_prenom) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Extract user from JWT
    const token = authHeader.replace('Bearer ', '')
    const parts = token.split('.')
    let userId = null
    
    if (parts.length === 3) {
      try {
        const payload = JSON.parse(atob(parts[1]))
        userId = payload.sub
        console.log('User ID from token:', userId)
      } catch (e) {
        console.error('Failed to decode token:', e)
      }
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Invalid token format' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Create user via Auth Admin API
    console.log('Creating user with email:', p_email)
    
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
    console.log('Auth response status:', authResponse.status)

    if (!authResponse.ok || authResult.error) {
      console.error('Auth error:', authResult)
      return new Response(JSON.stringify({ error: authResult.error?.message || 'Failed to create user' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('User created:', authResult.id)

    return new Response(JSON.stringify({ 
      success: true, 
      user_id: authResult.id,
      message: 'Staff member created successfully'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
