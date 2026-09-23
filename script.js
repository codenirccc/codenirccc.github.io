/* ============================================================
   codenirccc.github.io — CAPTCHA configuration & handlers
   Replace the placeholder keys below with YOUR real site keys.
   ============================================================ */

const KEYS = {
  // Google reCAPTCHA admin: https://www.google.com/recaptcha/admin
  recaptchaV2SiteKey: "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI", // Google test key (always passes)
  recaptchaV2InvisibleSiteKey: "6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe", // Google test key (invisible)
  recaptchaV3SiteKey: "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI", // Google test key (v3)
  recaptchaSecret: "6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe", // test secret — server only

  // hCaptcha dashboard: https://dashboard.hcaptcha.com/
  hcaptchaSiteKey: "10000000-ffff-ffff-ffff-000000000001", // hCaptcha test key (always passes)
  hcaptchaSecret: "00000000-0000-0000-0000-000000000000", // test secret — server only

  // Cloudflare Turnstile: https://dash.cloudflare.com/?to=/:account/turnstile
  turnstileSiteKey: "3x00000000000000000000FF", // Cloudflare test key (always passes)
  turnstileSecret: "3x0000000000000000000000000000000AA", // test secret — server only
};

const tokens = {
  recaptchaV2: "",
  recaptchaV2Invisible: "",
  recaptchaV3: "",
  hcaptcha: "",
  turnstile: "",
  combo: "",
};

const $ = (id) => document.getElementById(id);

function setResult(id, msg, ok) {
  const el = $(id);
  if (!el) return;
  el.textContent = msg;
  el.className = "result " + (ok ? "ok" : "err");
}

document.addEventListener("DOMContentLoaded", () => {
  $("year").textContent = new Date().getFullYear();
  initWidgets();
  initForms();
  initComboTabs();
});

/* ---------------- widget rendering ---------------- */

function renderWidgets() {
  // reCAPTCHA v2 checkbox
  if (window.grecaptcha && $("recaptcha-v2-box")) {
    grecaptcha.render("recaptcha-v2-box", {
      sitekey: KEYS.recaptchaV2SiteKey,
      theme: "dark",
      callback: (t) => { tokens.recaptchaV2 = t; setResult("result-v2", "reCAPTCHA v2 verified.", true); },
      "expired-callback": () => { tokens.recaptchaV2 = ""; setResult("result-v2", "Token expired — re-check.", false); },
    });

    // combo panel — v2
    grecaptcha.render("combo-recaptcha-v2", {
      sitekey: KEYS.recaptchaV2SiteKey,
      theme: "dark",
      callback: (t) => { tokens.combo = t; },
      "expired-callback": () => { tokens.combo = ""; },
    });
  }

  // hCaptcha
  if (window.hcaptcha && $("hcaptcha-box")) {
    hcaptcha.render("hcaptcha-box", {
      sitekey: KEYS.hcaptchaSiteKey,
      theme: "dark",
      callback: (t) => { tokens.hcaptcha = t; setResult("result-hcaptcha", "hCaptcha verified.", true); },
      "expired-callback": () => { tokens.hcaptcha = ""; setResult("result-hcaptcha", "Token expired — re-check.", false); },
    });

    hcaptcha.render("combo-hcaptcha-box", {
      sitekey: KEYS.hcaptchaSiteKey,
      theme: "dark",
      callback: (t) => { tokens.combo = t; },
      "expired-callback": () => { tokens.combo = ""; },
    });
  }

  // Turnstile
  if (window.turnstile && $("turnstile-box")) {
    turnstile.render("turnstile-box", {
      sitekey: KEYS.turnstileSiteKey,
      theme: "dark",
      callback: (t) => { tokens.turnstile = t; setResult("result-turnstile", "Turnstile verified.", true); },
      "expired-callback": () => { tokens.turnstile = ""; setResult("result-turnstile", "Token expired — reload.", false); },
    });

    turnstile.render("combo-turnstile-box", {
      sitekey: KEYS.turnstileSiteKey,
      theme: "dark",
      callback: (t) => { tokens.combo = t; },
      "expired-callback": () => { tokens.combo = ""; },
    });
  }
}

function initWidgets() {
  // Widgets load async; poll briefly until all three SDKs are present.
  const needed = () =>
    typeof window.grecaptcha !== "undefined" &&
    typeof window.hcaptcha !== "undefined" &&
    typeof window.turnstile !== "undefined";

  let tries = 0;
  const t = setInterval(() => {
    tries += 1;
    if (needed() || tries > 100) {
      clearInterval(t);
      try {
        if (grecaptcha.ready) grecaptcha.ready(renderWidgets);
        else renderWidgets();
      } catch (_) {
        renderWidgets();
      }
    }
  }, 100);
}

/* ---------------- v3 execution ---------------- */

function runV3(action, cb) {
  if (!window.grecaptcha) { cb(null, "reCAPTCHA SDK not loaded"); return; }
  grecaptcha.ready(() => {
    grecaptcha.execute(KEYS.recaptchaV3SiteKey, { action })
      .then((token) => cb(token))
      .catch((e) => cb(null, String(e)));
  });
}

/* ---------------- invisible v2 callback (global) ---------------- */

function onInvisibleV2(token) {
  tokens.recaptchaV2Invisible = token;
  setResult("result-v2-invisible", "Invisible reCAPTCHA v2 verified.", true);
  // auto-submit now that token exists
  const form = $("form-v2-invisible");
  if (form && !form.dataset.done) {
    form.dataset.done = "1";
    form.requestSubmit ? form.requestSubmit() : form.submit();
  }
}
window.onInvisibleV2 = onInvisibleV2;

/* ---------------- forms ---------------- */

function initForms() {
  // v2 checkbox
  $("form-v2").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!tokens.recaptchaV2) { setResult("result-v2", "Please complete the reCAPTCHA checkbox.", false); return; }
    setResult("result-v2", "OK — token: " + tokens.recaptchaV2.slice(0, 24) + "… (send to server for siteverify)", true);
  });

  // v2 invisible — bind grecaptcha.execute to the submit button
  const invForm = $("form-v2-invisible");
  invForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (tokens.recaptchaV2Invisible) {
      setResult("result-v2-invisible", "OK — invisible token: " + tokens.recaptchaV2Invisible.slice(0, 24) + "…", true);
      invForm.dataset.done = "";
      return;
    }
    // trigger challenge
    const btn = invForm.querySelector("button");
    if (window.grecaptcha && btn) {
      const widgetId = grecaptcha.render(btn, {
        sitekey: KEYS.recaptchaV2InvisibleSiteKey,
        size: "invisible",
        callback: onInvisibleV2,
      });
      grecaptcha.execute(widgetId);
    } else {
      setResult("result-v2-invisible", "SDK not ready yet — try again.", false);
    }
  });

  // v3
  $("form-v3").addEventListener("submit", (e) => {
    e.preventDefault();
    runV3("submit", (token, err) => {
      if (err || !token) { setResult("result-v3", "v3 error: " + (err || "no token"), false); return; }
      tokens.recaptchaV3 = token;
      setResult("result-v3", "v3 token: " + token.slice(0, 24) + "…", true);

      // The real score comes from your server's siteverify response.
      // For demo visibility we show a placeholder estimate box.
      const box = $("v3-score");
      box.classList.remove("hidden");
      box.querySelector("span").textContent = "issued (verify server-side for score)";
      box.classList.toggle("low", false);
    });
  });

  // hCaptcha
  $("form-hcaptcha").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!tokens.hcaptcha) { setResult("result-hcaptcha", "Please complete hCaptcha.", false); return; }
    setResult("result-hcaptcha", "OK — token: " + tokens.hcaptcha.slice(0, 24) + "…", true);
  });

  // Turnstile
  $("form-turnstile").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!tokens.turnstile) { setResult("result-turnstile", "Please complete Turnstile.", false); return; }
    setResult("result-turnstile", "OK — token: " + tokens.turnstile.slice(0, 24) + "…", true);
  });

  // Combo
  $("form-combo").addEventListener("submit", (e) => {
    e.preventDefault();
    const active = document.querySelector(".combo-panel.active").id;
    if (active === "combo-v3") {
      runV3("combo_submit", (token, err) => {
        if (err || !token) { setResult("result-combo", "v3 error: " + (err || "no token"), false); return; }
        setResult("result-combo", "Combo v3 token issued: " + token.slice(0, 24) + "…", true);
      });
      return;
    }
    if (!tokens.combo) { setResult("result-combo", "Complete the active CAPTCHA first.", false); return; }
    setResult("result-combo", "OK (" + active + ") token: " + tokens.combo.slice(0, 24) + "…", true);
  });
}

/* ---------------- combo tabs ---------------- */

function initComboTabs() {
  const tabs = document.querySelectorAll(".tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".combo-panel").forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      $(tab.dataset.target).classList.add("active");
      tokens.combo = ""; // switching resets collected token
    });
  });
}
