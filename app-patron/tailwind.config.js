/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Light Mode Base
        "primary": "#141414",
        "background-light": "#f7f7f7",
        
        // Dark Mode - Deep Space Theme
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
        'soft': '0 2px 8px -2px rgba(20, 20, 20, 0.05), 0 1px 4px -2px rgba(20, 20, 20, 0.02)',
        'dark-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.1)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
