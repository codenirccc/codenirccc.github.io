const SPICYCHAT_DOMAIN = "spicychat.ai";
const PIXELCHAT_DOMAIN = "pixelchat.ai";
const ADULTTIME_DOMAIN = "roleplay.adulttime.com";
const EVIL_ANGEL_DOMAIN = "roleplay.evilangel.com";
const ASG_MAX_DOMAIN = "roleplay.asgmax.com";
const SPICYCHAT_PAGES_DEV_DOMAIN = "spicychat-frontend.pages.dev";
const Localhost_DOMAIN = "localhost";

const SPICYCHAT_APPLICATION_ID = "spicychat";
const PIXELCHAT_APPLICATION_ID = "pixelchat";
const ADULTTIME_APPLICATION_ID = "adulttime_application";
const EVIL_ANGEL_APPLICATION_ID = "evil_angel";
const ASG_MAX_APPLICATION_ID = "asg_max";

const VERSION = "1.0.1"; // Update this version when icons are updated to bust cache and rename the folder to match the version

// List of icon sizes
const sizes = ["57x57", "72x72", "76x76", "114x114", "120x120", "144x144", "152x152", "180x180"];

const APPLICATION_DOMAIN_TO_ID = {
  [SPICYCHAT_DOMAIN]: SPICYCHAT_APPLICATION_ID,
  [PIXELCHAT_DOMAIN]: PIXELCHAT_APPLICATION_ID,
  [ADULTTIME_DOMAIN]: ADULTTIME_APPLICATION_ID,
  [EVIL_ANGEL_DOMAIN]: EVIL_ANGEL_APPLICATION_ID,
  [ASG_MAX_DOMAIN]: ASG_MAX_APPLICATION_ID,
  [SPICYCHAT_PAGES_DEV_DOMAIN]: SPICYCHAT_APPLICATION_ID, // for Cloudflare Pages
  [Localhost_DOMAIN]: SPICYCHAT_APPLICATION_ID, // for localhost
};

function getApplicationFromLocation() {
  const domain = window.location.hostname;
  for (const application of Object.entries(APPLICATION_DOMAIN_TO_ID)) {
    const [applicationDomain, applicationId] = application;
    if (domain.includes(applicationDomain)) {
      return applicationId;
    }
  }
  return undefined;
}

const injectAppleTouchIcons = (applicationName) => {
  if (!applicationName) {
    return;
  }
  // Remove existing apple-touch-icon links to avoid duplicates
  document.querySelectorAll('link[rel="apple-touch-icon"]').forEach((el) => el.remove());

  // Add each icon size
  sizes.forEach((size) => {
    const link = document.createElement("link");
    link.rel = "apple-touch-icon";
    link.sizes = size;
    link.href = `/Assets/siteicons/${VERSION}/${applicationName}/apple-touch-icon-${size}.png`;
    document.head.appendChild(link);
  });

  // Add default icon (no size)
  const defaultLink = document.createElement("link");
  defaultLink.rel = "apple-touch-icon";
  defaultLink.href = `/Assets/siteicons/${VERSION}/${applicationName}/apple-touch-icon.png`;
  document.head.appendChild(defaultLink);
};

const injectFavicon = (applicationName) => {
  if (!applicationName) {
    return;
  }

  // Remove existing favicon links to avoid duplicates
  document.querySelectorAll('link[rel="icon"]').forEach((el) => el.remove());

  // Add favicon link
  const faviconLink = document.createElement("link");
  faviconLink.rel = "icon";
  faviconLink.type = "image/x-icon";
  faviconLink.href = `/Assets/siteicons/${VERSION}/${applicationName}/favicon.ico`;
  faviconLink.sizes = "32x32";
  document.head.appendChild(faviconLink);
};

const applicationName = getApplicationFromLocation();

// set apple touch icons
injectAppleTouchIcons(applicationName);

// set favicon
injectFavicon(applicationName);
