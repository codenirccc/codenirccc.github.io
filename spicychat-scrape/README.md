# SpicyChat.ai Scrape Archive

Public frontend assets scraped from [spicychat.ai](https://spicychat.ai) (app version **4.2.1**).

**Decoded / beautified copy:** https://codenirccc.github.io/decoded/

> For research / analysis only. All assets belong to NextDay AI (SpicyChat).

## Contents

| Path | Description |
|------|-------------|
| `index.html` | Original SPA shell (boot loader, Rocket Loader markup) |
| `manifest.json` | PWA manifest |
| `robots.txt` | Robots rules |
| `sw.js` | Service worker |
| `js/` | Minified production bundles (as served) |
| `js-beautified/` | Pretty-printed versions of key bundles |
| `css/` | Production stylesheets |
| `scripts/` | Plain readable helper scripts |
| `report.html` | Human-readable analysis / decoded notes |

## Key findings

- **Stack**: React 18 + Vite SPA, Tailwind, Cloudflare Rocket Loader + CDN
- **Auth**: Kinde Auth (redirect URI = site origin)
- **API**: `https://prod.nd-api.com` (JSON:API, v1 + v2)
- **CDN**: `cdn.nd-api.com`, CMS `cms.cdn.nd-api.com`
- **Sourcemaps**: referenced at `sourcemaps.nd-api.com` but return **403**
- **Rocket Loader**: `type="73676d05e8331092932333ed-text/javascript"` is *not* encryption — CF rewrites `text/javascript` with a settings hash prefix. Script bodies remain plain JS.
- **Signup route**: `/signup` (auth-protected); login opens a Kinde-backed modal from the header
- **Search**: Typesense · **Recs**: Recombee · **Flags**: GrowthBook
- **Other brands** (same codebase): pixelchat.ai, secretmate.ai, AdultTime/EvilAngel/ASG roleplay domains

## Beautified files

- `js-beautified/index-CRMqMN4I.js` — app entry, routing, auth bootstrap
- `js-beautified/common-GQ-Rvgly.js` — shared constants, routes, UI kit, API client
- `js-beautified/login-DuXmHf_m.js` — login page wrapper
- `js-beautified/unsupportedBrowserFallback.js` — ES3 browser gate
- `js-beautified/setSiteicons.js` — favicon/apple-touch injectors
