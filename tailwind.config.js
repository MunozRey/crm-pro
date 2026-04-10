/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
        navy: {
          50: '#f4f6fb',
          100: '#e7ebf5',
          200: '#cfd8ea',
          300: '#aebedb',
          400: '#869ec8',
          500: '#667fb3',
          600: '#51679a',
          700: '#445580',
          800: '#1a1d35',
          900: '#111220',
          950: '#06070f',
        },
      },
      boxShadow: {
        'brand-sm': '0 0 16px rgba(37,99,235,0.28)',
        float: '0 8px 30px rgba(0,0,0,0.28)',
      },
      keyframes: {
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'scale-in': 'scale-in 160ms ease-out',
      },
    },
  },
  plugins: [],
}
