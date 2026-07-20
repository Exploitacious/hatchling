/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/renderer/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // The hatching palette — near-black surfaces, warm amber accent
        // (the "egg cracking open" metaphor). Values are CSS variables (RGB
        // channels) defined in index.css so the light/dark theme is a swap and
        // Tailwind opacity modifiers (e.g. bg-hatch-accent/15) work.
        hatch: {
          bg: 'rgb(var(--hatch-bg) / <alpha-value>)',
          surface: 'rgb(var(--hatch-surface) / <alpha-value>)',
          'surface-2': 'rgb(var(--hatch-surface-2) / <alpha-value>)',
          border: 'rgb(var(--hatch-border) / <alpha-value>)',
          text: 'rgb(var(--hatch-text) / <alpha-value>)',
          muted: 'rgb(var(--hatch-muted) / <alpha-value>)',
          accent: 'rgb(var(--hatch-accent) / <alpha-value>)',
          'accent-hover': 'rgb(var(--hatch-accent-hover) / <alpha-value>)',
          success: 'rgb(var(--hatch-success) / <alpha-value>)',
          warning: 'rgb(var(--hatch-warning) / <alpha-value>)',
          danger: 'rgb(var(--hatch-danger) / <alpha-value>)'
        }
      },
      // Emoji/symbol fallbacks matter on every stack: platform emoji fonts
      // first (native look on mac/Windows), then the bundled Noto fonts so
      // rendering is guaranteed on systems with no emoji font at all.
      fontFamily: {
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Consolas',
          'monospace',
          'Apple Color Emoji',
          'Segoe UI Emoji',
          'Segoe UI Symbol',
          'Noto Color Emoji',
          'Noto Sans Symbols 2'
        ],
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'sans-serif',
          'Apple Color Emoji',
          'Segoe UI Emoji',
          'Segoe UI Symbol',
          'Noto Color Emoji',
          'Noto Sans Symbols 2'
        ]
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        'flash': {
          '0%': { backgroundColor: 'rgba(212, 160, 23, 0.25)' },
          '100%': { backgroundColor: 'transparent' }
        }
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'flash': 'flash 0.8s ease-out'
      }
    }
  },
  plugins: []
}
