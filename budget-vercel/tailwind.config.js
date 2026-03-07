/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Dark refined finance palette
        background: '#0C0C14',
        surface: '#161622',
        'surface-hover': '#1E1E2E',
        border: '#2A2A3C',
        'border-dark': '#3A3A4C',
        'text-primary': '#F0F0F5',
        'text-secondary': '#A0A0B5',
        'text-tertiary': '#6E6E85',
        'text-muted': '#4A4A5C',
        // Accent colors
        accent: '#D4A853',
        'accent-hover': '#E0BC6E',
        positive: '#34D399',
        negative: '#F87171',
        warning: '#FBBF24',
        info: '#60A5FA',
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        display: ['Instrument Serif', 'Georgia', 'serif'],
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.5s ease-out forwards',
        'fade-in': 'fade-in 0.4s ease-out forwards',
      },
    },
  },
  plugins: [],
}
