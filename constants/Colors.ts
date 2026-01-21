/**
 * AfriConnect color palette - matches web app theme
 */

const tintColorLight = '#c4703c'; // Primary warm terracotta
const tintColorDark = '#d4915a';  // Lighter for dark mode

export const Colors = {
  light: {
    text: '#2d2926',
    textSecondary: '#78716c',
    background: '#faf8f5',
    card: '#ffffff',
    tint: tintColorLight,
    tabIconDefault: '#a8a29e',
    tabIconSelected: tintColorLight,
    border: '#e7e0d8',
    primary: '#c4703c',
    primaryForeground: '#ffffff',
    secondary: '#f0ebe3',
    secondaryForeground: '#2d2926',
    muted: '#f0ebe3',
    mutedForeground: '#78716c',
    accent: '#d4a574',
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
  },
  dark: {
    text: '#f5f3f0',
    textSecondary: '#a8a29e',
    background: '#1a1816',
    card: '#252220',
    tint: tintColorDark,
    tabIconDefault: '#78716c',
    tabIconSelected: tintColorDark,
    border: '#3d3835',
    primary: '#d4915a',
    primaryForeground: '#1a1816',
    secondary: '#3d3835',
    secondaryForeground: '#f5f3f0',
    muted: '#3d3835',
    mutedForeground: '#a8a29e',
    accent: '#e5b896',
    success: '#4ade80',
    warning: '#fbbf24',
    error: '#f87171',
  },
};

export default Colors;
