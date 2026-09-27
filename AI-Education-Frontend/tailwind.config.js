/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Theme change: shifted from the old dark-navy #283593 primary to
        // a softer, more vibrant indigo-violet + warm cream background,
        // matching the reference "EduAI" mockup's palette. This is a
        // single-source-of-truth token change - every page already uses
        // `bg-primary`/`text-primary`/`border-primary` etc. rather than
        // hardcoded hex, so this cascades app-wide with no per-page edits.
        "primary": "#6D5FE0",
        "primary-dark": "#4C3FC7",
        "accent": "#F4B942",
        "background": "#FBF7F0",
        "surface": "#FFFFFF",
        "on-surface": "#172033",
        "on-background": "#172033",
        "on-surface-variant": "#64748B",
        "outline": "#64748B",
        "border-subtle": "#E5E7EB",
        "success": "#16866A",
        "success-mastery": "#16866A",
        "info": "#3B82C4",
        "warning": "#E89B3C",
        "error": "#D95D5D",
        "secondary": "#3B82C4",
        "on-secondary": "#ffffff",
        "on-primary": "#ffffff",
        "surface-bright": "#FBF7F0",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#F1F5F9",
        "surface-container": "#E2E8F0",
        "surface-container-high": "#CBD5E1",
        "surface-container-highest": "#94A3B8",
        "primary-container": "#EDEBFC",
        "on-primary-container": "#4C3FC7",
        "secondary-container": "#3B82C4",
        "surface-grey": "#FBF7F0",
        "outline-variant": "#E5E7EB",
        "risk-red": "#D95D5D",
        "focus-orange": "#E89B3C",
        "ai-insight-purple": "#6D5FE0"
      },
      borderRadius: {
        "DEFAULT": "0.25rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
        "full": "9999px"
      },
      spacing: {
        "stack-md": "24px",
        "gutter": "16px",
        "stack-sm": "12px",
        "base": "8px",
        "stack-lg": "40px",
        "margin-mobile": "16px",
        "margin-desktop": "32px"
      },
      fontFamily: {
        "display-lg": ["Inter", "sans-serif"],
        "headline-lg": ["Inter", "sans-serif"],
        "label-md": ["JetBrains Mono", "monospace"],
        "body-lg": ["Inter", "sans-serif"],
        "notation-math": ["Inter", "sans-serif"],
        "headline-lg-mobile": ["Inter", "sans-serif"],
        "headline-md": ["Inter", "sans-serif"],
        "body-md": ["Inter", "sans-serif"]
      },
      fontSize: {
        "display-lg": ["48px", { lineHeight: "56px", letterSpacing: "-0.02em", fontWeight: "700" }],
        "headline-lg": ["32px", { lineHeight: "40px", fontWeight: "600" }],
        "label-md": ["14px", { lineHeight: "20px", fontWeight: "500" }],
        "body-lg": ["18px", { lineHeight: "28px", fontWeight: "400" }],
        "notation-math": ["18px", { lineHeight: "1.5", letterSpacing: "0.01em", fontWeight: "500" }],
        "headline-lg-mobile": ["24px", { lineHeight: "32px", fontWeight: "600" }],
        "headline-md": ["24px", { lineHeight: "32px", fontWeight: "600" }],
        "body-md": ["16px", { lineHeight: "24px", fontWeight: "400" }]
      },
      boxShadow: {
        "glass": "0 8px 32px 0 rgba(31, 38, 135, 0.07)",
        "glass-hover": "0 14px 40px 0 rgba(31, 38, 135, 0.12)",
        "glow-primary": "0 0 24px -2px rgba(109, 95, 224, 0.3)",
        "glow-accent": "0 0 24px -2px rgba(244, 185, 66, 0.35)"
      }
    },
  },
  plugins: [],
}
