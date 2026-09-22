/*
 * Unsupported Browser Fallback
 * Authored in pure ES3. DO NOT introduce ES2015+ syntax.
 */
(function() {
    var APPLICATION_DOMAIN_TO_ID = {
        "spicychat.ai": "spicychat",
        "pixelchat.ai": "pixelchat",
        "secretmate.ai": "secretmate",
        "roleplay.adulttime.com": "adulttime_application",
        "roleplay.evilangel.com": "evil_angel",
        "roleplay.asgmax.com": "asg_max",
    };

    var APPLICATION_ID_TO_LOGO_FILE = {
        spicychat: "spicychat.png",
        pixelchat: "pixelchat.png",
        secretmate: "secretmate.png",
        adulttime_application: "adulttime.png",
        evil_angel: "evilangel.png",
        asg_max: "asgmax.png",
    };

    var LEGACY_BROWSERS_FALLBACK_GA_ID = "G-HNDD06M469";
    var LOGO_BASE_PATH = "/Assets/logos/";
    var DEFAULT_APPLICATION_ID = "spicychat";

    function getApplicationId() {
        var hostname = window.location.hostname;
        for (var domain in APPLICATION_DOMAIN_TO_ID) {
            if (APPLICATION_DOMAIN_TO_ID.hasOwnProperty(domain) && hostname.indexOf(domain) !== -1) {
                return APPLICATION_DOMAIN_TO_ID[domain];
            }
        }
        return DEFAULT_APPLICATION_ID;
    }

    function getLogoUrl() {
        var applicationId = getApplicationId();
        var logoFile = APPLICATION_ID_TO_LOGO_FILE[applicationId] || APPLICATION_ID_TO_LOGO_FILE[DEFAULT_APPLICATION_ID];
        return LOGO_BASE_PATH + logoFile;
    }

    function supportsRegexUnicodePropertyEscapes() {
        try {
            new RegExp("\\p{Letter}", "u");
            return true;
        } catch (regexError) {
            return false;
        }
    }

    // For Safari <=13.1
    function supportsMatchMediaAddEventListener() {
        if (typeof window.matchMedia !== "function") return false;
        try {
            var mediaQuery = window.matchMedia("(min-width: 0px)");
            return mediaQuery && typeof mediaQuery.addEventListener === "function";
        } catch (matchMediaError) {
            return false;
        }
    }

    // For Chrome <=79, Opera <=66 — required by modernTargets "since 2021" bundle
    function supportsOptionalChaining() {
        try {
            Function("return null?.x")();
            return true;
        } catch (syntaxError) {
            return false;
        }
    }

    function isBrowserSupported() {
        return (
            typeof Promise !== "undefined" &&
            typeof Promise.allSettled === "function" &&
            typeof Symbol !== "undefined" &&
            typeof Object.assign === "function" &&
            typeof window.fetch === "function" &&
            typeof window.Proxy !== "undefined" &&
            typeof globalThis !== "undefined" &&
            supportsRegexUnicodePropertyEscapes() &&
            supportsMatchMediaAddEventListener() &&
            supportsOptionalChaining()
        );
    }

    function injectFallbackGoogleAnalytics() {
        var head = document.getElementsByTagName("head")[0];
        if (!head) return;
        var gtagScript = document.createElement("script");
        gtagScript.async = true;
        gtagScript.src = "https://www.googletagmanager.com/gtag/js?id=" + LEGACY_BROWSERS_FALLBACK_GA_ID;
        head.appendChild(gtagScript);
        window.dataLayer = window.dataLayer || [];
        window.gtag =
            window.gtag ||
            function() {
                window.dataLayer.push(arguments);
            };
        window.gtag("js", new Date());
        window.gtag("config", LEGACY_BROWSERS_FALLBACK_GA_ID);
    }

    function buildBannerHtml() {
        var logoUrl = getLogoUrl();
        return (
            '<div style="height:100vh;background:#000;display:flex;align-items:center;justify-content:center;color:#fff;padding:16px;">' +
            '<div style="background:#1a1a1a;border-radius:12px;padding:24px;max-width:400px;width:100%;font-family:Arial,sans-serif;">' +
            '<img src="' +
            logoUrl +
            '" alt="" height="28" style="margin-bottom:18px;" onerror="this.style.display=\'none\'" />' +
            '<h2 style="margin-bottom:18px;">Unable to load the app</h2>' +
            '<p style="color:#9a9a9a;line-height:1.5;">Your current browser, device or app version is not supported. Please update the app or switch to a supported device/browser.</p>' +
            "</div>" +
            "</div>"
        );
    }

    function renderBannerWhenReady() {
        function renderBanner() {
            var rootElement = document.getElementById("root");
            if (rootElement) {
                rootElement.innerHTML = buildBannerHtml();
            } else if (document.body) {
                document.body.innerHTML = buildBannerHtml();
            }
        }
        if (document.readyState === "interactive" || document.readyState === "complete") {
            renderBanner();
            return;
        }
        if (document.addEventListener) {
            document.addEventListener("DOMContentLoaded", renderBanner);
        } else {
            document.attachEvent("onreadystatechange", function() {
                if (document.readyState === "complete") renderBanner();
            });
        }
    }

    function triggerUnsupportedBrowserFallback() {
        if (window.__UNSUPPORTED_BROWSER__) return;
        window.__UNSUPPORTED_BROWSER__ = true;
        injectFallbackGoogleAnalytics();
        renderBannerWhenReady();
    }

    if (!isBrowserSupported()) {
        triggerUnsupportedBrowserFallback();
    }
})();