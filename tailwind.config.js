/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1F4E79',
          light: '#2E75B6',
          lighter: '#5B9BD5',
        },
        success: {
          DEFAULT: '#28A745',
          light: '#E8F5E9',
        },
        warning: {
          DEFAULT: '#FFC107',
          light: '#FFF8E1',
        },
        danger: {
          DEFAULT: '#DC3545',
          light: '#FFEBEE',
        },
        info: {
          DEFAULT: '#17A2B8',
          light: '#E3F2FD',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['Fira Code', 'Consolas', 'monospace'],
      },
      minHeight: {
        'touch': '44px',
      },
      minWidth: {
        'touch': '44px',
      },
    },
  },
  plugins: [],
}
