/**
 * Blue Lobster integrations page renderer.
 *
 * Exports a single function that returns the full HTML of the Blue Lobster
 * integrations page. Data (Atlassian identity, Rovo Dev status) is loaded
 * client-side via fetch to /auth/atlassian/atlassian-identity and
 * /auth/atlassian/rovo-status. No server-side data injection needed.
 *
 * NOTE: The mascot image src references ../stitch-login/blue-lobster-mascot-nobg.png.
 * This relative path is a known placeholder — it will be replaced with a data URI
 * (matching the login-page.ts pattern) once the image asset is wired.
 */

import { MASCOT_DATA_URI } from "./login-page.js";

export function renderIntegrationsPage(): string {
  return `<!DOCTYPE html>

<html lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<meta name="description" content="Blue Lobster — Manage your Atlassian integrations and Rovo Dev connection. Built by XALT, Atlassian Platinum Partner."/>
<title>Integrations | Blue Lobster</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&amp;family=Outfit:wght@400;500;600&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script id="tailwind-config">
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    colors: {
                        "outline": "#737685",
                        "on-primary-fixed": "#001848",
                        "on-primary-container": "#c4d2ff",
                        "on-background": "#191b23",
                        "surface-dim": "#d9d9e4",
                        "primary-fixed": "#dae2ff",
                        "on-surface": "#191b23",
                        "secondary": "#4c5d8d",
                        "on-primary": "#ffffff",
                        "surface-variant": "#e1e2ec",
                        "surface-container-low": "#f3f3fd",
                        "surface-bright": "#faf8ff",
                        "primary-fixed-dim": "#b2c5ff",
                        "on-secondary-fixed-variant": "#344573",
                        "primary": "#003d9b",
                        "tertiary-fixed": "#ffdad8",
                        "secondary-fixed-dim": "#b4c5fb",
                        "secondary-fixed": "#dae2ff",
                        "surface-container-lowest": "#ffffff",
                        "primary-container": "#0052cc",
                        "on-secondary": "#ffffff",
                        "background": "#faf8ff",
                        "inverse-on-surface": "#f0f0fb",
                        "on-tertiary-fixed": "#410007",
                        "on-error-container": "#93000a",
                        "on-error": "#ffffff",
                        "on-surface-variant": "#434654",
                        "tertiary-container": "#b60f29",
                        "inverse-primary": "#b2c5ff",
                        "surface": "#faf8ff",
                        "on-tertiary-container": "#ffc5c3",
                        "tertiary": "#8c001b",
                        "secondary-container": "#b6c8fe",
                        "on-secondary-container": "#415382",
                        "inverse-surface": "#2e3038",
                        "on-tertiary": "#ffffff",
                        "outline-variant": "#c3c6d6",
                        "surface-tint": "#0c56d0",
                        "on-secondary-fixed": "#021945",
                        "tertiary-fixed-dim": "#ffb3b1",
                        "surface-container-high": "#e7e7f2",
                        "surface-container": "#ededf8",
                        "error": "#ba1a1a",
                        "error-container": "#ffdad6",
                        "on-primary-fixed-variant": "#0040a2",
                        "on-tertiary-fixed-variant": "#92001c"
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
            vertical-align: middle;
        }

        /* Primary gradient — tinted to brand blue, not generic */
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

        /* Ambient radial glow behind hero — replaces crude positioned blur div */
        .ambient-glow {
            background: radial-gradient(ellipse 80% 60% at 20% 80%, rgba(0, 82, 204, 0.06) 0%, transparent 70%),
                        radial-gradient(ellipse 60% 40% at 80% 20%, rgba(0, 61, 155, 0.04) 0%, transparent 60%);
        }

        /* Link hover with underline-grow animation */
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

        html { scroll-behavior: smooth; }
        h1, h2 { text-wrap: balance; }

        /* Collapsible token update form — max-height transition for smooth reveal */
        .rovo-update-form {
            overflow: hidden;
            max-height: 0;
            transition: max-height 0.35s cubic-bezier(0.16, 1, 0.3, 1),
                        opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1);
            opacity: 0;
        }
        .rovo-update-form.expanded {
            max-height: 220px;
            opacity: 1;
        }

        /* Token update success message fade-out */
        @keyframes token-success-fade {
            0%   { opacity: 1; }
            70%  { opacity: 1; }
            100% { opacity: 0; }
        }
        .token-success-fade {
            animation: token-success-fade 3s ease-out forwards;
        }
    </style>
</head>
<body class="bg-surface text-on-surface font-body min-h-screen grain-overlay">
<!-- TopNavBar — glass-effect for frosted-glass premium feel -->
<nav class="fixed top-0 w-full z-50 bg-surface/70 dark:bg-[#191b23]/70 glass-effect flex justify-between items-center px-8 py-3">
<div class="flex items-center gap-8">
<div class="flex items-center gap-2">
  <span class="text-2xl font-black text-primary dark:text-primary-container tracking-tighter font-headline">Blue Lobster</span>
  <span class="h-4 w-px bg-outline-variant/40"></span>
  <span class="text-[10px] uppercase tracking-[0.2em] font-semibold text-outline">by XALT</span>
</div>
<div class="hidden md:flex gap-6">
<a class="text-on-surface-variant dark:text-[#a0a3af] pointer-events-none opacity-50 font-headline font-semibold tracking-tight" href="#">Dashboard</a>
<a class="text-primary font-headline font-semibold tracking-tight" href="#">Integrations</a>
<a class="text-on-surface-variant dark:text-[#a0a3af] pointer-events-none opacity-50 font-headline font-semibold tracking-tight" href="#">Settings</a>
<a class="text-on-surface-variant dark:text-[#a0a3af] pointer-events-none opacity-50 font-headline font-semibold tracking-tight" href="#">Team</a>
</div>
</div>
<div class="flex items-center gap-4">
<button class="p-2 hover:bg-surface-container-low/50 dark:hover:bg-[#2a2c38]/50 transition-colors active:scale-95 duration-200 rounded-full">
<span class="material-symbols-outlined text-on-surface-variant">notifications</span>
</button>
<button class="p-2 hover:bg-surface-container-low/50 dark:hover:bg-[#2a2c38]/50 transition-colors active:scale-95 duration-200 rounded-full">
<span class="material-symbols-outlined text-on-surface-variant">help</span>
</button>
<div id="identity-avatar-initials" class="w-8 h-8 rounded-full bg-primary-fixed text-primary font-headline font-bold text-sm flex items-center justify-center">B</div>
<form id="signout-btn" method="POST" action="/auth/atlassian/signout" style="display:inline">
  <button type="submit" class="text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors duration-300 link-reveal">Sign Out</button>
</form>
</div>
</nav>
<!-- Main Content -->
<main class="pt-24 pb-16 px-6 md:px-12 max-w-[1400px] mx-auto">
<!-- Hero Success Section — ambient-glow replaces the crude positioned blur div -->
<!-- The hero is composed of two zones: left copy + right mascot accent. No blob div needed. -->
<header class="mb-12 flex flex-col md:flex-row items-center gap-8 bg-surface-container-low rounded-2xl p-8 relative overflow-hidden ambient-glow">
<div class="z-10 flex-1">
<div class="flex items-center gap-3 mb-4">
<!-- TASTE DECISION 5 (revised): CONNECTION VERIFIED badge uses primary-fixed (blue tint) — success/positive signal. Red (tertiary-container) was incorrect; red reads as error/danger. -->
<span class="stagger-entry animate-fade-up bg-primary-fixed text-primary px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Connection Verified</span>
</div>
<h1 class="stagger-entry animate-fade-up-delay-1 text-4xl md:text-5xl font-headline font-extrabold text-primary tracking-tighter mb-4">You're connected.</h1>
<p class="stagger-entry animate-fade-up-delay-2 text-on-surface-variant text-lg max-w-2xl leading-relaxed">Manage your Atlassian connection, Rovo Dev integration, and AI capabilities.</p>
</div>
<!-- TASTE DECISION 4: Small mascot accent at 200px — brand presence without stealing focus from config -->
<div class="z-10 stagger-entry animate-fade-up-delay-2">
<img
  alt="The Blue Lobster mascot — a friendly blue creature in a yellow hoodie."
  class="max-w-[200px] w-full h-auto mascot-float animate-float drop-shadow-[0_12px_24px_rgba(0,61,155,0.10)]"
  src="${MASCOT_DATA_URI}"
/>
</div>
<!-- No positioned blob div — ambient-glow CSS class handles background atmosphere -->
</header>
<div class="grid grid-cols-1 lg:grid-cols-12 gap-8">
<!-- Left Column: Atlassian Profile & Connected Sites -->
<div class="lg:col-span-5 space-y-8">
<!-- Atlassian Profile Card -->
<section class="stagger-entry animate-fade-up-delay-2 bg-surface-container-lowest p-8 rounded-2xl shadow-[0_2px_8px_-2px_rgba(0,61,155,0.05)]">
<h2 class="text-xl font-headline font-bold text-on-surface mb-6 flex items-center gap-2">
<span class="material-symbols-outlined text-primary">account_circle</span>
                        Your Atlassian Account
                    </h2>
<!-- identity-skeleton: visible by default while data loads -->
<div id="identity-skeleton" class="animate-pulse space-y-3">
  <div class="flex items-center gap-4 p-4 bg-surface-container-low rounded-xl">
    <div class="w-12 h-12 bg-surface-container rounded-xl flex-shrink-0"></div>
    <div class="flex-1 space-y-2">
      <div class="h-4 bg-surface-container rounded-full w-2/3"></div>
      <div class="h-3 bg-surface-container rounded-full w-1/2"></div>
    </div>
  </div>
</div>
<!-- identity-content: hidden until data loads -->
<div id="identity-content" class="hidden">
<div class="flex items-center gap-4 p-4 bg-surface-container-low rounded-xl hover:bg-surface-container transition-all duration-300">
<div class="w-12 h-12 rounded-xl bg-primary-fixed text-primary font-headline font-bold text-lg flex items-center justify-center flex-shrink-0">
  <span id="identity-avatar-card-initials">?</span>
</div>
<div>
<p id="identity-name" class="font-bold text-on-surface"></p>
<p id="identity-email" class="text-sm text-on-surface-variant"></p>
</div>
</div>
</div>
<!-- identity-error: hidden by default, shown on fetch failure -->
<div id="identity-error" class="hidden text-on-surface-variant text-sm mt-2">Could not load profile — try refreshing.</div>
</section>
<!-- Connected Sites -->
<section class="stagger-entry animate-fade-up-delay-3 bg-surface-container-lowest p-8 rounded-2xl shadow-[0_2px_8px_-2px_rgba(0,61,155,0.05)]">
<div class="flex justify-between items-center mb-6">
<h2 class="text-xl font-headline font-bold text-on-surface flex items-center gap-2">
<span class="material-symbols-outlined text-primary">hub</span>
                            Accessible Sites
                        </h2>
<!-- link-reveal replaces hover:underline -->
<button class="text-primary text-sm font-semibold link-reveal transition-colors duration-300">Manage</button>
</div>
<!-- sites-list: empty by default, populated by fetchIdentity() -->
<ul id="sites-list" class="space-y-3"></ul>
<!-- sites-empty: hidden by default, shown when accessibleResources is empty -->
<p id="sites-empty" class="hidden text-sm text-on-surface-variant">No connected sites found.</p>
</section>
</div>
<!-- Right Column: Rovo Dev AI Configuration -->
<div class="lg:col-span-7">
<section class="stagger-entry animate-fade-up-delay-3 bg-surface-container-lowest p-8 rounded-2xl shadow-[0_2px_8px_-2px_rgba(0,61,155,0.05)] h-full">
<div class="flex justify-between items-start mb-8">
<div>
<h2 class="text-2xl font-headline font-extrabold text-on-surface mb-2">Rovo Dev</h2>
<p class="text-on-surface-variant">Rovo Dev connects to your Atlassian Teamwork Graph — giving your AI real access to Jira issues, Confluence docs, and Bitbucket repos. It doesn't just read ticket titles. It understands project relationships, sprint context, and cross-team dependencies.</p>
</div>
<!-- rovo-status-badge: updated by fetchRovoStatus() -->
<span id="rovo-status-badge" class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-surface-container text-on-surface-variant"></span>
</div>
<!-- rovo-skeleton: visible by default while status loads -->
<div id="rovo-skeleton" class="animate-pulse space-y-4">
  <div class="h-4 bg-surface-container rounded-full w-1/3"></div>
  <div class="h-12 bg-surface-container rounded-xl w-full"></div>
  <div class="h-10 bg-surface-container rounded-full w-1/4 ml-auto"></div>
</div>
<!-- rovo-connected-state: hidden by default, shown when connected -->
<div id="rovo-connected-state" class="hidden space-y-6">
<div class="flex items-center gap-3 p-4 bg-surface-container-low rounded-xl">
  <span class="material-symbols-outlined text-primary">verified</span>
  <div>
    <p class="text-sm font-bold text-on-surface">Rovo Dev connected</p>
    <p class="text-xs text-on-surface-variant"><span id="rovo-email"></span></p>
  </div>
</div>
<!-- Management actions row — secondary controls, right-aligned, not prominent -->
<div class="flex items-center justify-end gap-6 -mt-2">
  <!-- "Token updated" success confirmation — hidden until after a successful update -->
  <span id="rovo-token-success" class="hidden flex items-center gap-1.5 text-sm font-semibold text-primary">
    <span class="material-symbols-outlined text-sm" style="font-size:1rem">check_circle</span>
    Token updated
  </span>
  <!-- Update API Token toggle — subtle text link with expand icon -->
  <button id="rovo-toggle-token-btn" type="button" class="inline-flex items-center gap-1 text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors duration-200 link-reveal" aria-expanded="false" aria-controls="rovo-update-token-form">
    Update API Token
    <span class="material-symbols-outlined" style="font-size:1.1rem;vertical-align:middle">expand_more</span>
  </button>
  <!-- Disconnect link — findable but not alarming -->
  <button id="rovo-disconnect-btn" type="button" class="text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors duration-200 link-reveal" aria-label="Disconnect Rovo Dev">
    Disconnect
  </button>
</div>
<!-- Collapsible token update form — hidden by default, expands on toggle -->
<div id="rovo-update-token-form" class="rovo-update-form" role="region" aria-label="Update API Token">
  <div class="pt-1 space-y-3">
    <label class="block text-xs font-bold text-on-surface-variant uppercase tracking-wider" for="atat-update-input">New API Token</label>
    <p class="text-xs text-on-surface-variant">
      Need a new token? Create one in your
      <a href="https://go.atlassian.com/rovo-dev-api-token" target="_blank" rel="noopener noreferrer" class="font-semibold link-reveal inline-flex items-center gap-0.5" aria-label="Open Atlassian API token page (opens in new tab)">Atlassian account<span class="material-symbols-outlined" style="font-size:0.85rem;vertical-align:middle">open_in_new</span></a>.
    </p>
    <div class="relative group">
      <input id="atat-update-input" class="w-full bg-surface-variant border-0 rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary transition-all font-mono text-sm" placeholder="Paste your new API token" type="password" aria-label="New Rovo Dev API token"/>
      <button id="atat-update-toggle-visibility" type="button" class="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors duration-200" aria-label="Toggle token visibility">
        <span class="material-symbols-outlined">visibility</span>
      </button>
    </div>
    <!-- atat-update-error: hidden by default, shown on failure -->
    <p id="atat-update-error" class="hidden text-sm text-error"></p>
    <div class="flex justify-end pt-1">
      <button id="atat-update-submit" type="button" class="px-6 py-2.5 primary-gradient text-white text-sm font-bold rounded-full cta-glow shadow-[0_4px_16px_-4px_rgba(0,61,155,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none">
        Update Token
      </button>
    </div>
  </div>
</div>
<!-- Capabilities — connected-state cards -->
<div class="p-6 bg-surface-container-low rounded-xl space-y-6">
<h3 class="text-sm font-bold text-on-surface uppercase tracking-wider mb-2">Capabilities</h3>
<!-- Active: Use for coding tasks — locked on, non-interactive -->
<div class="flex items-start gap-4 cursor-default" aria-label="Use for coding tasks — active by default">
  <div class="flex-shrink-0 mt-0.5">
    <span class="material-symbols-outlined text-primary" style="font-size:1.25rem;font-variation-settings:'FILL' 1">check_circle</span>
  </div>
  <div class="flex-1">
    <div class="flex items-center gap-2 mb-0.5">
      <span class="block font-bold text-on-surface">Use for coding tasks</span>
      <span class="text-[9px] font-bold uppercase tracking-widest text-primary bg-primary-fixed px-2 py-0.5 rounded-full">Active</span>
    </div>
    <span class="block text-sm text-on-surface-variant">Coding tasks that touch your Jira, Confluence, or Bitbucket are automatically delegated to Rovo Dev. It works with your live project data — real tickets, real docs, real repos.</span>
  </div>
</div>
<!-- Coming Soon: Automated Code Review -->
<div class="flex items-start gap-4 opacity-60 pointer-events-none cursor-not-allowed" aria-disabled="true">
  <div class="flex-1">
    <div class="flex items-center gap-2 mb-0.5">
      <span class="block font-bold text-on-surface">Automated Code Review</span>
      <span class="text-[9px] font-bold uppercase tracking-widest text-primary bg-primary-fixed px-2 py-0.5 rounded-full">Soon</span>
    </div>
    <span class="block text-sm text-on-surface-variant">AI-powered reviews on pull requests in Bitbucket — catching issues before your team does.</span>
  </div>
</div>
</div>
</div>
<!-- rovo-disconnected-state: hidden by default, shown when disconnected -->
<div id="rovo-disconnected-state" class="hidden space-y-8">
<!-- API Token Field -->
<div>
<!-- Instructional panel — guides new users through getting their token -->
<div class="bg-surface-container-low rounded-xl p-4 mb-4 space-y-3">
  <p class="text-sm font-semibold text-on-surface">Connect Rovo Dev in 3 steps</p>
  <ol class="space-y-2 text-sm text-on-surface-variant list-none">
    <li class="flex items-start gap-2.5">
      <span class="flex-shrink-0 w-5 h-5 rounded-full bg-primary-fixed text-primary text-xs font-bold flex items-center justify-center mt-0.5">1</span>
      <span>Go to your <span class="font-semibold text-on-surface">Atlassian account settings</span></span>
    </li>
    <li class="flex items-start gap-2.5">
      <span class="flex-shrink-0 w-5 h-5 rounded-full bg-primary-fixed text-primary text-xs font-bold flex items-center justify-center mt-0.5">2</span>
      <span>Open <span class="font-semibold text-on-surface">Security &rarr; API tokens</span> and create a Rovo Dev token</span>
    </li>
    <li class="flex items-start gap-2.5">
      <span class="flex-shrink-0 w-5 h-5 rounded-full bg-primary-fixed text-primary text-xs font-bold flex items-center justify-center mt-0.5">3</span>
      <span>Copy the token and paste it into the field below</span>
    </li>
  </ol>
  <a href="https://go.atlassian.com/rovo-dev-api-token" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-sm font-semibold link-reveal" aria-label="Go to Atlassian API token page (opens in new tab)">
    Open Atlassian API tokens
    <span class="material-symbols-outlined" style="font-size:0.9rem;vertical-align:middle">open_in_new</span>
  </a>
</div>
<label class="block text-sm font-bold text-on-surface mb-3 uppercase tracking-wider" for="atat-input">API Token</label>
<div class="relative group">
<input id="atat-input" class="w-full bg-surface-variant border-0 rounded-xl px-4 py-4 focus:ring-2 focus:ring-primary transition-all font-mono" placeholder="Paste your API token here" type="password" aria-label="Rovo Dev API token"/>
<button id="atat-toggle-visibility" type="button" class="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors duration-200" aria-label="Toggle token visibility">
<span class="material-symbols-outlined">visibility</span>
</button>
</div>
<!-- atat-error: hidden by default, shown on token submission failure -->
<p id="atat-error" class="hidden mt-2 text-sm text-error"></p>
</div>
<!-- Capabilities — disconnected-state cards -->
<div class="p-6 bg-surface-container-low rounded-xl space-y-6">
<h3 class="text-sm font-bold text-on-surface uppercase tracking-wider mb-2">Capabilities</h3>
<!-- Active: Use for coding tasks — locked on, non-interactive -->
<div class="flex items-start gap-4 cursor-default" aria-label="Use for coding tasks — active by default">
  <div class="flex-shrink-0 mt-0.5">
    <span class="material-symbols-outlined text-primary" style="font-size:1.25rem;font-variation-settings:'FILL' 1">check_circle</span>
  </div>
  <div class="flex-1">
    <div class="flex items-center gap-2 mb-0.5">
      <span class="block font-bold text-on-surface">Use for coding tasks</span>
      <span class="text-[9px] font-bold uppercase tracking-widest text-primary bg-primary-fixed px-2 py-0.5 rounded-full">Active</span>
    </div>
    <span class="block text-sm text-on-surface-variant">Coding tasks that touch your Jira, Confluence, or Bitbucket are automatically delegated to Rovo Dev. It works with your live project data — real tickets, real docs, real repos.</span>
  </div>
</div>
<!-- Coming Soon: Automated Code Review -->
<div class="flex items-start gap-4 opacity-60 pointer-events-none cursor-not-allowed" aria-disabled="true">
  <div class="flex-1">
    <div class="flex items-center gap-2 mb-0.5">
      <span class="block font-bold text-on-surface">Automated Code Review</span>
      <span class="text-[9px] font-bold uppercase tracking-widest text-primary bg-primary-fixed px-2 py-0.5 rounded-full">Soon</span>
    </div>
    <span class="block text-sm text-on-surface-variant">AI-powered reviews on pull requests in Bitbucket — catching issues before your team does.</span>
  </div>
</div>
</div>
<!-- Action Bar -->
<div class="flex items-center justify-end gap-6 pt-4">
<!-- "Skip for now" as a subtle text link — not a filled button -->
<button class="text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors duration-300 link-reveal">
  Skip for now
</button>
<!-- Primary CTA: primary-gradient + cta-glow + rounded-full pill shape -->
<button id="atat-submit" type="button" class="px-8 py-3 primary-gradient text-white font-bold rounded-full cta-glow shadow-[0_4px_16px_-4px_rgba(0,61,155,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none">
  Connect
</button>
</div>
</div>
</section>
</div>
</div>
</main>
<!-- Footer -->
<footer class="w-full bg-surface dark:bg-[#191b23]">
<div class="flex flex-col md:flex-row justify-between items-center px-12 py-8 max-w-7xl mx-auto font-body text-sm leading-relaxed">
<p class="text-on-surface-variant dark:text-[#a0a3af] mb-4 md:mb-0">&copy; 2026 Blue Lobster. Built on OpenClaw.</p>
<div class="flex gap-8">
<!-- link-reveal replaces hover:underline on all footer links -->
<a class="text-on-surface-variant dark:text-[#a0a3af] hover:text-primary transition-colors duration-300 link-reveal" href="#">Support</a>
<a class="text-on-surface-variant dark:text-[#a0a3af] hover:text-primary transition-colors duration-300 link-reveal" href="#">Privacy Policy</a>
<a class="text-on-surface-variant dark:text-[#a0a3af] hover:text-primary transition-colors duration-300 link-reveal" href="#">Terms of Service</a>
<a class="text-on-surface-variant dark:text-[#a0a3af] hover:text-primary transition-colors duration-300 link-reveal" href="#">Documentation</a>
</div>
</div>
</footer>
<script>
// ─── Utilities ────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

// ─── T017: Identity card fetch ────────────────────────────────────────────────

async function fetchIdentity() {
  const skeletonEl   = document.getElementById('identity-skeleton');
  const contentEl    = document.getElementById('identity-content');
  const errorEl      = document.getElementById('identity-error');
  const sitesListEl  = document.getElementById('sites-list');
  const sitesEmptyEl = document.getElementById('sites-empty');

  // Ensure skeleton visible, content + error hidden at start
  skeletonEl.classList.remove('hidden');
  contentEl.classList.add('hidden');
  errorEl.classList.add('hidden');

  try {
    const res = await fetch('/auth/atlassian/atlassian-identity');

    if (res.status === 401) {
      window.location.href = '/login?reason=session_expired';
      return;
    }
    if (!res.ok) throw new Error('HTTP ' + res.status);

    const data = await res.json();

    // Populate profile fields
    document.getElementById('identity-name').textContent  = data.displayName || 'Unknown';
    document.getElementById('identity-email').textContent = data.email || '';

    // Avatar initials — nav circle (identity-avatar-initials) + card circle
    const displayName = data.displayName || 'U';
    const initials = displayName
      .split(' ')
      .map(function(n) { return n[0] || ''; })
      .join('')
      .substring(0, 2)
      .toUpperCase();
    document.getElementById('identity-avatar-initials').textContent     = initials;
    document.getElementById('identity-avatar-card-initials').textContent = initials;

    // Render accessible sites (deduplicate by id — API can return duplicates)
    var rawResources = Array.isArray(data.accessibleResources) ? data.accessibleResources : [];
    var seen = {};
    var resources = rawResources.filter(function(site) {
      var key = site.id || site.name || site.url;
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
    if (resources.length > 0) {
      sitesListEl.innerHTML = resources.map(function(site) {
        const label = escapeHtml(site.name || site.url || 'Unknown site');
        return '<li class="flex items-center justify-between p-4 bg-surface-container-low rounded-xl hover:bg-surface-container transition-all duration-300">'
          + '<div class="flex items-center gap-3">'
          + '<span class="material-symbols-outlined text-on-surface-variant">domain</span>'
          + '<span class="font-medium text-on-surface">' + label + '</span>'
          + '</div>'
          + '<span class="text-xs text-primary font-semibold flex items-center gap-1.5">'
          + '<span class="w-1.5 h-1.5 bg-primary rounded-full"></span>Active'
          + '</span>'
          + '</li>';
      }).join('');
      sitesEmptyEl.classList.add('hidden');
    } else {
      sitesListEl.innerHTML = '<li class="text-sm text-on-surface-variant">No connected sites found.</li>';
      sitesEmptyEl.classList.add('hidden');
    }

    // Reveal content
    skeletonEl.classList.add('hidden');
    contentEl.classList.remove('hidden');

  } catch (err) {
    console.error('[identity]', err);
    skeletonEl.classList.add('hidden');
    errorEl.classList.remove('hidden');
  }
}

// ─── T018: Rovo Dev status fetch ─────────────────────────────────────────────

async function fetchRovoStatus() {
  const skeletonEl      = document.getElementById('rovo-skeleton');
  const connectedEl     = document.getElementById('rovo-connected-state');
  const disconnectedEl  = document.getElementById('rovo-disconnected-state');
  const badgeEl         = document.getElementById('rovo-status-badge');

  // Show skeleton, hide both states
  skeletonEl.classList.remove('hidden');
  connectedEl.classList.add('hidden');
  disconnectedEl.classList.add('hidden');

  try {
    const res = await fetch('/auth/atlassian/rovo-status');

    if (res.status === 401) {
      window.location.href = '/login?reason=session_expired';
      return;
    }
    if (!res.ok) throw new Error('HTTP ' + res.status);

    const data = await res.json();

    skeletonEl.classList.add('hidden');

    if (data.connected) {
      connectedEl.classList.remove('hidden');
      badgeEl.textContent  = 'Connected';
      badgeEl.className    = 'inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-primary-fixed text-primary';
      if (data.email) {
        document.getElementById('rovo-email').textContent = data.email;
      }
    } else {
      disconnectedEl.classList.remove('hidden');
      badgeEl.textContent = 'Disconnected';
      badgeEl.className   = 'inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-surface-container text-on-surface-variant';
      // Focus token input so the user can start typing immediately
      var input = document.getElementById('atat-input');
      if (input) input.focus();
    }

  } catch (err) {
    console.error('[rovo-status]', err);
    // Safe default: show disconnected state so user can attempt to connect
    skeletonEl.classList.add('hidden');
    disconnectedEl.classList.remove('hidden');
    badgeEl.textContent = 'Disconnected';
    badgeEl.className   = 'inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-surface-container text-on-surface-variant';
  }
}

// ─── T018: API token submission ──────────────────────────────────────────────

var atatInFlight = false;

var ERROR_MESSAGES = {
  login_failed:   'Login failed — check your API token and try again.',
  acli_not_found: 'acli is not installed on this server. Contact your administrator.',
  timeout:        'Connection timed out — please try again.',
  missing_token:  'Please enter your API token.'
};

async function submitAtatToken() {
  if (atatInFlight) return;

  var inputEl    = document.getElementById('atat-input');
  var submitBtn  = document.getElementById('atat-submit');
  var errorEl    = document.getElementById('atat-error');
  var token      = inputEl.value.trim();

  if (!token) {
    errorEl.textContent = 'Please enter your API token.';
    errorEl.classList.remove('hidden');
    inputEl.focus();
    return;
  }

  atatInFlight = true;
  submitBtn.disabled    = true;
  submitBtn.textContent = 'Connecting\u2026';
  errorEl.classList.add('hidden');

  try {
    var res = await fetch('/auth/atlassian/rovo-token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ atatToken: token })
    });

    if (res.ok) {
      var data = await res.json().catch(function() { return {}; });
      if (data.connected) {
        // Transition to connected state in-place (no page reload)
        document.getElementById('rovo-disconnected-state').classList.add('hidden');
        document.getElementById('rovo-connected-state').classList.remove('hidden');
        document.getElementById('rovo-status-badge').textContent = 'Connected';
        document.getElementById('rovo-status-badge').className   = 'inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-primary-fixed text-primary';
        if (data.email) {
          document.getElementById('rovo-email').textContent = data.email;
        }
        inputEl.value = '';
      }
    } else {
      var errData = await res.json().catch(function() { return {}; });
      var code    = errData.error || errData.detail || '';
      errorEl.textContent = ERROR_MESSAGES[code] || errData.detail || errData.error || 'Token rejected — check your API token and try again.';
      errorEl.classList.remove('hidden');
    }
  } catch (err) {
    console.error('[atat-submit]', err);
    errorEl.textContent = 'Connection failed — please try again.';
    errorEl.classList.remove('hidden');
  } finally {
    atatInFlight          = false;
    submitBtn.disabled    = false;
    submitBtn.textContent = 'Connect';
  }
}

// ─── Token update form: toggle, submit, disconnect ───────────────────────────

var tokenFormVisible = false;

function toggleTokenForm() {
  var form      = document.getElementById('rovo-update-token-form');
  var toggleBtn = document.getElementById('rovo-toggle-token-btn');
  var icon      = toggleBtn ? toggleBtn.querySelector('.material-symbols-outlined') : null;
  tokenFormVisible = !tokenFormVisible;
  if (tokenFormVisible) {
    form.classList.add('expanded');
    if (icon) icon.textContent = 'expand_less';
    toggleBtn.setAttribute('aria-expanded', 'true');
    // Focus the input after the transition settles
    setTimeout(function() {
      var inp = document.getElementById('atat-update-input');
      if (inp) inp.focus();
    }, 360);
  } else {
    form.classList.remove('expanded');
    if (icon) icon.textContent = 'expand_more';
    toggleBtn.setAttribute('aria-expanded', 'false');
    // Clear the field when collapsing so stale tokens do not linger
    var inp = document.getElementById('atat-update-input');
    if (inp) inp.value = '';
    var errEl = document.getElementById('atat-update-error');
    if (errEl) errEl.classList.add('hidden');
  }
}

var updateInFlight = false;

async function submitUpdateToken() {
  if (updateInFlight) return;

  var inputEl   = document.getElementById('atat-update-input');
  var submitBtn = document.getElementById('atat-update-submit');
  var errorEl   = document.getElementById('atat-update-error');
  var token     = inputEl.value.trim();

  if (!token) {
    errorEl.textContent = 'Please enter your new API token.';
    errorEl.classList.remove('hidden');
    inputEl.focus();
    return;
  }

  updateInFlight        = true;
  submitBtn.disabled    = true;
  submitBtn.textContent = 'Updating\u2026';
  errorEl.classList.add('hidden');

  try {
    var res = await fetch('/auth/atlassian/rovo-token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ atatToken: token })
    });

    if (res.ok) {
      var data = await res.json().catch(function() { return {}; });
      if (data.connected) {
        // Update the email display if returned
        if (data.email) {
          document.getElementById('rovo-email').textContent = data.email;
        }
        // Collapse the form
        tokenFormVisible = true; // force to true so toggle flips it to false
        toggleTokenForm();
        // Show the success message and fade it out after 3 s
        var successEl = document.getElementById('rovo-token-success');
        if (successEl) {
          successEl.classList.remove('hidden');
          successEl.classList.remove('token-success-fade');
          // Force reflow so the animation restarts cleanly
          void successEl.offsetWidth;
          successEl.classList.add('token-success-fade');
          setTimeout(function() { successEl.classList.add('hidden'); }, 3100);
        }
      } else {
        errorEl.textContent = 'Token was not accepted \u2014 check and try again.';
        errorEl.classList.remove('hidden');
      }
    } else {
      var errData = await res.json().catch(function() { return {}; });
      var code    = errData.error || errData.detail || '';
      errorEl.textContent = ERROR_MESSAGES[code] || errData.detail || errData.error || 'Token rejected \u2014 check your API token and try again.';
      errorEl.classList.remove('hidden');
    }
  } catch (err) {
    console.error('[atat-update]', err);
    errorEl.textContent = 'Connection failed \u2014 please try again.';
    errorEl.classList.remove('hidden');
  } finally {
    updateInFlight        = false;
    submitBtn.disabled    = false;
    submitBtn.textContent = 'Update Token';
  }
}

function disconnectRovo() {
  // Collapse the token update form first if open
  if (tokenFormVisible) {
    tokenFormVisible = true;
    toggleTokenForm();
  }
  // Flip states
  document.getElementById('rovo-connected-state').classList.add('hidden');
  var disconnectedEl = document.getElementById('rovo-disconnected-state');
  disconnectedEl.classList.remove('hidden');
  // Reset the badge to disconnected styling
  var badgeEl = document.getElementById('rovo-status-badge');
  badgeEl.textContent = 'Disconnected';
  badgeEl.className   = 'inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-surface-container text-on-surface-variant';
  // Focus the main token input so the user can re-connect immediately
  var inp = document.getElementById('atat-input');
  if (inp) { inp.value = ''; inp.focus(); }
}

// ─── T019: DOMContentLoaded — parallel fetch + event wiring ──────────────────

document.addEventListener('DOMContentLoaded', function() {

  // Parallel fetch — each card handles its own errors independently (FR-020)
  Promise.all([
    fetchIdentity().catch(function(err)   { console.error('[identity-init]', err); }),
    fetchRovoStatus().catch(function(err) { console.error('[rovo-init]', err); })
  ]);

  // Wire API token submit button
  var submitBtn = document.getElementById('atat-submit');
  if (submitBtn) {
    submitBtn.addEventListener('click', submitAtatToken);
  }

  // Wire Enter key in token input
  var atatInput = document.getElementById('atat-input');
  if (atatInput) {
    atatInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') submitAtatToken();
    });
  }

  // Wire visibility toggle for token input
  var visToggle = document.getElementById('atat-toggle-visibility');
  if (visToggle && atatInput) {
    visToggle.addEventListener('click', function() {
      var isPassword = atatInput.type === 'password';
      atatInput.type = isPassword ? 'text' : 'password';
      var icon = visToggle.querySelector('.material-symbols-outlined');
      if (icon) icon.textContent = isPassword ? 'visibility_off' : 'visibility';
    });
  }

  // Wire "Update API Token" toggle
  var toggleTokenBtn = document.getElementById('rovo-toggle-token-btn');
  if (toggleTokenBtn) {
    toggleTokenBtn.addEventListener('click', toggleTokenForm);
  }

  // Wire update token submit button
  var updateSubmitBtn = document.getElementById('atat-update-submit');
  if (updateSubmitBtn) {
    updateSubmitBtn.addEventListener('click', submitUpdateToken);
  }

  // Wire Enter key in update token input
  var updateInput = document.getElementById('atat-update-input');
  if (updateInput) {
    updateInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') submitUpdateToken();
    });
  }

  // Wire visibility toggle for update token input
  var updateVisToggle = document.getElementById('atat-update-toggle-visibility');
  if (updateVisToggle && updateInput) {
    updateVisToggle.addEventListener('click', function() {
      var isPassword = updateInput.type === 'password';
      updateInput.type = isPassword ? 'text' : 'password';
      var icon = updateVisToggle.querySelector('.material-symbols-outlined');
      if (icon) icon.textContent = isPassword ? 'visibility_off' : 'visibility';
    });
  }

  // Wire "Disconnect" button
  var disconnectBtn = document.getElementById('rovo-disconnect-btn');
  if (disconnectBtn) {
    disconnectBtn.addEventListener('click', disconnectRovo);
  }

});
</script>
</body></html>`;
}
