<script lang="ts">
	interface Props {
		onUpload: (file: File, image: HTMLImageElement) => void;
	}
	let { onUpload }: Props = $props();

	let isDragging = $state(false);
	let fileInput: HTMLInputElement;

	function handleFile(file: File) {
		if (!file.type.startsWith('image/')) return;

		const img = new Image();
		img.onload = () => {
			onUpload(file, img);
		};
		img.src = URL.createObjectURL(file);
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
		const file = e.dataTransfer?.files[0];
		if (file) handleFile(file);
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		isDragging = true;
	}

	function handleDragLeave() {
		isDragging = false;
	}

	function handleInputChange(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) handleFile(file);
	}
</script>

<div
	class="flex items-center justify-center w-full max-w-xl min-h-72 mx-auto my-8 p-12 border-2 border-dashed rounded-2xl cursor-pointer transition-all bg-[#1e1e2e] text-[#cdd6f4] {isDragging ? 'border-blue-400 bg-[#1e1e3e]' : 'border-[#555] hover:border-blue-400 hover:bg-[#1e1e3e]'}"
	role="button"
	tabindex="0"
	ondrop={handleDrop}
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	onclick={() => fileInput.click()}
	onkeydown={(e) => e.key === 'Enter' && fileInput.click()}
>
	<div class="text-center">
		<svg class="mx-auto mb-4 text-blue-400" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
			<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
			<polyline points="17 8 12 3 7 8" />
			<line x1="12" y1="3" x2="12" y2="15" />
		</svg>
		<h2 class="text-2xl font-semibold mb-2">Upload a Photo</h2>
		<p class="text-[#a6adc8]">Drag & drop an image here, or click to browse</p>
		<p class="text-sm text-[#6c7086] mt-1">Supports JPEG, PNG, WebP</p>
	</div>
	<input
		bind:this={fileInput}
		type="file"
		accept="image/jpeg,image/png,image/webp"
		onchange={handleInputChange}
		hidden
	/>
</div>
