// ============================================================
//  Music Arcade — Rollbook progress summariser
//  Supabase Edge Function (Deno). Takes an anonymised bundle of one
//  student's (or class's) lesson notes + attendance and asks Claude
//  for a short "where are they at" read for the teacher.
//
//  The API key never leaves the server — the browser calls this
//  function with the signed-in user's JWT, nothing else.
//
//  Deploy:  supabase functions deploy rollbook-summary
//           (JWT verification ON — this must only run for a signed-in user)
//  Secret:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//  (SUPABASE_URL + SUPABASE_ANON_KEY are injected automatically.)
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'npm:@anthropic-ai/sdk';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

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
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), 'Content-Type': 'application/json' },
  });

// ---- what we ask Claude to produce ----
const SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string', description: 'One plain sentence: where this learner is right now.' },
    strengths: { type: 'array', items: { type: 'string' }, description: 'What is going well. 0-3 short items.' },
    watch: { type: 'array', items: { type: 'string' }, description: 'What is slipping or unresolved. 0-3 short items.' },
    next: { type: 'array', items: { type: 'string' }, description: 'Concrete things to do in the next lesson or two. 1-3 short items.' },
    attendance_note: { type: ['string', 'null'], description: 'One sentence only if attendance is worth remarking on; otherwise null.' },
  },
  required: ['headline', 'strengths', 'watch', 'next', 'attendance_note'],
  additionalProperties: false,
};

const SYSTEM = `You read a music teacher's own lesson logs and tell them, in a few lines, where a learner is at.

The logs are terse notes the teacher wrote for themselves after each lesson, newest last. Names are withheld — say "they".

Ground everything in what the notes actually say. Where the notes are thin, say so plainly in the headline rather than filling the gap with generic music-teaching advice. Repeated mentions across lessons matter more than one-offs; something that appeared several weeks running and then stopped is worth noticing either way.

Write the way the teacher writes: short, concrete, no jargon and no praise-sandwich. Each bullet is one clause, under about fifteen words.`;

function clip(s: unknown, n: number): string {
  return typeof s === 'string' ? s.slice(0, n) : '';
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(origin) });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, origin);
  if (!ANTHROPIC_API_KEY) return json({ error: 'Summaries are not configured yet.' }, 503, origin);

  // ---- the caller must be a signed-in user, not just anyone holding the anon key ----
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return json({ error: 'Sign in first.' }, 401, origin);
  const sb = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data: got, error: authErr } = await sb.auth.getUser();
  if (authErr || !got?.user) return json({ error: 'Sign in first.' }, 401, origin);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'Bad JSON' }, 400, origin); }

  const lessons = Array.isArray(body?.lessons) ? body.lessons.slice(-30) : [];
  if (!lessons.length) return json({ error: 'No lessons logged yet — nothing to summarise.' }, 400, origin);

  // ---- rebuild the payload ourselves so only these fields ever reach the model ----
  const kind = body?.kind === 'class' ? 'class' : 'student';
  const instrument = clip(body?.instrument, 40);
  const att = body?.attendance ?? {};
  const rep: any[] = Array.isArray(body?.repertoire) ? body.repertoire.slice(0, 40) : [];

  const lines: string[] = [];
  lines.push(`This is a ${kind}${instrument ? ` learning ${instrument}` : ''}.`);
  const a = ['present', 'absent', 'offthem', 'offme'].map((k) => Number(att?.[k]) || 0);
  if (a.some((n) => n > 0)) {
    lines.push(`Attendance so far: ${a[0]} attended, ${a[1]} no-show, ${a[2]} cancelled by them, ${a[3]} cancelled by me.`);
  }
  if (typeof body?.performanceWeeks === 'number') {
    lines.push(`A performance is ${body.performanceWeeks} week(s) away.`);
  }
  if (rep.length) {
    lines.push('Repertoire list: ' + rep.map((r) => `${clip(r?.title, 80)}${r?.done ? ' (done)' : ''}`).join('; ') + '.');
  }
  lines.push('', `Lesson log (${lessons.length} ${lessons.length === 1 ? 'entry' : 'entries'}, oldest first):`);
  for (const l of lessons) {
    const date = clip(l?.date, 10);
    const r = clip(l?.rep, 200);
    const n = clip(l?.notes, 700);
    lines.push(`- ${date}${r ? ` — worked on: ${r}` : ''}${n ? ` — notes: ${n}` : ''}`);
  }

  try {
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 2000,
      system: SYSTEM,
      output_config: {
        effort: 'medium',
        format: { type: 'json_schema', schema: SCHEMA },
      },
      messages: [{ role: 'user', content: lines.join('\n') }],
    });

    if (msg.stop_reason === 'refusal') return json({ error: 'Claude declined to answer that one.' }, 502, origin);
    const text = msg.content.find((b: any) => b.type === 'text')?.text ?? '';
    let out: any;
    try { out = JSON.parse(text); } catch { return json({ error: 'Could not read the summary.' }, 502, origin); }

    return json({ summary: out, at: new Date().toISOString() }, 200, origin);
  } catch (e) {
    console.error('rollbook-summary failed', e);
    return json({ error: 'Could not reach Claude just now.' }, 502, origin);
  }
});
