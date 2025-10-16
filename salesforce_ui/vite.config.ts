import devtoolsJson from 'vite-plugin-devtools-json';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite'
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		devtoolsJson(),
	],
	// test: {
	// 	expect: { requireAssertions: true },
	// 	projects: [
	// 		{
	// 			extends: './vite.config.ts',
	// 			test: {
	// 				name: 'client',
	// 				environment: 'browser',
	// 				browser: {
	// 					enabled: true,
	// 					provider: 'playwright',
	// 					instances: [{ browser: 'chromium' }]
	// 				},
	// 				include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
	// 				setupFiles: ['./vitest-setup-client.ts']
	// 			}
	// 		},
	// 	]
	// },
	server: {
		proxy: {
			'/api': {
				target: 'http://localhost:8080',
				changeOrigin: true
			},
		}
	}
});
