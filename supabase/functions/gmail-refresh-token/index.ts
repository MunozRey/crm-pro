import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify calling user holds a valid Supabase session
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
    )
    const { data: { user }, error: authErr } = await callerClient.auth.getUser()
    if (authErr || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Read the stored refresh token for this user (admin client bypasses RLS for server reads)
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: tokenRow, error: fetchErr } = await adminClient
      .from('gmail_tokens')
      .select('refresh_token, email_address')
      .eq('user_id', user.id)
      .single()

    if (fetchErr || !tokenRow) {
      return new Response(
        JSON.stringify({ error: 'No Gmail connection found for this user' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Refresh the access token at Google's token endpoint
    const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: tokenRow.refresh_token,
        client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
        client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
        grant_type: 'refresh_token',
      }),
    })

    if (!refreshRes.ok) {
      const errBody = await refreshRes.json().catch(() => ({}))
      // 400 with error=invalid_grant means refresh token was revoked by user
      return new Response(
        JSON.stringify({ error: errBody.error_description ?? 'Token refresh failed', code: errBody.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const refreshed = await refreshRes.json() as {
      access_token: string
      expires_in: number
      scope: string
      token_type: string
    }

    // Return ONLY the new short-lived access token — refresh token stays in the DB
    return new Response(
      JSON.stringify({
        access_token: refreshed.access_token,
        expires_in: refreshed.expires_in,
        email_address: tokenRow.email_address,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
