# Email setup — Resend + Supabase custom SMTP

Supabase's built-in auth email is a shared, testing-only service capped at a few
messages/hour — that's why confirmation emails stopped arriving. This connects
**Resend** as your real email sender so confirmation + password-reset emails go
out reliably from your own domain. (Resend has a free tier that's plenty to start.)

Branded templates to paste in are in `email-templates/`.

---

## 1. Resend account + verify your domain
1. Sign up at **resend.com**.
2. **Domains → Add Domain →** `williamtroymusic.com`.
3. Resend shows a set of **DNS records** (SPF `TXT`, DKIM, and a return-path/MX).
   Add them wherever you manage DNS for `williamtroymusic.com` (your registrar /
   DNS host). These are *email* records — they sit alongside your existing
   GitHub Pages website records and won't affect the site.
4. Wait for Resend to show the domain **Verified** (usually minutes; can take up
   to a few hours for DNS to propagate).

## 2. Get SMTP credentials from Resend
Resend → **API Keys → Create API Key** (Sending access). Copy it (starts `re_…`).
Your SMTP settings are then:

| Field | Value |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | your API key (`re_…`) |

Keep the API key private — it only ever goes into Supabase's server-side SMTP
settings, never into the website code.

## 3. Point Supabase at Resend
Supabase → **Authentication → Emails → SMTP Settings → Enable Custom SMTP**:
- **Sender email:** `no-reply@williamtroymusic.com`  (must be on the verified domain)
- **Sender name:** `Music Arcade`
- **Host:** `smtp.resend.com`
- **Port:** `465`
- **Username:** `resend`
- **Password:** your Resend API key
- **Save.**

Then Supabase → **Authentication → Rate Limits** → raise the email limit (the tiny
default only applied to the shared service; on your own SMTP you can lift it).

## 4. Paste the branded templates
Supabase → **Authentication → Email Templates**:
- **Confirm signup** → subject `Confirm your email — Music Arcade` → body = contents of `email-templates/confirm-signup.html`
- **Reset Password** → subject `Reset your Music Arcade password` → body = contents of `email-templates/reset-password.html`

(Leave the `{{ .ConfirmationURL }}` placeholders exactly as they are.)

## 5. Turn confirmation back on + test
1. Supabase → **Authentication → Providers → Email → "Confirm email" ON.**
2. Sign up on the site with a real address → the branded confirmation should
   arrive **from no-reply@williamtroymusic.com** (check it's not in spam).
3. Try **Forgot your password?** → the reset email should arrive too.

Resend's dashboard has a **Logs/Emails** view showing every send + delivery
status — the place to look if anything doesn't arrive.

---

Note: I can't create the Resend account, edit your DNS, or enter the API key —
those are yours. The templates and this guide are ready; ping me at any step.
