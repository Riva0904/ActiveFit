import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
        brand: '#f97316',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        brand:  '0 8px 32px rgba(249,115,22,0.25), 0 2px 8px rgba(249,115,22,0.15)',
        card:   '0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)',
        lifted: '0 20px 60px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.06)',
        inner:  'inset 0 2px 4px rgba(0,0,0,0.06)',
      },
      animation: {
        'slide-up':       'slideUp 0.3s ease-out',
        'fade-in':        'fadeIn 0.2s ease-out',
        shimmer:          'shimmer 2s linear infinite',
        'slide-in-right': 'slideInRight 0.4s ease-out both',
        'slide-in-left':  'slideInLeft 0.4s ease-out both',
        'zoom-in':        'zoomIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both',
        'spin-slow':      'spinSlow 8s linear infinite',
        'number-pop':     'numberPop 0.4s ease-out both',
        'gradient-x':     'gradientX 4s ease infinite',
        'card-float':     'cardFloat 4s ease-in-out infinite',
        'pulse-glow':     'pulseGlow 2.5s ease-in-out infinite',
        'width-expand':   'widthExpand 0.8s cubic-bezier(0.34,1.56,0.64,1) both',
      },
      keyframes: {
        slideUp:      { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        fadeIn:       { from: { opacity: '0' }, to: { opacity: '1' } },
        shimmer:      { from: { backgroundPosition: '-200% 0' }, to: { backgroundPosition: '200% 0' } },
        slideInRight: { from: { opacity: '0', transform: 'translateX(20px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        slideInLeft:  { from: { opacity: '0', transform: 'translateX(-20px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        zoomIn:       { from: { opacity: '0', transform: 'scale(0.88)' }, to: { opacity: '1', transform: 'scale(1)' } },
        spinSlow:     { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } },
        numberPop:    { '0%': { transform: 'scale(1)' }, '40%': { transform: 'scale(1.18)' }, '100%': { transform: 'scale(1)' } },
        gradientX:    { '0%,100%': { backgroundPosition: '0% 50%' }, '50%': { backgroundPosition: '100% 50%' } },
        cardFloat:    { '0%,100%': { transform: 'translateY(0px)' }, '50%': { transform: 'translateY(-4px)' } },
        pulseGlow:    { '0%,100%': { boxShadow: '0 0 0 0 rgba(249,115,22,0)' }, '50%': { boxShadow: '0 0 20px 8px rgba(249,115,22,.22)' } },
        widthExpand:  { from: { width: '0' }, to: { width: '100%' } },
      },
    },
  },
  plugins: [],
};

export default config;
