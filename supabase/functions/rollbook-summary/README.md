# rollbook-summary

Gives the Rollbook drawer its **"Where they're at"** card: Claude reads back through one
student's (or class's) lesson log and returns a short progress read for you.

The browser never sees the Anthropic API key — it calls this function with your signed-in
Supabase session, and the function talks to Claude.

## Deploy

```bash
supabase functions deploy rollbook-summary
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

Deploy **with** JWT verification (the default — no `--no-verify-jwt`). The function also
checks `auth.getUser()` itself, so a bare anon key won't get through: it has to be a real
signed-in user.

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are injected by Supabase automatically.

If the function isn't deployed or the key isn't set, the Rollbook button just shows a
one-line error — nothing else in the page breaks.

## What gets sent

Only this, rebuilt server-side so nothing else can ride along:

- `kind` (student/class) and `instrument`
- attendance counts (came / no-show / cancelled)
- the repertoire list with done flags, and weeks to a performance
- the last **30** lesson entries — date, rep, notes

The person's **name is stripped in the browser before sending** (`scrubNames` in
`rollbook.html` swaps it and any possessive for "the student" / "the class"). No email, no
timetable, no other student, no user id.

## Model

`claude-opus-5`, `effort: medium`, structured output (`headline`, `strengths`, `watch`,
`next`, `attendance_note`) so the drawer can lay it out rather than dumping prose. A
summary costs roughly a cent; the client caches it and only offers to re-run once the log
actually changes.

To pin the SDK version, change `npm:@anthropic-ai/sdk` in `index.ts` to
`npm:@anthropic-ai/sdk@<version>`.
