import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy:   '#0F1D2D',
        sage:   '#7A9A7A',
        cream:  '#E7E2D6',
        slate:  '#A9B1B7',
        offwhite: '#F7F7F5',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
