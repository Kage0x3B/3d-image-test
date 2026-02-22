<script lang="ts">
	interface Props {
		progress: number;
		message: string;
		error?: string | null;
		onRetry?: () => void;
		onBack?: () => void;
	}
	let { progress, message, error = null, onRetry, onBack }: Props = $props();
</script>

<div class="flex items-center justify-center w-full min-h-[80vh]" role="status" aria-live="polite">
	<div class="text-center p-12 bg-[#1e1e2e] rounded-2xl border border-[#313244] max-w-sm w-full">
		{#if error}
			<div class="w-12 h-12 mx-auto mb-6 flex items-center justify-center text-red-400">
				<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="10" />
					<line x1="15" y1="9" x2="9" y2="15" />
					<line x1="9" y1="9" x2="15" y2="15" />
				</svg>
			</div>
			<h2 class="text-xl font-semibold text-[#cdd6f4] mb-2">Processing Failed</h2>
			<p class="text-red-400/80 text-sm mb-6 min-h-[1.4em]">{error}</p>
			<div class="flex gap-3">
				<button
					class="flex-1 py-2.5 rounded-lg text-sm border border-[#313244] bg-transparent text-[#a6adc8] cursor-pointer transition-all hover:border-[#cdd6f4] hover:text-[#cdd6f4]"
					onclick={onBack}
				>
					Upload New Image
				</button>
				<button
					class="flex-1 py-2.5 rounded-lg text-sm border border-blue-400 bg-blue-400 text-[#1e1e2e] font-semibold cursor-pointer transition-all hover:bg-blue-300"
					onclick={onRetry}
				>
					Retry
				</button>
			</div>
		{:else}
			<div class="w-12 h-12 border-3 border-[#313244] border-t-blue-400 rounded-full mx-auto mb-6 animate-spin"></div>
			<h2 class="text-xl font-semibold text-[#cdd6f4] mb-2">Processing Image</h2>
			<p class="text-[#a6adc8] text-sm mb-6 min-h-[1.4em]">{message || 'Initializing...'}</p>
			<div class="w-full h-2 bg-[#313244] rounded-full overflow-hidden">
				<div
					class="h-full bg-blue-400 rounded-full transition-[width] duration-300"
					style="width: {Math.round(progress * 100)}%"
				></div>
			</div>
			<p class="text-[#6c7086] text-sm mt-3">{Math.round(progress * 100)}%</p>
		{/if}
	</div>
</div>
