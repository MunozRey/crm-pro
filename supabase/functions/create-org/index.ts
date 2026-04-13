import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // Build admin client first (used for all privileged operations).
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Verify the user is authenticated
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Validate JWT using service role (more robust than anon client forwarding).
    const { data: { user }, error: userError } = await adminClient.auth.getUser(token)
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { orgName, slug } = await req.json()
    if (!orgName || !slug) {
      return new Response(
        JSON.stringify({ error: 'orgName and slug are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // 1. Prevent duplicate slug/domain
    const normalizedSlug = slug.trim().toLowerCase()
    if (!/^[a-z0-9-]+$/.test(normalizedSlug)) {
      return new Response(
        JSON.stringify({ error: 'Slug can only contain lowercase letters, numbers and hyphens' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
    const { data: existingOrg, error: existsErr } = await adminClient
      .from('organizations')
      .select('id')
      .ilike('domain', normalizedSlug)
      .maybeSingle()
    if (existsErr) throw new Error(existsErr.message)
    if (existingOrg) {
      return new Response(
        JSON.stringify({ error: 'This organization slug is already in use' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Create organization
    const { data: org, error: orgErr } = await adminClient
      .from('organizations')
      .insert({ name: orgName.trim(), domain: normalizedSlug })
      .select()
      .single()
    if (orgErr) {
      const status = orgErr.code === '23505' ? 409 : 500
      return new Response(
        JSON.stringify({ error: orgErr.message }),
        { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // 3. Add user as admin member
    const { error: memberErr } = await adminClient
      .from('organization_members')
      .insert({ organization_id: org.id, user_id: user.id, role: 'admin' })
    if (memberErr) {
      return new Response(
        JSON.stringify({ error: memberErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // 3b. Register domain in canonical tenant-domain table
    const { error: domainErr } = await adminClient
      .from('organization_domains')
      .upsert({
        organization_id: org.id,
        domain: normalizedSlug,
        is_verified: false,
      }, { onConflict: 'domain' })
    if (domainErr) {
      return new Response(
        JSON.stringify({ error: domainErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // 4. Set JWT claims
    const { error: claimOrgErr } = await adminClient.rpc('set_claim', { uid: user.id, claim: 'organization_id', value: `"${org.id}"` })
    if (claimOrgErr) {
      return new Response(
        JSON.stringify({ error: claimOrgErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
    const { error: claimRoleErr } = await adminClient.rpc('set_claim', { uid: user.id, claim: 'user_role', value: '"admin"' })
    if (claimRoleErr) {
      return new Response(
        JSON.stringify({ error: claimRoleErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    return new Response(JSON.stringify({ org }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
