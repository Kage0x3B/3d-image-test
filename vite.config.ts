import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	build: {
		target: 'esnext'
	},
	worker: {
		format: 'es'
	},
	optimizeDeps: {
		exclude: ['@huggingface/transformers']
	},
	server: {
		host:true
	}
});
