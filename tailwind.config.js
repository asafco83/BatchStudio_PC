/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        ink: {
          950:'#0c0c0d', 900:'#111113', 850:'#161618', 800:'#1c1c1f',
          750:'#222226', 700:'#2a2a2f', 600:'#3a3a40', 500:'#5c5c63',
          400:'#82828a', 300:'#a8a8b0', 200:'#c8c8cf', 100:'#e4e4e8', 50:'#f4f4f6',
        },
        accent: {
          DEFAULT:'#6366f1', soft:'#818cf8',
          bg:'rgba(99,102,241,0.12)', ring:'rgba(99,102,241,0.35)',
        },
      },
      boxShadow: {
        card:'0 1px 0 0 rgba(255,255,255,0.04) inset, 0 1px 2px 0 rgba(0,0,0,0.4)',
        raised:'0 8px 24px -8px rgba(0,0,0,0.6), 0 2px 4px -1px rgba(0,0,0,0.4)',
      },
    },
  },
  plugins: [],
};
