import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // Verify the user is authenticated
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })

    // Use anon client to verify the JWT
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: userError } = await anonClient.auth.getUser()
    if (userError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })

    const { orgName, slug } = await req.json()
    if (!orgName || !slug) return new Response(JSON.stringify({ error: 'orgName and slug are required' }), { status: 400, headers: corsHeaders })

    // Use service role to bypass RLS
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 1. Create organization
    const { data: org, error: orgErr } = await adminClient
      .from('organizations')
      .insert({ name: orgName.trim(), domain: slug.trim() })
      .select()
      .single()
    if (orgErr) throw new Error(orgErr.message)

    // 2. Add user as admin member
    const { error: memberErr } = await adminClient
      .from('organization_members')
      .insert({ organization_id: org.id, user_id: user.id, role: 'admin' })
    if (memberErr) throw new Error(memberErr.message)

    // 3. Set JWT claims
    await adminClient.rpc('set_claim', { uid: user.id, claim: 'organization_id', value: `"${org.id}"` })
    await adminClient.rpc('set_claim', { uid: user.id, claim: 'user_role', value: '"admin"' })

    return new Response(JSON.stringify({ org }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: corsHeaders })
  }
})
