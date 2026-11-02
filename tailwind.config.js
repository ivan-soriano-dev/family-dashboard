/**
 * Tailwind v3 config.
 * Colours point at CSS variables defined in index.html, so changing the primary
 * colour (THEME.primary in index.html) does NOT need a rebuild.
 * Rebuild only when you add new Tailwind classes:
 *   npx tailwindcss@3.4.17 -i src/tailwind.input.css -o tailwind.css --minify
 * (the GitHub Action does this automatically on every push)
 */
module.exports = {
  content: ['./index.html'],
  darkMode: 'class',
  theme: {
    extend: {
      screens: { wall: '900px' },            // wide layout (photo frame, tablets, desktops)
      colors: {
        primary: 'rgb(var(--primary) / <alpha-value>)',
        'on-primary': 'rgb(var(--on-primary) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',   // primary, adjusted to stay readable as text
        page: 'rgb(var(--bg-page) / <alpha-value>)',
        panel: 'rgb(var(--bg-panel) / <alpha-value>)',
        hover: 'rgb(var(--bg-hover) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        'line-strong': 'rgb(var(--line-strong) / <alpha-value>)',
        fg: 'rgb(var(--fg) / <alpha-value>)',
        'fg-2': 'rgb(var(--fg-2) / <alpha-value>)',
        'fg-3': 'rgb(var(--fg-3) / <alpha-value>)',
        'fg-4': 'rgb(var(--fg-4) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)'
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif']
      }
    }
  },
  plugins: [
    function ({ addVariant }) {
      addVariant('frame', '.frame &');                          // only on the photo frame (?mode=frame)
      addVariant('hover-hover', '@media (hover: hover) { &:hover }'); // no sticky hover on touch screens
    }
  ]
};
