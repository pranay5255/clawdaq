import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Terminal-inspired dark theme
        terminal: {
          bg: '#0a0a0a',
          surface: '#111111',
          elevated: '#1a1a1a',
          border: '#2a2a2a',
          'border-bright': '#3a3a3a',
        },
        // Accent colors - cyan/green terminal feel
        accent: {
          primary: '#00ff9f',      // Bright green (main accent)
          secondary: '#00d4aa',    // Teal
          blue: '#00bfff',         // Electric blue
          purple: '#a78bfa',       // Soft purple
          orange: '#ff9f43',       // Warning/highlight
          red: '#ff6b6b',          // Error/downvote
        },
        // Text hierarchy
        text: {
          primary: '#e4e4e7',      // Primary text
          secondary: '#a1a1aa',    // Secondary text
          tertiary: '#71717a',     // Muted text
          inverse: '#0a0a0a',      // Text on accent
        },
        // Status colors
        status: {
          success: '#00ff9f',
          warning: '#ff9f43',
          error: '#ff6b6b',
          info: '#00bfff',
        },
      },
      fontFamily: {
        mono: ['var(--font-mono)', 'IBM Plex Mono', 'JetBrains Mono', 'monospace'],
        sans: ['var(--font-mono)', 'IBM Plex Mono', 'monospace'],
        display: ['var(--font-mono)', 'IBM Plex Mono', 'monospace'],
      },
      keyframes: {
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        'terminal-blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        'scan-line': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 5px rgba(0, 255, 159, 0.3)' },
          '50%': { boxShadow: '0 0 20px rgba(0, 255, 159, 0.6)' },
        },
      },
      animation: {
        'slide-up': 'slide-up 0.3s ease-out forwards',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'terminal-blink': 'terminal-blink 1s step-end infinite',
        'scan-line': 'scan-line 8s linear infinite',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
      },
      boxShadow: {
        'glow-sm': '0 0 10px rgba(0, 255, 159, 0.2)',
        'glow-md': '0 0 20px rgba(0, 255, 159, 0.3)',
        'glow-lg': '0 0 30px rgba(0, 255, 159, 0.4)',
        'glow-blue': '0 0 20px rgba(0, 191, 255, 0.3)',
      },
      backgroundImage: {
        'grid-pattern': 'linear-gradient(rgba(0, 255, 159, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 255, 159, 0.03) 1px, transparent 1px)',
        'noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.02'/%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [],
  safelist: [
    // Safelist accent color variants for dynamic feature cards
    'text-accent-primary',
    'text-accent-blue',
    'text-accent-purple',
    'hover:border-accent-primary/50',
    'hover:border-accent-blue/50',
    'hover:border-accent-purple/50',
  ],
};

export default config;
