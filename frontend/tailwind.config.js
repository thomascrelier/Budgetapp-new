/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        tiffany: {
          DEFAULT: '#0ABAB5',
          dark: '#088F8C',
          light: '#E0F7F6',
          50: '#F0FDFC',
          100: '#CCFBF1',
          200: '#99F6E4',
          300: '#5EEAD4',
          400: '#2DD4BF',
          500: '#0ABAB5',
          600: '#088F8C',
          700: '#0D7377',
          800: '#115E59',
          900: '#134E4A',
        },
        offwhite: '#F8FFFE',
        charcoal: '#2D3748',
      },
    },
  },
  plugins: [],
}
