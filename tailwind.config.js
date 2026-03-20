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
          DEFAULT: '#0052D9',
          light: '#2E7DFF',
          lighter: '#3D8CFF',
        },
        canvas: '#F5F7FA',
        border: '#E9ECF0',
        text: {
          primary: '#1F2A3A',
          secondary: '#5A6874',
          muted: '#8A95A5',
        },
        status: {
          success: '#00A870',
          warning: '#ED7B2F',
          error: '#E34D4D',
          info: '#0052D9',
        },
        pipeline: {
          payment: '#0052D9',
          user: '#00A870',
          product: '#ED7B2F',
          order: '#8B5CF6',
          marketing: '#FF6B6B',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
