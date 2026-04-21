/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'crypto-dark': '#0a0e1a',
        'crypto-card': '#111827',
        'crypto-border': '#1f2937',
        'crypto-green': '#10b981',
        'crypto-red': '#ef4444',
        'crypto-blue': '#3b82f6',
        'crypto-purple': '#8b5cf6',
        'crypto-orange': '#f59e0b',
        'crypto-pink': '#ec4899',
        'neuro-bg': '#0a0e1a',
      },
    },
  },
  plugins: [],
}
