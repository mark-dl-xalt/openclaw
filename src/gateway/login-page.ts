/**
 * Blue Lobster login page renderer.
 *
 * Exports a single function that returns the full HTML of the Blue Lobster
 * login page with the mascot image embedded as a base64 WebP data URI.
 * An optional message string is injected into the right panel to display
 * error/status messages (session_expired, access_denied, error).
 */

// WebP mascot image embedded as a base64 data URI so the login page has
// no external asset dependencies and works from any path.
export const MASCOT_DATA_URI =
  "data:image/webp;base64,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";

/**
 * Returns the full HTML string for the Blue Lobster login page.
 *
 * @param message - Optional HTML error/status message to display in the right
 *                  panel above the "Get started" heading.  Pass an empty string
 *                  when there is nothing to show.
 */
export function renderLoginPage(message: string): string {
  const messageHtml =
    message.length > 0
      ? `<div role="alert" style="margin-bottom:1rem;padding:0.75rem 1rem;background:#ffdad6;color:#93000a;border:1px solid #ba1a1a;border-radius:0.5rem;font-size:0.9rem;line-height:1.4;">${message}</div>`
      : "";

  return `<!DOCTYPE html>
<html class="light" lang="en">
<head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<meta name="description" content="Blue Lobster — OpenClaw for Atlassian teams. Native Rovo Dev integration, Atlassian OAuth login, your own managed instance. Built by XALT, Atlassian Platinum Partner."/>
<meta property="og:title" content="Blue Lobster — OpenClaw for Atlassian"/>
<meta property="og:description" content="OpenClaw with native Atlassian integration. Built by XALT, Atlassian Platinum Partner."/>
<meta property="og:type" content="website"/>
<title>Login | Blue Lobster</title>
<!-- Google Fonts: Manrope (headlines) + Outfit (body — replaces Inter per taste-skill) -->
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@700;800&family=Outfit:wght@400;500;600&display=swap" rel="stylesheet"/>
<!-- Material Symbols -->
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
<!-- Tailwind CSS -->
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<script id="tailwind-config">
  tailwind.config = {
    darkMode: "class",
    theme: {
      extend: {
        colors: {
          "error-container": "#ffdad6",
          "primary-fixed-dim": "#b2c5ff",
          "on-surface": "#191b23",
          "secondary": "#4c5d8d",
          "on-primary-container": "#c4d2ff",
          "on-error-container": "#93000a",
          "tertiary-fixed-dim": "#ffb3b1",
          "surface-container-high": "#e7e7f2",
          "secondary-fixed-dim": "#b4c5fb",
          "on-tertiary-fixed": "#410007",
          "surface": "#faf8ff",
          "surface-container-highest": "#e1e2ec",
          "on-secondary-fixed": "#021945",
          "on-secondary-container": "#415382",
          "on-primary-fixed-variant": "#0040a2",
          "tertiary-fixed": "#ffdad8",
          "on-tertiary-fixed-variant": "#92001c",
          "on-error": "#ffffff",
          "on-surface-variant": "#434654",
          "outline": "#737685",
          "surface-dim": "#d9d9e4",
          "primary-container": "#0052cc",
          "error": "#ba1a1a",
          "on-primary": "#ffffff",
          "on-tertiary": "#ffffff",
          "on-background": "#191b23",
          "surface-container": "#ededf8",
          "on-tertiary-container": "#ffc5c3",
          "surface-container-low": "#f3f3fd",
          "tertiary": "#8c001b",
          "secondary-fixed": "#dae2ff",
          "background": "#faf8ff",
          "surface-tint": "#0c56d0",
          "on-secondary-fixed-variant": "#344573",
          "inverse-on-surface": "#f0f0fb",
          "surface-container-lowest": "#ffffff",
          "on-secondary": "#ffffff",
          "secondary-container": "#b6c8fe",
          "primary-fixed": "#dae2ff",
          "surface-bright": "#faf8ff",
          "on-primary-fixed": "#001848",
          "tertiary-container": "#b60f29",
          "outline-variant": "#c3c6d6",
          "surface-variant": "#e1e2ec",
          "primary": "#003d9b",
          "inverse-surface": "#2e3038",
          "inverse-primary": "#b2c5ff"
        },
        fontFamily: {
          "headline": ["Manrope", "system-ui", "sans-serif"],
          "body": ["Outfit", "system-ui", "sans-serif"],
          "label": ["Outfit", "system-ui", "sans-serif"]
        },
        borderRadius: {
          "DEFAULT": "0.25rem",
          "lg": "0.5rem",
          "xl": "0.75rem",
          "2xl": "1rem",
          "3xl": "1.5rem",
          "4xl": "2rem",
          "full": "9999px"
        },
        keyframes: {
          "fade-up": {
            "0%": { opacity: "0", transform: "translateY(20px)" },
            "100%": { opacity: "1", transform: "translateY(0)" }
          },
          "fade-in": {
            "0%": { opacity: "0" },
            "100%": { opacity: "1" }
          },
          "float": {
            "0%, 100%": { transform: "translateY(0px)" },
            "50%": { transform: "translateY(-8px)" }
          },
          "shimmer": {
            "0%": { backgroundPosition: "-200% 0" },
            "100%": { backgroundPosition: "200% 0" }
          }
        },
        animation: {
          "fade-up": "fade-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards",
          "fade-up-delay-1": "fade-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.1s forwards",
          "fade-up-delay-2": "fade-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.2s forwards",
          "fade-up-delay-3": "fade-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.3s forwards",
          "fade-up-delay-4": "fade-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.4s forwards",
          "fade-up-delay-5": "fade-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.5s forwards",
          "fade-in": "fade-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.6s forwards",
          "float": "float 6s ease-in-out infinite"
        }
      },
    },
  }
</script>
<style>
  .material-symbols-outlined {
    font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
  }

  /* Primary gradient — tinted to brand, not generic */
  .primary-gradient {
    background: linear-gradient(135deg, #0052cc 0%, #003d9b 100%);
  }

  /* True glassmorphism: blur + inner refraction border + inner shadow */
  .glass-effect {
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }

  /* Noise/grain overlay — fixed, no repaint on scroll */
  .grain-overlay::after {
    content: "";
    position: fixed;
    inset: 0;
    z-index: 50;
    pointer-events: none;
    opacity: 0.025;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    background-repeat: repeat;
    background-size: 256px 256px;
  }

  /* Staggered entry — elements start invisible */
  .stagger-entry { opacity: 0; }

  /* CTA hover glow — tinted to primary, not generic box-shadow */
  .cta-glow {
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .cta-glow:hover {
    box-shadow: 0 8px 32px -4px rgba(0, 61, 155, 0.35),
                0 4px 12px -2px rgba(0, 82, 204, 0.2);
    transform: translateY(-1px);
  }
  .cta-glow:active {
    transform: translateY(0px) scale(0.98);
    box-shadow: 0 4px 16px -4px rgba(0, 61, 155, 0.25);
  }

  /* Mascot hover — spring-like return via CSS */
  .mascot-float {
    transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .mascot-float:hover {
    transform: translateY(-6px) rotate(-1deg);
  }

  /* Ambient radial glow behind hero panel */
  .ambient-glow {
    background: radial-gradient(ellipse 80% 60% at 20% 80%, rgba(0, 82, 204, 0.06) 0%, transparent 70%),
                radial-gradient(ellipse 60% 40% at 80% 20%, rgba(0, 61, 155, 0.04) 0%, transparent 60%);
  }

  /* Link hover with underline animation */
  .link-reveal {
    position: relative;
    text-decoration: none;
  }
  .link-reveal::after {
    content: "";
    position: absolute;
    bottom: -2px;
    left: 0;
    width: 0;
    height: 1.5px;
    background: currentColor;
    transition: width 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .link-reveal:hover::after {
    width: 100%;
  }

  /* Smooth scrolling */
  html { scroll-behavior: smooth; }

  /* Text wrap balance for headlines */
  h1, h2 { text-wrap: balance; }
</style>
</head>

<body class="bg-surface text-on-surface font-body min-h-[100dvh] flex flex-col grain-overlay">

<!-- Skip to content — accessibility -->
<a href="#login-panel" class="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-lg focus:font-medium">
  Skip to login
</a>

<main class="flex-grow flex items-center justify-center p-5 lg:p-12">
<div class="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-0 overflow-hidden rounded-4xl bg-surface-container-lowest shadow-[0_24px_64px_-16px_rgba(25,27,35,0.08),0_8px_24px_-8px_rgba(0,61,155,0.06)]">

  <!-- Left: Hero panel — asymmetric, editorial, atmospheric -->
  <div class="relative bg-surface-container-low p-10 lg:p-14 flex flex-col justify-between overflow-hidden ambient-glow">

    <!-- Brand wordmark -->
    <div class="relative z-10 stagger-entry animate-fade-up">
      <div class="flex items-center gap-3">
        <span class="text-2xl font-black text-primary tracking-tighter font-headline">Blue Lobster</span>
        <span class="h-4 w-px bg-outline-variant/40"></span>
        <div class="flex items-center gap-2">
          <span class="text-[10px] uppercase tracking-[0.2em] font-semibold text-outline">by XALT</span>
          <span class="text-outline-variant/40">·</span>
          <span class="font-headline text-[10px] font-bold text-on-surface-variant uppercase tracking-[0.15em]">Atlassian Platinum Partner</span>
        </div>
      </div>
    </div>

    <!-- Hero copy -->
    <div class="relative z-10 mt-16 lg:mt-20">
      <h1 class="font-headline text-[2.75rem] lg:text-5xl font-extrabold tracking-tighter text-on-surface leading-[1.05] mb-6 stagger-entry animate-fade-up-delay-1">
        OpenClaw + Atlassian. <span class="bg-clip-text text-transparent bg-gradient-to-r from-primary-container to-primary">Finally together.</span>
      </h1>
      <p class="text-base lg:text-lg text-on-surface-variant max-w-[42ch] leading-relaxed font-medium stagger-entry animate-fade-up-delay-2">
        Blue Lobster is OpenClaw with native Atlassian integration. Sign in with Atlassian, and Rovo Dev works with your Jira issues, Confluence pages, and Teamwork Graph. Your own instance, your data.
      </p>
    </div>

    <!-- Mascot — floating, no container, spring-hover -->
    <div class="relative z-10 mt-14 flex justify-center stagger-entry animate-fade-up-delay-3">
      <img
        alt="The Blue Lobster mascot — a blue creature in a yellow hoodie at a desk."
        class="w-full max-w-[320px] h-auto mascot-float animate-float drop-shadow-[0_16px_32px_rgba(0,61,155,0.12)]"
        src="${MASCOT_DATA_URI}"
      />
    </div>

    <!-- Trust badge -->
    <div class="relative z-10 mt-10 flex items-center gap-3 stagger-entry animate-fade-up-delay-4">
      <span class="material-symbols-outlined text-primary/60 text-lg">verified_user</span>
      <span class="text-sm text-on-surface-variant/60 font-medium tracking-wide">Hosted on Hetzner Germany. Atlassian OAuth2. Your data stays on your instance.</span>
    </div>
  </div>

  <!-- Right: Login panel — clean, single-action, authoritative -->
  <div id="login-panel" class="bg-surface-container-lowest p-10 lg:p-16 flex flex-col justify-center relative">
    <div class="max-w-sm mx-auto w-full">

      ${messageHtml}

      <!-- Heading -->
      <div class="mb-12 text-center lg:text-left stagger-entry animate-fade-up-delay-2">
        <h2 class="font-headline text-3xl font-bold tracking-tighter text-on-surface mb-3">Get started</h2>
        <p class="text-on-surface-variant font-medium">One click connects your Jira, Confluence, and Rovo Dev.</p>
        <p class="text-sm text-on-surface-variant/70 mt-4 leading-relaxed">OpenClaw, built for Atlassian teams. Powered by Rovo Dev.</p>
      </div>

      <!-- CTA — single dominant action -->
      <div class="stagger-entry animate-fade-up-delay-3">
        <a href="/auth/atlassian"
           class="w-full flex items-center justify-center gap-3 py-4 px-8 rounded-full
                  bg-primary-container text-white font-headline font-bold text-lg
                  cta-glow shadow-[0_4px_16px_-4px_rgba(0,61,155,0.3)]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M7.128 18.064c-.268.268-.16.716.204.812A9.953 9.953 0 0012 20c5.523 0 10-4.477 10-10S17.523 0 12 0a9.953 9.953 0 00-4.668 1.124c-.364.096-.472.544-.204.812l4.308 4.308a1 1 0 010 1.414l-4.308 4.308a1 1 0 000 1.414l4.308 4.308a1 1 0 010 1.414l-4.308 4.308z" fill="currentColor" opacity="0.9"/>
            <path d="M6.564 5.936L2.256 10.244a1 1 0 000 1.414l4.308 4.308c.268.268.716.16.812-.204A9.953 9.953 0 016 12c0-1.244.227-2.436.644-3.538.096-.364-.012-.756-.28-1.024l-.8-.8-.8-.8c-.268-.268-.716-.16-.812.204A9.922 9.922 0 004 10c0 .698.072 1.38.208 2.036" fill="currentColor" opacity="0.5"/>
          </svg>
          <span>Log in with Atlassian</span>
        </a>
      </div>

      <!-- Secondary links -->
      <div class="mt-14 text-center lg:text-left space-y-5 stagger-entry animate-fade-up-delay-4">
        <p class="text-sm text-on-surface-variant">
          Want your own instance? <a class="text-primary font-semibold link-reveal" href="#">Request early access</a>
        </p>
        <div class="flex flex-wrap justify-center lg:justify-start gap-5">
          <a class="text-xs font-medium text-outline hover:text-primary transition-colors duration-300" href="#">Security</a>
          <a class="text-xs font-medium text-outline hover:text-primary transition-colors duration-300" href="#">Help</a>
          <a class="text-xs font-medium text-outline hover:text-primary transition-colors duration-300" href="#">Privacy</a>
        </div>
      </div>
    </div>
  </div>

</div>
</main>

<!-- Footer — minimal, clean -->
<footer class="w-full py-8 px-8 flex flex-col md:flex-row justify-between items-center gap-4">
  <div class="flex items-center gap-3">
    <span class="font-headline font-bold text-on-surface text-sm">Blue Lobster</span>
    <span class="text-outline-variant/40">by</span>
    <span class="font-body text-xs tracking-wide text-on-surface-variant/60">XALT Business Consulting GmbH</span>
    <span class="text-outline-variant/40">/</span>
    <p class="font-body text-xs tracking-wide text-on-surface-variant/60">2026. Built on OpenClaw.</p>
  </div>
  <div class="flex gap-5">
    <a class="font-body text-xs text-on-surface-variant/50 hover:text-primary transition-colors duration-300" href="#">Privacy</a>
    <a class="font-body text-xs text-on-surface-variant/50 hover:text-primary transition-colors duration-300" href="#">Terms</a>
    <a class="font-body text-xs text-on-surface-variant/50 hover:text-primary transition-colors duration-300" href="#">Security</a>
  </div>
</footer>

</body>
</html>`;
}
