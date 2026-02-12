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
        // Modern monochrome palette
        background: '#FAFAFA',
        surface: '#FFFFFF',
        'surface-hover': '#F5F5F5',
        border: '#E5E5E5',
        'border-dark': '#D4D4D4',
        'text-primary': '#171717',
        'text-secondary': '#525252',
        'text-tertiary': '#737373',
        'text-muted': '#A3A3A3',
        // Accent colors for data
        positive: '#22C55E',
        negative: '#EF4444',
        warning: '#F59E0B',
        info: '#3B82F6',
      },
    },
  },
  plugins: [],
}
