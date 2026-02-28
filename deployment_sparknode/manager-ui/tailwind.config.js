/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sparknode: {
          purple: '#7c3aed',
          blue: '#3b82f6',
          green: '#10b981',
          orange: '#f59e0b',
          pink: '#ec4899',
        }
      },
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
