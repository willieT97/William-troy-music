# Lemon Squeezy setup (Monetisation Phase 3)

Everything in the codebase is ready. These are the steps only you can do
(dashboard + deploy). Do it all in **Test mode** first, then flip to Live.

Two identifiers matter and they are **different**:
- **Buy link URL** → goes in `upgrade.html` (front-end checkout).
- **Numeric variant id** → goes in the webhook (`supabase/functions/lemonsqueezy-webhook/index.ts`) so it can grant the right product.

---

## 1. Create the store + products (Lemon Squeezy dashboard, Test mode)

Turn on **Test mode** (toggle, top of the dashboard). Create a store if you
haven't. Then create:

1. **Music Arcade Pro** — a **Subscription** product with two variants:
   - *Monthly* — $4.99 / month
   - *Annual* — $39.99 / year
2. **Learning to Walk** — a **Single payment** product, $14.99
3. **The Counterpoint Dojo** — a **Single payment** product, $14.99

(Skip Old Man and the C — it's still free.)

---

## 2. Paste the Buy links into `upgrade.html`

For each variant: **Share → copy the URL** (looks like
`https://YOURSTORE.lemonsqueezy.com/buy/xxxxxxxx-xxxx-...`).
Fill in `LS_BUY` near the top of the `<script>` in `upgrade.html`:

```js
var LS_BUY = {
  'pro-monthly':             'https://YOURSTORE.lemonsqueezy.com/buy/....',
  'pro-annual':              'https://YOURSTORE.lemonsqueezy.com/buy/....',
  'course:learning-to-walk': 'https://YOURSTORE.lemonsqueezy.com/buy/....',
  'course:gradus':           'https://YOURSTORE.lemonsqueezy.com/buy/....'
};
```
Any left `''` just shows a "not switched on yet" note — safe to ship partially.

---

## 3. Deploy the webhook (Supabase CLI)

```bash
# from the repo root (needs the Supabase CLI + `supabase login`)
supabase functions deploy lemonsqueezy-webhook --no-verify-jwt
```
`--no-verify-jwt` is required — Lemon Squeezy calls it without a Supabase token.
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

Your webhook URL is:
```
https://<your-project-ref>.supabase.co/functions/v1/lemonsqueezy-webhook
```

---

## 4. Add the webhook in Lemon Squeezy

Settings → **Webhooks** → **Add**:
- **Callback URL:** the URL above
- **Signing secret:** make one up (e.g. a long random string) — you'll reuse it in step 5
- **Events:** `order_created`, `order_refunded`, `subscription_created`,
  `subscription_updated`, `subscription_cancelled`, `subscription_paused`,
  `subscription_resumed`, `subscription_expired`

Then give the function the same secret:
```bash
supabase secrets set LEMONSQUEEZY_SIGNING_SECRET=the-same-secret-you-entered
```

---

## 5. Map the numeric variant ids → products

Easiest way to find the numeric ids: do **one test purchase** of each product
(test card `4242 4242 4242 4242`, any future date/CVC), then read the logs:

```bash
supabase functions logs lemonsqueezy-webhook
```
Each line prints `variant=NNNN product=(unmapped)`. Copy those numbers into
`VARIANT_PRODUCT` in `supabase/functions/lemonsqueezy-webhook/index.ts`:

```ts
const VARIANT_PRODUCT = {
  '111111': 'pro',                     // Pro — monthly
  '222222': 'pro',                     // Pro — annual
  '333333': 'course:learning-to-walk',
  '444444': 'course:gradus',
};
```
Redeploy: `supabase functions deploy lemonsqueezy-webhook --no-verify-jwt`

---

## 6. Test end-to-end

1. Sign in on the site, go to **/upgrade.html**, click **Go Pro**.
2. Pay with the test card in the overlay.
3. The page should show "unlocking your account… → you're in!" within a few
   seconds (it polls while the webhook lands).
4. Open a Dojo course — the PRO tags are gone, lessons unlock.
5. Check the `entitlements` table in Supabase for the new row.

If nothing unlocks: `supabase functions logs lemonsqueezy-webhook` will show the
event + whether the variant was mapped and the signature verified.

---

## 7. Go live

Flip Lemon Squeezy to **Live mode** and repeat: live products often have
**different buy links and variant ids** than test. Update `LS_BUY` (front-end)
and `VARIANT_PRODUCT` (redeploy the function) with the live values, and add a
**live** webhook (same URL, its own signing secret → `supabase secrets set`).

Note: I can't do the dashboard steps, handle your keys, or run the deploy — but
the code for all of it is in place.
