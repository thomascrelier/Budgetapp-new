// Tokens are hex CSS variables. Tailwind 3 cannot apply `/10`-style opacity to a bare var(),
// so those classes used to emit no CSS at all. color-mix lets every token take an opacity modifier.
const withAlpha = (v) => `color-mix(in srgb, var(${v}) calc(<alpha-value> * 100%), transparent)`;

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
        background: withAlpha('--background'),
        surface: withAlpha('--surface'),
        'surface-hover': withAlpha('--surface-hover'),
        border: withAlpha('--border'),
        'border-dark': withAlpha('--border-dark'),
        'text-primary': withAlpha('--text-primary'),
        'text-secondary': withAlpha('--text-secondary'),
        'text-tertiary': withAlpha('--text-tertiary'),
        'text-muted': withAlpha('--text-muted'),
        'text-faint': withAlpha('--text-faint'),
        accent: withAlpha('--accent'),
        'accent-hover': withAlpha('--accent-hover'),
        'accent-text': withAlpha('--accent-text'),
        'on-accent': withAlpha('--on-accent'),
        positive: withAlpha('--positive'),
        negative: withAlpha('--negative'),
        warning: withAlpha('--warning'),
        info: withAlpha('--info'),
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        display: ['Instrument Serif', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
