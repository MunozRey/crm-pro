import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'yahoo.com',
  'icloud.com',
  'proton.me',
  'protonmail.com',
])

function domainFromEmail(email: string): string | null {
  const at = email.lastIndexOf('@')
  if (at <= 0 || at === email.length - 1) return null
  return email.slice(at + 1).trim().toLowerCase()
}

function orgNameFromDomain(domain: string): string {
  const base = domain.split('.')[0] ?? 'Organization'
  return base.charAt(0).toUpperCase() + base.slice(1)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user }, error: userError } = await anonClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Already mapped to an org -> nothing to do.
    const { data: existingMember } = await adminClient
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    if (existingMember?.organization_id) {
      return new Response(
        JSON.stringify({ status: 'already_member', organizationId: existingMember.organization_id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const email = user.email ?? ''
    const domain = domainFromEmail(email)
    if (!domain) {
      return new Response(JSON.stringify({ error: 'Invalid user email domain' }), { status: 400, headers: corsHeaders })
    }

    const fallbackOrgName = user.user_metadata?.org_name?.trim() || orgNameFromDomain(domain)

    // If domain is already registered, do not auto-join.
    const { data: domainHit, error: domainError } = await adminClient
      .from('organization_domains')
      .select('organization_id, organizations(name)')
      .eq('domain', domain)
      .maybeSingle()

    if (domainError) throw new Error(domainError.message)

    if (domainHit?.organization_id) {
      await adminClient
        .from('organization_join_requests')
        .upsert({
          organization_id: domainHit.organization_id,
          email,
          user_id: user.id,
          domain,
          status: 'pending',
        }, { onConflict: 'organization_id,email' })

      return new Response(
        JSON.stringify({
          status: 'requires_invitation',
          organizationId: domainHit.organization_id,
          organizationName: domainHit.organizations?.name ?? null,
          domain,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Personal email domains still get a tenant, but no domain auto-association.
    const shouldRegisterDomain = !FREE_EMAIL_DOMAINS.has(domain)

    const { data: org, error: orgErr } = await adminClient
      .from('organizations')
      .insert({
        name: fallbackOrgName,
        domain: shouldRegisterDomain ? domain : null,
      })
      .select()
      .single()
    if (orgErr) throw new Error(orgErr.message)

    const { error: memberErr } = await adminClient
      .from('organization_members')
      .insert({
        organization_id: org.id,
        user_id: user.id,
        role: 'admin',
      })
    if (memberErr) throw new Error(memberErr.message)

    if (shouldRegisterDomain) {
      await adminClient
        .from('organization_domains')
        .upsert({
          organization_id: org.id,
          domain,
          is_verified: false,
        }, { onConflict: 'domain' })
    }

    await adminClient.rpc('set_claim', { uid: user.id, claim: 'organization_id', value: `"${org.id}"` })
    await adminClient.rpc('set_claim', { uid: user.id, claim: 'user_role', value: '"admin"' })

    return new Response(
      JSON.stringify({ status: 'created', organizationId: org.id, organizationName: org.name }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
