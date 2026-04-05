/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#f4f8ff',
          card: '#ffffff',
          border: '#dbeafe',
          hover: '#eff6ff',
        },
        accent: {
          blue: '#2563eb',
          blueSoft: '#60a5fa',
          cyan: '#06b6d4',
          green: '#16a34a',
          yellow: '#ca8a04',
          red: '#dc2626',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        soft: '0 8px 30px rgba(37, 99, 235, 0.08)',
      },
    },
  },
  plugins: [],
}