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
    const { email, role, organizationId } = await req.json() as {
      email: string
      role: string
      organizationId: string
    }

    if (!email || !role || !organizationId) {
      return new Response(
        JSON.stringify({ error: 'email, role, and organizationId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Caller-auth client: verifies the requester holds a valid session
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } }
    )

    const { data: { user: callerUser }, error: callerErr } = await callerClient.auth.getUser()
    if (callerErr || !callerUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Admin (service role) client: performs privileged DB + Auth operations
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Verify caller is admin or manager in the given org
    const { data: membership, error: memberErr } = await adminClient
      .from('organization_members')
      .select('role')
      .eq('user_id', callerUser.id)
      .eq('organization_id', organizationId)
      .single()

    if (memberErr || !membership) {
      return new Response(
        JSON.stringify({ error: 'Caller is not a member of this organization' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!['admin', 'manager'].includes(membership.role)) {
      return new Response(
        JSON.stringify({ error: 'Only admins and managers can invite members' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Send invitation email via Supabase Auth admin API
    const { error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: {
        role,
        organization_id: organizationId,
      },
    })

    if (inviteErr) {
      return new Response(
        JSON.stringify({ error: inviteErr.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Write pending invitation row for UI tracking and acceptance flow
    const { data: invitation, error: insertErr } = await adminClient
      .from('invitations')
      .insert({
        organization_id: organizationId,
        email,
        role,
        invited_by: callerUser.id,
        status: 'pending',
      })
      .select()
      .single()

    if (insertErr) {
      return new Response(
        JSON.stringify({ error: insertErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, invitationId: invitation.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
