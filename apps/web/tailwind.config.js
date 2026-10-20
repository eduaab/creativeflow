/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'], display: ['Poppins', 'Inter', 'sans-serif'] },
      colors: {
        brand: { 50: '#EEF7F6', 100: '#D6EEEC', 500: '#167486', 600: '#0E5E6F', 700: '#0A4553', 900: '#06262E' },
        accent: { 500: '#E8530A', 100: '#FDE3D3' },
      },
    },
  },
  plugins: [],
};
