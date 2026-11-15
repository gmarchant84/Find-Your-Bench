import defaultTheme from 'tailwindcss/defaultTheme';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    // xs is used by Header (e.g. 'hidden xs:inline'). It must come before the
    // default breakpoints so min-width media queries stay in order.
    screens: {
      xs: '380px',
      ...defaultTheme.screens,
    },
    extend: {},
  },
  plugins: [],
};
