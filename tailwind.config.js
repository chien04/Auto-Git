/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/webview/**/*.{ts,tsx,js,jsx,html}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
