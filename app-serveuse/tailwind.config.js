/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        "primary": "#141414",
        "background-light": "#f7f7f7",
        
        // Dark Mode - Deep Space Theme (Aligned with app-patron)
        "dark-bg": "#020617", // Slate 950
        "dark-card": "#0F172A", // Slate 900
        "dark-border": "rgba(255, 255, 255, 0.05)",
        "dark-accent": "#3B82F6", // Blue 500
        
        "semantic-green": "#039855",
        "semantic-red": "#D92D20",
        "semantic-amber": "#DC6803",
        "semantic-blue": "#0086C9",
      },
      fontFamily: {
        "display": ["Plus Jakarta Sans", "Space Grotesk", "sans-serif"],
        "body": ["Noto Sans", "sans-serif"],
      },
      borderRadius: {
        "DEFAULT": "0.25rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
        "2xl": "1rem",
      },
      boxShadow: {
        "soft": "0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
      },
    },
  },
  plugins: [],
}
