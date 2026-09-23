# codenirccc.github.io

Live CAPTCHA playground hosting **hCaptcha**, **reCAPTCHA v2** (checkbox + invisible), **reCAPTCHA v3**, and **Cloudflare Turnstile**.

## Deploy (GitHub Pages)

1. Create a repo named exactly `codenirccc.github.io` (user site) or push this folder to any repo and enable Pages.
2. Push all files (`index.html`, `style.css`, `script.js`).
3. Visit `https://codenirccc.github.io`.

```bash
git init
git add .
git commit -m "Add CAPTCHA demos"
git remote add origin https://github.com/codenirccc/codenirccc.github.io.git
git push -u origin main
```

## Get real site keys

| Provider | Dashboard | What to copy |
|----------|-----------|--------------|
| Google reCAPTCHA v2/v3 | https://www.google.com/recaptcha/admin | Site key → `KEYS.recaptchaV2SiteKey`, `KEYS.recaptchaV2InvisibleSiteKey`, `KEYS.recaptchaV3SiteKey`; Secret → server only |
| hCaptcha | https://dashboard.hcaptcha.com/ | Site key → `KEYS.hcaptchaSiteKey`; Secret → server only |
| Cloudflare Turnstile | Cloudflare Dashboard → Turnstile | Site key → `KEYS.turnstileSiteKey`; Secret → server only |

Edit `script.js` → `KEYS` object. The defaults are **public test keys** (always pass) so the demos work immediately.

> Never ship a `secret` key to the client. Verify tokens on your backend (see the Node.js snippet on the page).

## Files

- `index.html` — all demo sections + combo form + server verification snippet
- `style.css` — dark theme styling
- `script.js` — key config, widget rendering, form/token handling
