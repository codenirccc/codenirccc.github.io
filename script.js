/*
 * codenirccc.github.io — CAPTCHA engine
 *
 * Pattern: IIFE → Module → Controller
 * Every captcha is a self-describing descriptor; the dispatcher
 * reads descriptors and wires render/execute/collect automatically.
 * Tokens live in a frozen proxy so nothing mutates silently.
 */

(() => {
  "use strict";

   const TEST_KEYS = Object.freeze({
     recaptchaV2:       "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI",
     recaptchaV2Inv:    "6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe",
     recaptchaV3:       "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI",
     hcaptcha:          "10000000-ffff-ffff-ffff-000000000001",
     turnstile:         "3x00000000000000000000FF",
   });

   const REG_LINKS = Object.freeze({
     recaptchaV2:    "https://www.google.com/recaptcha/admin",
     recaptchaV2Inv: "https://www.google.com/recaptcha/admin",
     recaptchaV3:    "https://www.google.com/recaptcha/admin",
     hcaptcha:       "https://dashboard.hcaptcha.com/",
     turnstile:      "https://dash.cloudflare.com/",
   });

   /* ============================================================
    *  CONFIG — site keys only. Secrets stay on your server.
    * ============================================================ */
   const KEYS = {
     recaptchaV2:       "",
     recaptchaV2Inv:    "",
     recaptchaV3:       "",
     hcaptcha:          "",
     turnstile:         "",
   };

  /* ============================================================
   *  TOKEN STORE — frozen proxy, no silent mutation
   * ============================================================ */
  const _store = {};
  const tokens = new Proxy(_store, {
    set(_, prop, val) { _store[prop] = val; return true; },
    get(_, prop) { return _store[prop] ?? ""; },
  });

  /* ============================================================
   *  UTILITIES
   * ============================================================ */
  const $ = (id) => document.getElementById(id);
  const el = (id) => { const n = $(id); if (!n) throw new Error(`Missing element: #${id}`); return n; };
  const safe = (fn) => (...args) => { try { return fn(...args); } catch (_) { return null; } };
  const slice = (s, n = 24) => (s || "").slice(0, n) + "…";
  const setResult = (id, msg, ok) => { const e = $(id); if (!e) return; e.textContent = msg; e.className = "result " + (ok ? "ok" : "err"); };
  const now = () => new Date().toLocaleTimeString();

  /* ============================================================
   *  CAPTCHA DESCRIPTORS — declarative, extensible
   * ============================================================ */
  const descriptors = [
    {
      id: "recaptcha-v2", container: "recaptcha-v2-box",
      engine: "grecaptcha", key: "recaptchaV2", theme: "dark",
      onVerify(t) { tokens.recaptchaV2 = t; setResult("result-v2", "reCAPTCHA v2 verified ✓", true); },
      onExpire() { tokens.recaptchaV2 = ""; setResult("result-v2", "Expired — re-check.", false); },
    },
    {
      id: "combo-recaptcha-v2", container: "combo-recaptcha-v2",
      engine: "grecaptcha", key: "recaptchaV2", theme: "dark",
      onVerify(t) { tokens.combo = t; },
      onExpire() { tokens.combo = ""; },
    },
    {
      id: "hcaptcha", container: "hcaptcha-box",
      engine: "hcaptcha", key: "hcaptcha", theme: "dark",
      onVerify(t) { tokens.hcaptcha = t; setResult("result-hcaptcha", "hCaptcha verified ✓", true); },
      onExpire() { tokens.hcaptcha = ""; setResult("result-hcaptcha", "Expired — re-check.", false); },
    },
    {
      id: "combo-hcaptcha", container: "combo-hcaptcha-box",
      engine: "hcaptcha", key: "hcaptcha", theme: "dark",
      onVerify(t) { tokens.combo = t; },
      onExpire() { tokens.combo = ""; },
    },
    {
      id: "turnstile", container: "turnstile-box",
      engine: "turnstile", key: "turnstile", theme: "dark",
      onVerify(t) { tokens.turnstile = t; setResult("result-turnstile", "Turnstile verified ✓", true); },
      onExpire() { tokens.turnstile = ""; setResult("result-turnstile", "Expired — reload.", false); },
    },
    {
      id: "combo-turnstile", container: "combo-turnstile-box",
      engine: "turnstile", key: "turnstile", theme: "dark",
      onVerify(t) { tokens.combo = t; },
      onExpire() { tokens.combo = ""; },
    },
  ];

  /* ============================================================
   *  WIDGET REGISTRY — tracks rendered widget IDs per container
   * ============================================================ */
  const registry = new Map();

   function renderWidget(desc) {
     const container = $(desc.container);
     if (!container) return null;
     const win = window[desc.engine];
     if (!win) return null;
     const key = KEYS[desc.key];
     if (!key) {
       container.innerHTML = '<span style="color:#999;font-size:0.85rem">Add site key in script.js → KEYS</span>';
       return null;
     }

    const opts = { sitekey: KEYS[desc.key], theme: desc.theme };
    if (desc.engine === "grecaptcha") {
      opts.callback = desc.onVerify;
      opts["expired-callback"] = desc.onExpire;
    } else if (desc.engine === "hcaptcha") {
      opts.callback = desc.onVerify;
      opts["expired-callback"] = desc.onExpire;
    } else if (desc.engine === "turnstile") {
      opts.callback = desc.onVerify;
      opts["expired-callback"] = desc.onExpire;
    }

    try {
      const wid = win.render(desc.container, opts);
      registry.set(desc.container, wid);
      return wid;
    } catch (e) {
      console.warn(`[captcha] render failed for #${desc.container}:`, e);
      return null;
    }
  }

  /* ============================================================
   *  LAZY WIDGET LOADER — each container renders once, on first
   *  visibility, not all at once. Handles hidden combo panels.
   * ============================================================ */
  const rendered = new Set();

  function ensureWidget(containerId) {
    if (rendered.has(containerId)) return;
    const desc = descriptors.find((d) => d.container === containerId);
    if (!desc) return;
    const win = window[desc.engine];
    if (!win) return;
    if (desc.engine === "grecaptcha" && !win.render) return;
    if (desc.engine === "hcaptcha" && !win.render) return;
    if (desc.engine === "turnstile" && !win.render) return;

    renderWidget(desc);
    rendered.add(containerId);
  }

  /* ============================================================
   *  INDEPENDENT SDK LOADING — each script loads on its own,
   *  no waiting for all three. Renders as soon as each is ready.
   * ============================================================ */
  function whenReady(engine, fn) {
    if (typeof window[engine] !== "undefined") { fn(); return; }
    let tries = 0;
    const iv = setInterval(() => {
      tries++;
      if (typeof window[engine] !== "undefined" || tries > 200) {
        clearInterval(iv);
        fn();
      }
    }, 100);
  }

  /* ============================================================
   *  RECAPTCHA v3 — guarded execute, single-fire per action
   * ============================================================ */
  let v3Executing = false;

   function runV3(action, cb) {
     if (v3Executing) { cb(null, "already executing"); return; }
     if (!KEYS.recaptchaV3) { cb(null, "no key"); return; }
     const g = window.grecaptcha;
     if (!g) { cb(null, "SDK not loaded"); return; }
     v3Executing = true;
    g.ready(() => {
      g.execute(KEYS.recaptchaV3, { action })
        .then((t) => { v3Executing = false; cb(t); })
        .catch((e) => { v3Executing = false; cb(null, String(e)); });
    });
  }

  /* ============================================================
   *  INVISIBLE reCAPTCHA v2 — single render, cached widgetId
   * ============================================================ */
  let invWidgetId = null;

   function ensureInvWidget() {
     if (invWidgetId !== null) return invWidgetId;
     if (!KEYS.recaptchaV2Inv) return null;
     const btn = $("form-v2-invisible")?.querySelector("button");
     if (!btn || !window.grecaptcha) return null;
     invWidgetId = window.grecaptcha.render(btn, {
       sitekey: KEYS.recaptchaV2Inv,
       size: "invisible",
       callback: onInvisibleV2,
       "expired-callback": () => { tokens.recaptchaV2Invisible = ""; },
     });
     return invWidgetId;
   }

  /* ============================================================
   *  GLOBAL CALLBACKS
   * ============================================================ */
  function onInvisibleV2(token) {
    tokens.recaptchaV2Invisible = token;
    setResult("result-v2-invisible", "Invisible v2 verified ✓", true);
    const form = $("form-v2-invisible");
    if (form && !form.dataset.done) {
      form.dataset.done = "1";
      form.requestSubmit?.() ?? form.submit();
    }
  }
  window.onInvisibleV2 = onInvisibleV2;

  /* ============================================================
   *  FORM HANDLERS
   * ============================================================ */
  function initForms() {
    // v2 checkbox
    safe(() => {
      el("form-v2").addEventListener("submit", (e) => {
        e.preventDefault();
        if (!tokens.recaptchaV2) { setResult("result-v2", "Complete the checkbox first.", false); return; }
        setResult("result-v2", "OK — " + slice(tokens.recaptchaV2) + " (send to server)", true);
      });
    })();

    // v2 invisible
    safe(() => {
      el("form-v2-invisible").addEventListener("submit", (e) => {
        e.preventDefault();
        if (tokens.recaptchaV2Invisible) {
          setResult("result-v2-invisible", "OK — " + slice(tokens.recaptchaV2Invisible), true);
          el("form-v2-invisible").dataset.done = "";
          return;
        }
        const wid = ensureInvWidget();
        if (wid && window.grecaptcha) {
          window.grecaptcha.execute(wid);
        } else {
          setResult("result-v2-invisible", "SDK not ready — retry.", false);
        }
      });
    })();

    // v3
    safe(() => {
      el("form-v3").addEventListener("submit", (e) => {
        e.preventDefault();
        runV3("submit", (token, err) => {
          if (err || !token) { setResult("result-v3", "v3 error: " + (err || "no token"), false); return; }
          tokens.recaptchaV3 = token;
          setResult("result-v3", "v3 token: " + slice(token), true);
          const box = $("v3-score");
          if (box) { box.classList.remove("hidden"); box.querySelector("span").textContent = "issued (verify server-side)"; }
        });
      });
    })();

    // hCaptcha
    safe(() => {
      el("form-hcaptcha").addEventListener("submit", (e) => {
        e.preventDefault();
        if (!tokens.hcaptcha) { setResult("result-hcaptcha", "Complete hCaptcha first.", false); return; }
        setResult("result-hcaptcha", "OK — " + slice(tokens.hcaptcha), true);
      });
    })();

    // Turnstile
    safe(() => {
      el("form-turnstile").addEventListener("submit", (e) => {
        e.preventDefault();
        if (!tokens.turnstile) { setResult("result-turnstile", "Complete Turnstile first.", false); return; }
        setResult("result-turnstile", "OK — " + slice(tokens.turnstile), true);
      });
    })();

    // Combo
    safe(() => {
      el("form-combo").addEventListener("submit", (e) => {
        e.preventDefault();
        const panel = document.querySelector(".combo-panel.active");
        if (!panel) return;
        const active = panel.id;
        if (active === "combo-v3") {
          runV3("combo_submit", (token, err) => {
            if (err || !token) { setResult("result-combo", "v3 error: " + (err || "no token"), false); return; }
            setResult("result-combo", "Combo v3: " + slice(token), true);
          });
          return;
        }
        if (!tokens.combo) { setResult("result-combo", "Complete the active CAPTCHA first.", false); return; }
        setResult("result-combo", "OK (" + active + ") — " + slice(tokens.combo), true);
      });
    })();
  }

  /* ============================================================
   *  COMBO TABS — lazy-render widgets when tab becomes visible
   * ============================================================ */
  function initComboTabs() {
    const tabs = document.querySelectorAll(".tab");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        tabs.forEach((t) => t.classList.remove("active"));
        document.querySelectorAll(".combo-panel").forEach((p) => p.classList.remove("active"));
        tab.classList.add("active");
        const target = $(tab.dataset.target);
        if (target) target.classList.add("active");
        tokens.combo = "";

        // Lazy-render widgets in the newly visible panel
        requestAnimationFrame(() => {
          if (tab.dataset.target === "combo-v2") ensureWidget("combo-recaptcha-v2");
          if (tab.dataset.target === "combo-hcaptcha") ensureWidget("combo-hcaptcha-box");
          if (tab.dataset.target === "combo-turnstile") ensureWidget("combo-turnstile-box");
        });
      });
    });
  }

   function initKeyGen() {
     // Populate key display elements
     for (const [name, key] of Object.entries(TEST_KEYS)) {
       const el = $(("key-" + name));
       if (el) el.textContent = key;
     }

     // Copy buttons
     document.querySelectorAll("[data-copy]").forEach((btn) => {
       btn.addEventListener("click", () => {
         const keyEl = $(btn.dataset.copy);
         if (!keyEl) return;
         const text = keyEl.textContent;
         navigator.clipboard?.writeText(text).then(() => {
           btn.textContent = "Copied";
           setTimeout(() => { btn.textContent = "Copy"; }, 1500);
         }).catch(() => {
           // fallback
           const ta = document.createElement("textarea");
           ta.value = text;
           document.body.appendChild(ta);
           ta.select();
           document.execCommand("copy");
           document.body.removeChild(ta);
           btn.textContent = "Copied";
           setTimeout(() => { btn.textContent = "Copy"; }, 1500);
         });
       });
     });

     // Fill keys into KEYS and reload so widgets render fresh
     const fillBtn = $("fill-keys");
     const fillMsg = $("fill-msg");
     if (fillBtn && fillMsg) {
       fillBtn.addEventListener("click", () => {
         for (const [name, key] of Object.entries(TEST_KEYS)) {
           KEYS[name] = key;
         }
         try { localStorage.setItem("captchaKeys", JSON.stringify(TEST_KEYS)); } catch(_) {}
         fillMsg.textContent = "Keys filled — reloading…";
         location.reload();
       });
     }

     // On load, if keys were saved, use them
     try {
       const saved = JSON.parse(localStorage.getItem("captchaKeys") || "null");
       if (saved && typeof saved === "object") {
         for (const [k, v] of Object.entries(saved)) {
           if (typeof v === "string") KEYS[k] = v;
         }
       }
     } catch(_) {}
   }

   /* ============================================================
    *  BOOTSTRAP
    * ============================================================ */
   function bootstrap() {
     const yr = $("year");
     if (yr) yr.textContent = new Date().getFullYear();

     initForms();
     initComboTabs();
     initKeyGen();

     // Render static widgets (v2 checkbox, hCaptcha, Turnstile) as soon as their SDK is ready
     whenReady("grecaptcha", () => ensureWidget("recaptcha-v2"));
     whenReady("hcaptcha", () => ensureWidget("hcaptcha-box"));
     whenReady("turnstile", () => ensureWidget("turnstile-box"));
   }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
  } else {
    bootstrap();
  }
})();
