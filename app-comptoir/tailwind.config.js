/** @type {import('tailwindcss').Config} */
import colors from 'tailwindcss/colors';

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "primary": {
          DEFAULT: "#3B82F6", // Blue 500
          foreground: "#FFFFFF",
        },
        "background-light": "#F8FAFC", // Slate 50
        "background-dark": "#020617", // Slate 950
        "semantic-green": "#10B981", // Emerald 500
        "semantic-red": "#EF4444", // Red 500
        "semantic-amber": "#F59E0B", // Amber 500
        "semantic-blue": "#3B82F6",
        "semantic-purple": "#8B5CF6",
        "semantic-pink": "#EC4899",
        
        // Remap neutral to slate for modern blue-grey look
        neutral: colors.slate,
        
        // Legacy inventory colors - kept for backward compatibility if needed, 
        // but should be replaced by neutral/primary/semantic colors
        "inventory-primary": "#2c576d",
        "inventory-primary-dark": "#1f3e4f",
        "inventory-accent": "#D39E3B",
        "inventory-surface-dark": "#1E293B", // Mapped to slate-800
        "inventory-border-dark": "#334155", // Mapped to slate-700
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
        "3xl": "1.5rem",
      },
      boxShadow: {
        'soft': '0 2px 8px -2px rgba(15, 23, 42, 0.05), 0 1px 4px -2px rgba(15, 23, 42, 0.02)',
        'glow': '0 0 20px rgba(59, 130, 246, 0.15)',
        'glow-lg': '0 0 30px rgba(59, 130, 246, 0.3)',
        'glow-success': '0 0 20px rgba(16, 185, 129, 0.15)',
        'glow-error': '0 0 20px rgba(239, 68, 68, 0.15)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'card-gradient': 'linear-gradient(145deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.6) 100%)',
        'card-gradient-hover': 'linear-gradient(145deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.8) 100%)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
