import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { leadId, createDeal } = await req.json() as { leadId: string; createDeal?: boolean }
    if (!leadId) {
      return new Response(JSON.stringify({ error: 'leadId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    )
    const { data: { user: caller }, error: callerErr } = await callerClient.auth.getUser()
    if (callerErr || !caller) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: lead, error: leadErr } = await adminClient
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single()
    if (leadErr || !lead) {
      return new Response(JSON.stringify({ error: 'Lead not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const orgId = lead.organization_id as string

    const { data: membership } = await adminClient
      .from('organization_members')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', caller.id)
      .single()
    if (!membership) {
      return new Response(JSON.stringify({ error: 'Not a member of this organization' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let companyId: string | null = null
    const companyName = (lead.company_name as string | null)?.trim()
    if (companyName) {
      const { data: existingCompany } = await adminClient
        .from('companies')
        .select('id')
        .eq('organization_id', orgId)
        .ilike('name', companyName)
        .maybeSingle()

      if (existingCompany?.id) {
        companyId = existingCompany.id
      } else {
        const { data: company, error: companyErr } = await adminClient
          .from('companies')
          .insert({
            organization_id: orgId,
            name: companyName,
            status: 'prospect',
            tags: lead.tags ?? [],
            notes: lead.notes ?? null,
            created_by: caller.id,
          })
          .select('id')
          .single()
        if (companyErr) throw companyErr
        companyId = company.id
      }
    }

    const { data: contact, error: contactErr } = await adminClient
      .from('contacts')
      .insert({
        organization_id: orgId,
        first_name: lead.first_name,
        last_name: lead.last_name,
        email: lead.email,
        phone: lead.phone ?? null,
        job_title: lead.job_title ?? null,
        company_id: companyId,
        status: 'prospect',
        source: lead.source ?? 'other',
        tags: lead.tags ?? [],
        notes: lead.notes ?? null,
        assigned_to: lead.assigned_to ?? caller.id,
        created_by: caller.id,
      })
      .select('id')
      .single()
    if (contactErr) throw contactErr

    let dealId: string | null = null
    if (createDeal) {
      const { data: deal, error: dealErr } = await adminClient
        .from('deals')
        .insert({
          organization_id: orgId,
          title: `${lead.first_name} ${lead.last_name} - New Opportunity`,
          stage: 'lead',
          probability: 10,
          value: 0,
          source: lead.source ?? 'other',
          contact_id: contact.id,
          company_id: companyId,
          assigned_to: lead.assigned_to ?? caller.id,
          created_by: caller.id,
        })
        .select('id')
        .single()
      if (dealErr) throw dealErr
      dealId = deal.id
    }

    const { error: updateLeadErr } = await adminClient
      .from('leads')
      .update({
        status: 'converted',
        lifecycle_stage: 'customer',
        converted_contact_id: contact.id,
        converted_company_id: companyId,
        converted_deal_id: dealId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', leadId)
    if (updateLeadErr) throw updateLeadErr

    return new Response(JSON.stringify({
      success: true,
      contactId: contact.id,
      companyId,
      dealId,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
