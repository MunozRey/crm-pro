import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TRANSPARENT_GIF_BASE64 = 'R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='

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
    const { data: trackingMessage } = await adminClient
      .from('email_tracking_messages')
      .select('id,email_id,organization_id,contact_id,user_id')
      .eq('open_token', token)
      .maybeSingle()

    if (!trackingMessage) {
      return new Response(Uint8Array.from(atob(TRANSPARENT_GIF_BASE64), (c) => c.charCodeAt(0)), {
        headers: { ...corsHeaders, 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' },
      })
    }

    const userAgent = req.headers.get('user-agent') ?? ''
    const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('cf-connecting-ip') ?? ''
    const ipHash = ip ? await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip)).then((buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')) : null

    await adminClient
      .from('email_tracking_events')
      .insert({
        tracking_message_id: trackingMessage.id,
        email_id: trackingMessage.email_id,
        organization_id: trackingMessage.organization_id,
        user_id: trackingMessage.user_id,
        contact_id: trackingMessage.contact_id,
        event_type: 'open',
        user_agent: userAgent || null,
        ip_hash: ipHash,
      })

    return new Response(Uint8Array.from(atob(TRANSPARENT_GIF_BASE64), (c) => c.charCodeAt(0)), {
      headers: { ...corsHeaders, 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' },
    })
  } catch {
    return new Response(Uint8Array.from(atob(TRANSPARENT_GIF_BASE64), (c) => c.charCodeAt(0)), {
      headers: { ...corsHeaders, 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' },
    })
  }
})
