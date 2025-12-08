import devtoolsJson from 'vite-plugin-devtools-json'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { sveltekit } from '@sveltejs/kit/vite'

export default defineConfig({
	plugins: [tailwindcss(), sveltekit(), devtoolsJson()],
	server: {
		proxy: {
			'/api': {
				target: 'http://localhost:3030',
				changeOrigin: true,
			},
		},
	},
})
