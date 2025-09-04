import type { Config } from "tailwindcss";
import daisyui from "daisyui";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    'node_modules/daisyui/dist/**/*.js',
    'node_modules/react-daisyui/dist/**/*.js',
  ],
  theme: {
    container: {
     screens: {
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1280px',
     },
    },
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        'custom-purple': 'oklch(0.28 0.07 261.98)',
      },
      fontFamily: {
        // 设置全局默认字体为 Sora
        sans: ['Sora', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
        sora: ['Sora', 'sans-serif'],
      },
    },
  },
  daisyui: {
      themes: [
        {
          light: {
            'primary': '#81A1C1',
            'primary-focus': '#5E81AC',
            'primary-content': '#FFFFFF',
            
            'secondary': '#88C0D0',
            'secondary-focus': '#81A1C1',
            'secondary-content': '#2E3440',
            
            'accent': '#B48EAD',
            'accent-focus': '#996B95',
            'accent-content': '#FFFFFF',
            
            'neutral': '#4C566A',
            'neutral-focus': '#434C5E',
            'neutral-content': '#FFFFFF',
            
            'base-100': '#FFFFFF',
            'base-200': '#F5F7FA',
            'base-300': '#E5E9F0',
            'base-content': '#2E3440',
            
            'info': '#81A1C1',
            'success': '#A3BE8C',
            'warning': '#EBCB8B',
            'error': '#BF616A',
            
            'surface-dark': '#1c1d22',
            'surface-button': '#293249',
            'surface-button-hover': '#374462',
            'hover-light': 'rgba(255, 255, 255, 0.05)',
          },
          dark: {
            'primary': 'oklch(58% 0.233 277.117)',
            'primary-focus': 'oklch(58% 0.233 277.117)',
            'primary-content': 'oklch(96% 0.018 272.314)',
            
            'secondary': 'oklch(65% 0.241 354.308)',
            'secondary-focus': 'oklch(65% 0.241 354.308)',
            'secondary-content': 'oklch(94% 0.028 342.258)',
            
            'accent': 'oklch(77% 0.152 181.912)',
            'accent-focus': 'oklch(77% 0.152 181.912)',
            'accent-content': 'oklch(38% 0.063 188.416)',
            
            'neutral': 'oklch(14% 0.005 285.823)',
            'neutral-focus': 'oklch(14% 0.005 285.823)',
            'neutral-content': 'oklch(92% 0.004 286.32)',
            
            'base-100': 'oklch(25.33% 0.016 252.42)',
            'base-200': 'oklch(23.26% 0.014 253.1)',
            'base-300': 'oklch(21.15% 0.012 254.09)',
            'base-content': 'oklch(97.807% 0.029 256.847)',
            
            'info': 'oklch(74% 0.16 232.661)',
            'info-content': 'oklch(29% 0.066 243.157)',
            
            'success': 'oklch(76% 0.177 163.223)',
            'success-content': 'oklch(37% 0.077 168.94)',
            
            'warning': 'oklch(82% 0.189 84.429)',
            'warning-content': 'oklch(41% 0.112 45.904)',
            
            'error': 'oklch(71% 0.194 13.428)',
            'error-content': 'oklch(27% 0.105 12.094)',
            
            'surface-dark': 'oklch(14% 0.005 285.823)',
            'surface-button': 'oklch(25.33% 0.016 252.42)',
            'surface-button-hover': 'oklch(23.26% 0.014 253.1)',
            'hover-light': 'rgba(255, 255, 255, 0.05)',
          },
        },
      ],
    },
  plugins: [
    daisyui,
  ],
} satisfies Config;
