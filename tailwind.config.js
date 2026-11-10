/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}', './store/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // `touch:` = phones and tablets (a coarse pointer), for finger-sized targets only there.
      screens: { touch: { raw: '(pointer: coarse)' } },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['var(--font-plex-mono)', 'IBM Plex Mono', 'monospace'],
      },
      colors: {
        canvas: 'var(--bg-canvas)',
        surface: 'var(--bg-surface)',
        border: 'var(--border-color)',
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        faint: '#8090a6',
        accent: { DEFAULT: 'var(--accent-color)', hover: '#1D4ED8', subtle: 'var(--accent-subtle-color)' },
        positive: { DEFAULT: 'var(--positive-color)', subtle: 'var(--positive-subtle-color)' },
        negative: { DEFAULT: 'var(--negative-color)', subtle: 'var(--negative-subtle-color)' },
        warning: { DEFAULT: 'var(--warning-color)', subtle: 'var(--warning-subtle-color)' },
      },
    },
  },
  plugins: [],
};
