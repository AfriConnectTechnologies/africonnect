/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Primary - Warm terracotta/amber (matching web app)
        primary: {
          50: '#fef7f0',
          100: '#fdebd9',
          200: '#fad4b2',
          300: '#f6b681',
          400: '#f18d4e',
          500: '#c4703c', // Main primary - matches web oklch(0.55 0.18 35)
          600: '#b55a2a',
          700: '#964624',
          800: '#793923',
          900: '#64311f',
          950: '#36170d',
        },
        // Secondary - Muted warm beige
        secondary: {
          50: '#f9f7f4',
          100: '#f0ebe3',
          200: '#e0d6c7',
          300: '#cdbda4',
          400: '#b79f7e',
          500: '#a78965',
          600: '#9a7858',
          700: '#80624a',
          800: '#695140',
          900: '#564436',
          950: '#2e231b',
        },
        // Accent - Golden yellow
        accent: {
          50: '#fefce8',
          100: '#fef9c3',
          200: '#fef08a',
          300: '#fde047',
          400: '#facc15',
          500: '#d4a574', // Warm gold accent
          600: '#ca8a04',
          700: '#a16207',
          800: '#854d0e',
          900: '#713f12',
          950: '#422006',
        },
        // Background colors
        background: {
          light: '#faf8f5', // Warm off-white
          dark: '#1a1816',  // Warm dark
        },
        // Card colors
        card: {
          light: '#ffffff',
          dark: '#252220',
        },
        // Foreground/text colors
        foreground: {
          light: '#2d2926',
          dark: '#f5f3f0',
        },
        // Muted colors
        muted: {
          light: '#f0ebe3',
          dark: '#3d3835',
          foreground: {
            light: '#78716c',
            dark: '#a8a29e',
          }
        },
        // Border colors
        border: {
          light: '#e7e0d8',
          dark: '#3d3835',
        },
        // Status colors
        success: {
          50: '#f0fdf4',
          500: '#22c55e',
          600: '#16a34a',
        },
        warning: {
          50: '#fffbeb',
          500: '#f59e0b',
          600: '#d97706',
        },
        error: {
          50: '#fef2f2',
          500: '#ef4444',
          600: '#dc2626',
        },
      },
    },
  },
  plugins: [],
};
