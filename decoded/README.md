# Decoded / beautified SpicyChat.ai assets

Pretty-printed (decoded) JS from spicychat.ai, served at **https://codenirccc.github.io/decoded/**

## Layout

```
decoded/
  js/           # beautified all production JS bundles
  scripts/      # plain readable helper scripts (as shipped)
  css/          # production stylesheets
  index.html    # original SPA shell
  report.html   # analysis report
  manifest.json # PWA
  sw.js         # service worker
```

Raw minified copies: `/spicychat-scrape/`

## Key findings

- **Stack**: React 18 + Vite SPA, Tailwind, Cloudflare Rocket Loader + CDN
- **Auth**: Kinde Auth → route `/signup`, login modal from header
- **API**: `https://prod.nd-api.com` (JSON:API, v1 + v2)
- **Sourcemaps**: `sourcemaps.nd-api.com` → **403**
- **Rocket Loader**: `type="<hash>-text/javascript"` is not encryption — bodies are plain JS

## Main decoded files

| File | Role |
|------|------|
| `js/index-CRMqMN4I.js` | App entry, routing, auth bootstrap |
| `js/common-GQ-Rvgly.js` | Routes, constants, API client, UI kit |
| `js/login-DuXmHf_m.js` | Login page |
| `js/vendor-CPQsO5nz.js` | Vendor libs (~7MB beautified) |
| `js/chat-story-CzlWBq7z.js` | Story mode |
| `js/legal-BTLM9YOS.js` | Legal pages |
| `scripts/*.js` | Unsupported-browser gate, icons |
