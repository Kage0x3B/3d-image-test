<script lang="ts">
	interface Props {
		progress: number;
		message: string;
	}
	let { progress, message }: Props = $props();
</script>

<div class="flex items-center justify-center w-full min-h-[80vh]">
	<div class="text-center p-12 bg-[#1e1e2e] rounded-2xl border border-[#313244] max-w-sm w-full">
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
	</div>
</div>
