/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Pixel-inspired surface tokens
        surface: {
          50: '#F8F9FA',
          100: '#F1F3F5',
          200: '#E9ECEF',
          300: '#DEE2E6',
          400: '#CED4DA',
          700: '#2A3441',
          800: '#1C2430',
          850: '#161E29',
          900: '#0F151F',
          950: '#0A0E15'
        },
        // Security Status Semantic Accents
        sentinel: {
          safe: {
            light: '#0D9488',
            DEFAULT: '#059669',
            dark: '#10B981',
            bg: '#ECFDF5',
            darkBg: '#064E3B'
          },
          watching: {
            light: '#0284C7',
            DEFAULT: '#0284C7',
            dark: '#38BDF8',
            bg: '#F0F9FF',
            darkBg: '#0C4A6E'
          },
          attention: {
            light: '#D97706',
            DEFAULT: '#D97706',
            dark: '#FBBF24',
            bg: '#FFFBEB',
            darkBg: '#78350F'
          },
          approval: {
            light: '#EA580C',
            DEFAULT: '#EA580C',
            dark: '#FB923C',
            bg: '#FFF7ED',
            darkBg: '#7C2D12'
          },
          stopped: {
            light: '#DC2626',
            DEFAULT: '#DC2626',
            dark: '#F87171',
            bg: '#FEF2F2',
            darkBg: '#7F1D1D'
          }
        }
      },
      borderRadius: {
        'tactile': '1.25rem',
        'pill': '9999px',
        'expressive': '1.5rem'
      },
      boxShadow: {
        'tactile-subtle': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        'tactile-hover': '0 4px 12px 0 rgba(0, 0, 0, 0.08), 0 2px 4px 0 rgba(0, 0, 0, 0.04)',
        'tactile-dark': '0 2px 8px 0 rgba(0, 0, 0, 0.4)'
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif'
        ],
        mono: [
          '"JetBrains Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Consolas',
          'monospace'
        ]
      }
    },
  },
  plugins: [],
}
