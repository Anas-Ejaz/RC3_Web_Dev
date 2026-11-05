import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
  ],
  theme: {
  	container: {
  		center: true,
  		padding: '1.25rem',
  		screens: {
  			'2xl': '1280px'
  		}
  	},
  	extend: {
  		fontFamily: {
  			sans: [
  				'var(--font-sans)',
  				'ui-sans-serif',
  				'system-ui',
  				'sans-serif'
  			],
  			serif: [
  				'var(--font-serif)',
  				'ui-serif',
  				'Georgia',
  				'serif'
  			]
  		},
  		colors: {
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: 'hsl(var(--destructive))',
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			forest: {
  				'500': '#2B6446',
  				'600': '#1F4A33',
  				'700': '#173826',
  				'800': '#10261A',
  				'900': '#0B1A12',
  				'950': '#07120C'
  			},
  			cream: {
  				'50': '#FBFAF7',
  				'100': '#F7F5F0',
  				'200': '#F1EDE4',
  				'300': '#E6E0D3',
  				'400': '#D5CDBB'
  			},
  			lime: {
  				DEFAULT: '#E6F51F',
  				dark: '#D2E30C',
  				soft: '#F4FBA8'
  			},
  			evidence: {
  				confirmed: {
  					bg: '#DFF3E4',
  					fg: '#14532D',
  					border: '#A7D9B5'
  				},
  				weak: {
  					bg: '#FEF6C7',
  					fg: '#6B4A06',
  					border: '#F2DC7B'
  				},
  				none: {
  					bg: '#F5EBDD',
  					fg: '#6B4E1F',
  					border: '#E3CFAE'
  				}
  			},
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)',
  			xl: '1.25rem',
  			'2xl': '1.5rem',
  			'3xl': '2rem'
  		},
  		boxShadow: {
  			card: '0 1px 2px rgba(11,26,18,0.04), 0 8px 24px -12px rgba(11,26,18,0.12)'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;