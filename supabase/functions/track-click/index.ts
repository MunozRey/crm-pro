import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const adminClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const url = new URL(req.url)
  const token = url.searchParams.get('token') ?? ''
  if (!token) return new Response('Missing token', { status: 400, headers: corsHeaders })

  try {
    const { data: link } = await adminClient
      .from('email_tracking_links')
      .select('id,tracking_message_id,email_id,organization_id,contact_id,user_id,original_url')
      .eq('click_token', token)
      .maybeSingle()

    if (!link) {
      return new Response('Tracking link not found', { status: 404, headers: corsHeaders })
    }

    const userAgent = req.headers.get('user-agent') ?? ''
    const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('cf-connecting-ip') ?? ''
    const ipHash = ip ? await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip)).then((buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')) : null

    await adminClient
      .from('email_tracking_events')
      .insert({
        tracking_message_id: link.tracking_message_id,
        link_id: link.id,
        email_id: link.email_id,
        organization_id: link.organization_id,
        user_id: link.user_id,
        contact_id: link.contact_id,
        event_type: 'click',
        user_agent: userAgent || null,
        ip_hash: ipHash,
      })

    return Response.redirect(link.original_url, 302)
  } catch {
    return new Response('Unable to process tracking link', { status: 500, headers: corsHeaders })
  }
})
