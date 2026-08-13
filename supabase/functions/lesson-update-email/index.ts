// ============================================================
//  Music Arcade — Rollbook lesson update email
//  Supabase Edge Function (Deno). Sends the "here's what we covered
//  today" note to a student's contacts, via Resend.
//
//  The Resend key never leaves the server. The browser calls this with
//  the teacher's signed-in JWT and nothing else; the function decides
//  who it's from and who it replies to.
//
//  Deploy:  supabase functions deploy lesson-update-email
//           (JWT verification ON — only a signed-in teacher may send)
//  Secret:  supabase secrets set RESEND_API_KEY=re_...
//  Optional: supabase secrets set ROLLBOOK_FROM="William Troy <lessons@williamtroymusic.com>"
//            (defaults to lessons@williamtroymusic.com — any address on a
//             domain you've verified in Resend works)
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM = Deno.env.get('ROLLBOOK_FROM') ?? 'Music lessons <lessons@williamtroymusic.com>';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const MAX_RECIPIENTS = 6;
const MAX_BODY = 8000;

const ALLOWED_ORIGINS = [
  'https://williamtroymusic.com',
  'https://www.williamtroymusic.com',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
];
function cors(origin: string | null) {
  const o = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': o,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}
const json = (body: unknown, status: number, origin: string | null) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(origin), 'Content-Type': 'application/json' } });

const EMAIL_RE = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;

function esc(s: string) {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
}
// plain text in, simple readable HTML out — bullets stay bullets
function toHtml(text: string) {
  const out: string[] = [];
  let inList = false;
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    if (/^[•\-*]\s+/.test(line)) {
      if (!inList) { out.push('<ul style="margin:0 0 14px;padding-left:20px">'); inList = true; }
      out.push('<li style="margin:2px 0">' + esc(line.replace(/^[•\-*]\s+/, '')) + '</li>');
      continue;
    }
    if (inList) { out.push('</ul>'); inList = false; }
    out.push(line ? '<p style="margin:0 0 12px">' + esc(line) + '</p>' : '');
  }
  if (inList) out.push('</ul>');
  return '<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;' +
    'font-size:15px;line-height:1.55;color:#17140E;max-width:560px">' + out.join('') + '</div>';
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(origin) });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, origin);
  if (!RESEND_API_KEY) return json({ error: 'Email isn’t configured yet — set RESEND_API_KEY.' }, 503, origin);

  // ---- must be a signed-in user, not just anyone holding the anon key ----
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return json({ error: 'Sign in first.' }, 401, origin);
  const sb = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data: got, error: authErr } = await sb.auth.getUser();
  if (authErr || !got?.user) return json({ error: 'Sign in first.' }, 401, origin);
  const teacherEmail = got.user.email ?? '';

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'Bad JSON' }, 400, origin); }

  const to: string[] = (Array.isArray(body?.to) ? body.to : [])
    .map((x: unknown) => String(x || '').trim())
    .filter((x: string) => EMAIL_RE.test(x))
    .slice(0, MAX_RECIPIENTS);
  if (!to.length) return json({ error: 'No valid email address to send to.' }, 400, origin);

  const subject = String(body?.subject || 'Lesson update').slice(0, 200);
  const text = String(body?.text || '').slice(0, MAX_BODY);
  if (!text.trim()) return json({ error: 'Nothing to send.' }, 400, origin);

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to,
        // parents hit reply and it reaches the teacher, not a no-reply void
        reply_to: teacherEmail || undefined,
        subject,
        text,
        html: toHtml(text),
      }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('resend rejected', res.status, out);
      return json({ error: out?.message || `Resend refused it (${res.status}).` }, 502, origin);
    }
    return json({ id: out?.id ?? null, to, at: new Date().toISOString() }, 200, origin);
  } catch (e) {
    console.error('lesson-update-email failed', e);
    return json({ error: 'Could not reach the email service.' }, 502, origin);
  }
});
