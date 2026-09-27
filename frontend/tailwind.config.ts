import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#ecfdf6',
          100: '#d1fae9',
          200: '#a7f3d8',
          300: '#6ee7c0',
          400: '#35c2a1',
          500: '#2bb389',
          600: '#1f9070',
          700: '#1a755c',
          800: '#175d4a',
          900: '#144b3d',
        },
        coral: '#ff6b5c',
        amber: '#f6b73c',
        sky: '#3aa7ff',
        ink: '#0b0f19',
        chalk: '#e8edf5',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
      boxShadow: {
        soft: '0 12px 40px rgba(15, 23, 42, 0.10)',
        glow: '0 0 0 1px rgba(53,194,161,0.25), 0 8px 40px rgba(53,194,161,0.18)',
        'glow-coral': '0 0 0 1px rgba(255,107,92,0.25), 0 8px 40px rgba(255,107,92,0.18)',
        glass: '0 8px 32px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255,255,255,0.08)',
      },
      backgroundImage: {
        'mesh-dark':
          'radial-gradient(at 18% 12%, rgba(53,194,161,0.18) 0px, transparent 42%), radial-gradient(at 82% 18%, rgba(58,167,255,0.16) 0px, transparent 40%), radial-gradient(at 65% 88%, rgba(255,107,92,0.12) 0px, transparent 45%), radial-gradient(at 12% 78%, rgba(124,92,255,0.12) 0px, transparent 45%)',
        'mesh-light':
          'radial-gradient(at 18% 12%, rgba(53,194,161,0.22) 0px, transparent 42%), radial-gradient(at 82% 18%, rgba(58,167,255,0.18) 0px, transparent 40%), radial-gradient(at 65% 88%, rgba(255,107,92,0.14) 0px, transparent 45%)',
        'brand-gradient': 'linear-gradient(135deg, #35c2a1 0%, #3aa7ff 100%)',
      },
      keyframes: {
        'fall': 'fall 2s linear infinite',
        'chalk': 'chalk-writing 1s linear infinite',
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.97)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'shimmer': {
          '100%': { transform: 'translateX(100%)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', opacity: '0.7' },
          '70%': { transform: 'scale(1.3)', opacity: '0' },
          '100%': { transform: 'scale(1.3)', opacity: '0' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      animation: {
        'fall': 'fall 2s linear infinite',
        'chalk': 'chalk-writing 1s linear infinite',
        'fade-in': 'fade-in 0.4s ease-out both',
        'scale-in': 'scale-in 0.3s cubic-bezier(0.16,1,0.3,1) both',
        'slide-up': 'slide-up 0.45s cubic-bezier(0.16,1,0.3,1) both',
        'shimmer': 'shimmer 1.6s infinite',
        'pulse-ring': 'pulse-ring 2s cubic-bezier(0.4,0,0.6,1) infinite',
        'float': 'float 6s ease-in-out infinite',
      },
    },
  },
  plugins: [typography]
} satisfies Config;
