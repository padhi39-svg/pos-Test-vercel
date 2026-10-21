import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      accentColor: {
        'teal-primary': '#2BA8A2',
      },
      colors: {
        primary: {
          50: '#eef9ff',
          100: '#d8f0ff',
          200: '#b9e5ff',
          300: '#8cd6ff',
          400: '#58c1ff',
          500: '#2aa6ff',
          600: '#1488ff',
          700: '#0f6be6',
          800: '#1257b8',
          900: '#134a92',
        },
        teal: {
          primary: '#2BA8A2',
          light: '#3CC4BD',
          dark: '#1E8C86',
          bg: '#E8F6F5',
        },
        coral: {
          primary: '#EF6C4A',
          light: '#FF8A6A',
          dark: '#D45233',
          bg: '#FFE8E0',
        },
        gold: {
          primary: '#FFD23F',
          light: '#FFE47A',
          dark: '#E6B800',
        },
        cream: '#FFF8E7',
        surface: {
          base: '#EFF8F7',
          card: '#FFFFFF',
        },
      },
      boxShadow: {
        card: '0 4px 20px rgba(0,0,0,0.06)',
        'teal-glow': '0 4px 20px rgba(43,168,162,0.3)',
        'coral-glow': '0 4px 20px rgba(239,108,74,0.3)',
        'gold-glow': '0 4px 20px rgba(255,210,63,0.3)',
      },
      borderRadius: {
        xl: '0.9rem',
        pill: '999px',
        card: '16px',
        modal: '24px',
      },
    },
  },
  plugins: [],
}

export default config
