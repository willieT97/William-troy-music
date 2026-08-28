# lesson-update-email

Sends the "here's what we covered today" note to a student's contacts when you
save a lesson log in the Rollbook.

The Resend API key lives on the server. The browser sends only the recipients,
subject and text, authenticated with your signed-in Supabase session — the
function decides the `from` address itself and sets `reply_to` to your account
email, so a parent hitting reply reaches you and not a no-reply void.

## Deploy

```bash
supabase functions deploy lesson-update-email
supabase secrets set RESEND_API_KEY=re_...
```

Deploy **with** JWT verification (the default — no `--no-verify-jwt`). The
function also calls `auth.getUser()` itself, so the public anon key alone can't
send mail on your domain.

Get the Resend key at resend.com → **API Keys**. `williamtroymusic.com` is
already verified there (see `RESEND-SETUP.md`), so no DNS work is needed.

Optional — change the sender (any address on a verified domain works):

```bash
supabase secrets set ROLLBOOK_FROM="William Troy <lessons@williamtroymusic.com>"
```

Default is `Music lessons <lessons@williamtroymusic.com>`.

## Turning it on in the Rollbook

1. **Set up** → tick *"Email contacts what we covered when I save a lesson log"*.
   Off by default, so nothing goes out until you say so.
2. Open a student → **Contacts** → add the parent / class teacher with an email.
   Ticked contacts get the update; untick anyone who shouldn't.
3. Log a lesson with something in **rep / resources**. A bar appears:
   *"Emailing Máire Ní Bhriain in 8s… Cancel"*. Let it run and it sends.

## What it does and doesn't send

Sends: who the lesson was with, the date, and the rep/resources list. For a
class it's the same shape.

**Your lesson notes are not included.** They're shorthand you write for
yourself ("bow arm stiff, distracted today") and rarely what you'd say to a
parent. There's a second tick in Set up if you want them in.

Nothing is sent when: the toggle is off, the log has no rep/resources, no
contact has an email, or you're **editing** an existing log — only a brand-new
entry triggers it, so fixing a typo later never re-sends. Use *Send an update*
in the drawer to send by hand.

Sent entries are stamped in **Story so far** with a green ✉ sent, and the
lesson records who it went to.

## Limits

Max 6 recipients per lesson and 8,000 characters, enforced server-side.
Resend's free tier is 3,000 emails a month, which is a lot of lessons.
