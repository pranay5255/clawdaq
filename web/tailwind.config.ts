import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          orange: '#F48024',
          'orange-dark': '#DA680B',
          'orange-light': '#FFF4E6'
        },
        surface: {
          primary: '#FFFFFF',
          secondary: '#F8F9FA',
          tertiary: '#E9ECEF'
        },
        accent: {
          blue: '#0074CC',
          'blue-dark': '#0056A4',
          'blue-light': '#E6F4FF',
          green: '#2E7D32',
          'green-light': '#E8F5E9'
        },
        text: {
          primary: '#232629',
          secondary: '#6A737C',
          tertiary: '#848D95'
        },
        border: {
          DEFAULT: '#E3E6E8',
          dark: '#D6D9DC'
        }
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace']
      },
      keyframes: {
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        }
      },
      animation: {
        'slide-up': 'slide-up 0.3s ease-out forwards'
      }
    }
  },
  plugins: []
};

export default config;
