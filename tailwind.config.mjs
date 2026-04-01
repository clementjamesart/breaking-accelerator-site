/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"DM Serif Display"', 'serif'],
        sans: ['Manrope', 'sans-serif'],
      },
      colors: {
        cream: '#F5F3EF',
        'cream-dark': '#EBE8E0',
        'cream-darker': '#E5E1D8',
        charcoal: '#1C1C1C',
      },
      borderRadius: {
        '4xl': '3rem',
      },
    },
  },
  plugins: [],
};
