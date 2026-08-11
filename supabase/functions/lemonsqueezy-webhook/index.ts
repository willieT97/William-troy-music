// ============================================================
//  Music Arcade — Lemon Squeezy webhook  →  entitlements
//  Supabase Edge Function (Deno). Turns a verified purchase into a
//  row in the `entitlements` table (service role → bypasses RLS).
//
//  Deploy:  supabase functions deploy lemonsqueezy-webhook --no-verify-jwt
//  Secret:  supabase secrets set LEMONSQUEEZY_SIGNING_SECRET=whsec_...
//  (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are injected automatically.)
//
//  In Lemon Squeezy: Settings → Webhooks → add
//     https://<project-ref>.supabase.co/functions/v1/lemonsqueezy-webhook
//  with the SAME signing secret, subscribed to order + subscription events.
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ---- EDIT ME: map your numeric Lemon Squeezy VARIANT ids → internal products ----
// Find each in LS: Products → variant → the numeric id (or the API/variant URL).
// Both Pro variants (monthly + annual) map to the single product 'pro'.
const VARIANT_PRODUCT: Record<string, string> = {
  '1998968': 'pro',                      // Music Arcade Pro — Annual
  '1998986': 'pro',                      // Music Arcade Pro — Monthly
  '1998999': 'course:learning-to-walk',  // Learning to Walk
  '1999009': 'course:gradus',            // The Counterpoint Dojo
};
const SUB_PRODUCTS = new Set(['pro']); // which products are subscriptions (vs one-time purchases)
// --------------------------------------------------------------------------------

const SIGNING_SECRET = Deno.env.get('LEMONSQUEEZY_SIGNING_SECRET') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function validSignature(raw: string, sig: string): Promise<boolean> {
  if (!SIGNING_SECRET || !sig) return false;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(SIGNING_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const mac = toHex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw)));
  if (mac.length !== sig.length) return false;         // constant-time-ish compare
  let diff = 0;
  for (let i = 0; i < mac.length; i++) diff |= mac.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const raw = await req.text();
  const sig = req.headers.get('X-Signature') ?? '';
  if (!(await validSignature(raw, sig))) return new Response('Invalid signature', { status: 401 });

  let body: any;
  try { body = JSON.parse(raw); } catch { return new Response('Bad JSON', { status: 400 }); }

  const event: string = body?.meta?.event_name ?? '';
  const userId: string | undefined = body?.meta?.custom_data?.user_id;
  const attr = body?.data?.attributes ?? {};
  const variantId = String(attr.variant_id ?? attr.first_order_item?.variant_id ?? '');
  const product = VARIANT_PRODUCT[variantId];

  // Handy while setting up: a test purchase logs the ids you need to fill VARIANT_PRODUCT.
  // View with:  supabase functions logs lemonsqueezy-webhook
  console.log(`LS webhook: event=${event} variant=${variantId} user=${userId ?? '-'} product=${product ?? '(unmapped)'}`);

  // Nothing to do if we can't tie it to a user + a known product — ack so LS stops retrying.
  if (!userId || !product) return new Response('ignored (no user_id / unmapped variant)', { status: 200 });

  const isSub = SUB_PRODUCTS.has(product);
  let status = 'active';
  let period_end: string | null = null;

  if (isSub) {
    if (!event.startsWith('subscription_')) return new Response('ignored (non-sub event)', { status: 200 });
    const s: string = attr.status ?? 'active';
    if (s === 'active' || s === 'on_trial') { status = 'active'; period_end = attr.renews_at ?? null; }
    else if (s === 'past_due') { status = 'active'; period_end = null; }                 // keep access during dunning
    else if (s === 'cancelled') { status = 'active'; period_end = attr.ends_at ?? null; } // access until period end
    else { status = 'expired'; period_end = attr.ends_at ?? null; }                       // paused / unpaid / expired
  } else {
    if (event === 'order_refunded') { status = 'expired'; }
    else if (event === 'order_created') { status = 'active'; }
    else return new Response('ignored (non-order event)', { status: 200 });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const { error } = await sb.from('entitlements').upsert({
    user_id: userId,
    product,
    kind: isSub ? 'subscription' : 'purchase',
    status,
    period_end,
    source: 'lemonsqueezy',
    ext_id: String(body?.data?.id ?? ''),
  }, { onConflict: 'user_id,product' });

  if (error) return new Response('DB error: ' + error.message, { status: 500 });
  return new Response('ok', { status: 200 });
});
