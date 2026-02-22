<script lang="ts">
	const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
	const MAX_DIMENSION = 8192;
	const MIN_DIMENSION = 10;
	const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

	interface Props {
		onUpload: (file: File, image: HTMLImageElement) => void;
	}
	let { onUpload }: Props = $props();

	let isDragging = $state(false);
	let validationError = $state<string | null>(null);
	let fileInput: HTMLInputElement;

	function handleFile(file: File) {
		validationError = null;

		if (!ACCEPTED_TYPES.includes(file.type)) {
			validationError = 'Unsupported file type. Please use JPEG, PNG, or WebP.';
			return;
		}

		if (file.size > MAX_FILE_SIZE) {
			validationError = `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is 50MB.`;
			return;
		}

		const url = URL.createObjectURL(file);
		const img = new Image();
		img.onload = () => {
			const w = img.naturalWidth;
			const h = img.naturalHeight;

			if (w < MIN_DIMENSION || h < MIN_DIMENSION) {
				validationError = `Image too small (${w}x${h}). Minimum is ${MIN_DIMENSION}x${MIN_DIMENSION}px.`;
				URL.revokeObjectURL(url);
				return;
			}

			if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
				validationError = `Image too large (${w}x${h}). Maximum is ${MAX_DIMENSION}x${MAX_DIMENSION}px.`;
				URL.revokeObjectURL(url);
				return;
			}

			onUpload(file, img);
		};
		img.onerror = () => {
			validationError = 'Failed to load image. The file may be corrupted.';
			URL.revokeObjectURL(url);
		};
		img.src = url;
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

<div>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
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
			<p class="text-sm text-[#6c7086] mt-1">Supports JPEG, PNG, WebP (max 50MB, 8192x8192px)</p>
		</div>
		<input
			bind:this={fileInput}
			type="file"
			accept="image/jpeg,image/png,image/webp"
			onchange={handleInputChange}
			hidden
		/>
	</div>
	{#if validationError}
		<p class="text-red-400 text-sm text-center mt-3 max-w-xl mx-auto">{validationError}</p>
	{/if}
</div>
