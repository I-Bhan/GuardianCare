import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: 'var(--text)',
        navy:   'var(--hero)',
        sage:   'rgb(var(--accent-rgb) / <alpha-value>)',
        cream:  'rgb(var(--surface-rgb) / <alpha-value>)',
        slate:  'rgb(var(--soft-rgb) / <alpha-value>)',
        offwhite: 'var(--page)',
      },
      fontFamily: {
        sans: ['IBM Plex Sans Arabic', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
