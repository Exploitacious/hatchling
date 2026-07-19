/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/renderer/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // The hatching palette — near-black surfaces, warm amber accent
        // (the "egg cracking open" metaphor). Used across the whole UI.
        hatch: {
          bg: '#0a0a0a',
          surface: '#141414',
          'surface-2': '#1c1c1c',
          border: '#262626',
          text: '#e5e5e5',
          muted: '#8a8a8a',
          accent: '#d4a017',
          'accent-hover': '#e0b12e',
          success: '#3fb950',
          warning: '#d29922',
          danger: '#f85149'
        }
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif']
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
