<script lang="ts">
	import { onMount } from 'svelte';
	import { appState, resetState } from '$lib/stores/app-state.svelte';
	import ImageUploader from '$lib/components/ImageUploader.svelte';
	import ProcessingOverlay from '$lib/components/ProcessingOverlay.svelte';
	import ViewerShell from '$lib/components/ViewerShell.svelte';
	import ControlPanel from '$lib/components/ControlPanel.svelte';
	import { getDepthEstimationClient } from '$lib/workers/depth-estimation-client';
	import { depthDataToCanvas } from '$lib/depth/post-process';
	import { analyzeDepth } from '$lib/depth/auto-params';
	import { getGPUPostProcessor, disposeGPUPostProcessor } from '$lib/gpu/gpu-post-processor';
	import { getModelGroups } from '$lib/depth/models';
	import { detectDepthEdges } from '$lib/inpainting/edge-detection';
	import { generateInpaintingMask } from '$lib/inpainting/mask-generation';
	import { getInpaintingClient } from '$lib/workers/inpainting-client';
	import type { ViewingModeId } from '$lib/stores/app-state.svelte';
	import type { RenderingMethod, InpaintingMethod } from '$lib/inpainting/types';
	import type { RendererConfig } from '$lib/renderer/types';

	const modelGroups = getModelGroups();

	let viewerShell = $state<ViewerShell>();
	let showControls = $state(true);
	let hideTimeout: ReturnType<typeof setTimeout> | null = null;
	let isMobile = $state(false);
	let meshRebuildTimeout: ReturnType<typeof setTimeout> | null = null;

	onMount(() => {
		isMobile = window.matchMedia('(max-width: 768px)').matches;

		(async () => {
			if ('xr' in navigator) {
				try {
					appState.hasWebXR = await (navigator as any).xr.isSessionSupported('immersive-vr');
				} catch {
					appState.hasWebXR = false;
				}
			}
		})();

		window.addEventListener('beforeunload', disposeGPUPostProcessor);
		return () => {
			window.removeEventListener('beforeunload', disposeGPUPostProcessor);
		};
	});

	/**
	 * Get the processed depth data (post-processed version).
	 * Cached to avoid re-allocating Float32Array on repeated calls.
	 * Invalidated when depthCanvas changes.
	 */
	let cachedDepthData: { data: Float32Array; width: number; height: number; canvas: HTMLCanvasElement } | null = null;

	function getProcessedDepthData(): { data: Float32Array; width: number; height: number } | null {
		if (!appState.depthCanvas) return null;
		const canvas = appState.depthCanvas;

		// Return cached if same canvas instance
		if (cachedDepthData && cachedDepthData.canvas === canvas) {
			return { data: cachedDepthData.data, width: cachedDepthData.width, height: cachedDepthData.height };
		}

		const ctx = canvas.getContext('2d');
		if (!ctx) return null;
		const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
		const data = new Float32Array(canvas.width * canvas.height);
		for (let i = 0; i < data.length; i++) {
			data[i] = imgData.data[i * 4] / 255;
		}
		cachedDepthData = { data, width: canvas.width, height: canvas.height, canvas };
		return { data, width: canvas.width, height: canvas.height };
	}

	function invalidateDepthCache() {
		cachedDepthData = null;
	}

	/**
	 * Extract RGBA pixel data from the uploaded image.
	 */
	function getPhotoImageData(): ImageData | null {
		const image = appState.uploadedImage;
		if (!image) return null;
		const canvas = document.createElement('canvas');
		const w = image.naturalWidth;
		const h = image.naturalHeight;
		canvas.width = w;
		canvas.height = h;
		const ctx = canvas.getContext('2d');
		if (!ctx) return null;
		ctx.drawImage(image, 0, 0);
		return ctx.getImageData(0, 0, w, h);
	}

	/**
	 * Run the inpainting pipeline: edge detection → mask generation → inpainting → canvas.
	 */
	async function runInpaintingPipeline(): Promise<void> {
		if (appState.inpaintingMethod === 'none' || appState.renderingMethod !== 'torn-mesh') {
			appState.inpaintedPhoto = null;
			return;
		}

		const depthResult = getProcessedDepthData();
		if (!depthResult) return;

		const photoData = getPhotoImageData();
		if (!photoData) return;

		appState.isInpainting = true;

		try {
			// 1. Edge detection (main thread, fast)
			const edges = detectDepthEdges(
				depthResult.data,
				depthResult.width,
				depthResult.height,
				appState.edgeThreshold
			);

			// 2. Mask generation (main thread, fast)
			const maskResult = generateInpaintingMask(
				edges,
				depthResult.data,
				depthResult.width,
				depthResult.height,
				photoData.width,
				photoData.height,
				appState.inpaintStripWidth
			);

			// 3. Run inpainting via worker
			const client = getInpaintingClient();
			let resultPixels: Uint8ClampedArray;

			if (appState.inpaintingMethod === 'migan') {
				if (!client.miganLoaded) {
					await client.loadMigan((msg) => {
						appState.processingMessage = msg;
					});
					appState.miganModelLoaded = true;
				}
				resultPixels = (await client.runMigan(
					photoData.data,
					maskResult.mask,
					photoData.width,
					photoData.height
				)).imageData;
			} else {
				resultPixels = (await client.runTelea(
					photoData.data,
					maskResult.mask,
					photoData.width,
					photoData.height,
					5
				)).imageData;
			}

			// 4. Convert result to canvas
			const canvas = document.createElement('canvas');
			canvas.width = photoData.width;
			canvas.height = photoData.height;
			const ctx = canvas.getContext('2d');
			if (!ctx) throw new Error('Failed to get 2d context for inpainting result');
			const imgData = ctx.createImageData(photoData.width, photoData.height);
			imgData.data.set(resultPixels);
			ctx.putImageData(imgData, 0, 0);
			appState.inpaintedPhoto = canvas;
		} catch (err) {
			console.error('Inpainting failed:', err);
			appState.inpaintedPhoto = null;
		} finally {
			appState.isInpainting = false;
		}
	}

	/**
	 * Build a RendererConfig from current app state.
	 */
	function buildRendererConfig(): RendererConfig {
		const depthResult = getProcessedDepthData();
		return {
			container: document.createElement('div'), // placeholder, not used by rebuildMesh
			photo: appState.uploadedImage!,
			depthCanvas: appState.depthCanvas!,
			displacementScale: appState.displacementScale,
			renderingMethod: appState.renderingMethod,
			inpaintedPhoto: appState.inpaintedPhoto,
			depthData: depthResult?.data ?? null,
			depthWidth: depthResult?.width ?? 0,
			depthHeight: depthResult?.height ?? 0,
			edgeThreshold: appState.edgeThreshold
		};
	}

	async function handleUpload(file: File, image: HTMLImageElement) {
		appState.uploadedFile = file;
		appState.uploadedImage = image;
		appState.stage = 'processing';
		appState.processingProgress = 0;
		appState.processingMessage = 'Loading AI model...';

		try {
			const depthClient = getDepthEstimationClient();

			// 0-70%: model loading
			await depthClient.initialize(appState.selectedModelId, (event) => {
				appState.processingProgress = event.progress * 0.7;
				appState.processingMessage = event.message;
			});

			appState.processingProgress = 0.7;
			appState.processingMessage = 'Estimating depth...';

			// 70-90%: inference (time-based smooth progress from worker)
			const depthResult = await depthClient.estimate(image, (event) => {
				if (event.stage === 'inference') {
					appState.processingProgress = 0.7 + event.progress * 0.2;
					appState.processingMessage = event.message;
				}
			});

			// Store raw depth data for later reprocessing by worker
			appState.rawDepthData = depthResult.depthData;
			appState.rawDepthWidth = depthResult.width;
			appState.rawDepthHeight = depthResult.height;

			// Also store as canvas for the depth preview
			appState.rawDepthCanvas = depthDataToCanvas(
				depthResult.depthData,
				depthResult.width,
				depthResult.height
			);

			appState.processingProgress = 0.9;
			appState.processingMessage = 'Analyzing depth...';

			// Auto-detect good post-processing parameters from the raw depth
			const suggested = analyzeDepth(
				depthResult.depthData,
				depthResult.width,
				depthResult.height
			);
			appState.postProcess = suggested;

			appState.processingMessage = 'Post-processing...';

			const gpuProcessor = getGPUPostProcessor();
			invalidateDepthCache();
		appState.depthCanvas = gpuProcessor.process(
				depthResult.depthData,
				depthResult.width,
				depthResult.height,
				suggested
			);

			// If torn-mesh mode selected, run inpainting before viewing
			if (appState.renderingMethod === 'torn-mesh' && appState.inpaintingMethod !== 'none') {
				appState.processingProgress = 0.95;
				appState.processingMessage = 'Inpainting...';
				await runInpaintingPipeline();
			}

			appState.processingProgress = 1;
			appState.processingMessage = 'Done!';
			appState.stage = 'viewing';
		} catch (err) {
			console.error('Depth estimation failed:', err);
			appState.processingError = err instanceof Error ? err.message : 'Unknown error';
			appState.processingMessage = `Error: ${appState.processingError}`;
		}
	}

	function handleRetry() {
		if (!appState.uploadedFile || !appState.uploadedImage) {
			resetState();
			return;
		}
		appState.processingError = null;
		handleUpload(appState.uploadedFile, appState.uploadedImage);
	}

	function handleBackToUpload() {
		invalidateDepthCache();
		resetState();
	}

	function handleModeChange(modeId: ViewingModeId) {
		viewerShell?.handleModeChange(modeId);
	}

	function handleConfigChange(key: string, value: unknown) {
		viewerShell?.handleConfigChange(key, value);
	}

	function handleDepthUpdate(canvas: HTMLCanvasElement) {
		invalidateDepthCache();
		if (appState.renderingMethod === 'torn-mesh') {
			// Torn mesh needs full rebuild when depth changes
			handleMeshRebuild();
		} else {
			viewerShell?.handleDepthUpdate(canvas);
		}
	}

	/**
	 * Handle mesh rebuild: re-run inpainting if needed, then rebuild the mesh.
	 * Debounced for MI-GAN (500ms), immediate for Telea.
	 */
	function handleMeshRebuild() {
		if (meshRebuildTimeout) {
			clearTimeout(meshRebuildTimeout);
			meshRebuildTimeout = null;
		}

		const delay = appState.inpaintingMethod === 'migan' ? 500 : 0;

		const doRebuild = async () => {
			if (appState.renderingMethod === 'torn-mesh' && appState.inpaintingMethod !== 'none') {
				await runInpaintingPipeline();
			} else {
				appState.inpaintedPhoto = null;
			}

			const config = buildRendererConfig();
			viewerShell?.handleMeshRebuild(config);
		};

		if (delay > 0) {
			meshRebuildTimeout = setTimeout(doRebuild, delay);
		} else {
			doRebuild();
		}
	}

	function handleMouseMoveDesktop(e: MouseEvent) {
		if (isMobile) return;
		const threshold = 350;
		const inArea = e.clientX > window.innerWidth - threshold && e.clientY < threshold;
		if (inArea) {
			showControls = true;
			if (hideTimeout) clearTimeout(hideTimeout);
		} else if (showControls) {
			if (hideTimeout) clearTimeout(hideTimeout);
			hideTimeout = setTimeout(() => {
				showControls = false;
			}, 600);
		}
	}

	function toggleControls() {
		showControls = !showControls;
	}

	function handleFullscreen() {
		viewerShell?.toggleFullscreen();
	}
</script>

<svelte:head>
	<title>3D Photo Viewer</title>
</svelte:head>

{#if appState.stage === 'upload'}
	<div class="flex flex-col items-center justify-center min-h-screen bg-[#11111b] text-[#cdd6f4] font-sans p-4">
		<header class="text-center mb-4">
			<h1 class="text-3xl font-bold">3D Photo Viewer</h1>
			<p class="text-[#6c7086] mt-2">Upload a 2D photo and view it in 3D</p>
		</header>
		<ImageUploader onUpload={handleUpload} />

		<label class="mt-6 w-full max-w-md block">
			<span class="block text-xs text-[#6c7086] mb-1.5">Depth Model</span>
			<select
				class="w-full px-3 py-2 rounded-lg bg-[#1e1e2e] border border-[#313244] text-[#cdd6f4] text-sm focus:outline-none focus:border-blue-400 cursor-pointer"
				value={appState.selectedModelId}
				onchange={(e) => (appState.selectedModelId = (e.target as HTMLSelectElement).value)}
			>
				{#each modelGroups as { group, models }}
					<optgroup label={group}>
						{#each models as model}
							<option value={model.id}>{model.label} [{model.depthRes}px]</option>
						{/each}
					</optgroup>
				{/each}
			</select>
		</label>

		<label class="mt-3 w-full max-w-md block">
			<span class="block text-xs text-[#6c7086] mb-1.5">Rendering Method</span>
			<select
				class="w-full px-3 py-2 rounded-lg bg-[#1e1e2e] border border-[#313244] text-[#cdd6f4] text-sm focus:outline-none focus:border-blue-400 cursor-pointer"
				value={appState.renderingMethod}
				onchange={(e) => (appState.renderingMethod = (e.target as HTMLSelectElement).value as RenderingMethod)}
			>
				<option value="simple">Simple (Displacement Map)</option>
				<option value="torn-mesh">Torn Mesh (Removes depth edges)</option>
			</select>
		</label>

		{#if appState.renderingMethod === 'torn-mesh'}
			<label class="mt-3 w-full max-w-md block">
				<span class="block text-xs text-[#6c7086] mb-1.5">Inpainting Method</span>
				<select
					class="w-full px-3 py-2 rounded-lg bg-[#1e1e2e] border border-[#313244] text-[#cdd6f4] text-sm focus:outline-none focus:border-blue-400 cursor-pointer"
					value={appState.inpaintingMethod}
					onchange={(e) => (appState.inpaintingMethod = (e.target as HTMLSelectElement).value as InpaintingMethod)}
				>
					<option value="none">None</option>
					<option value="telea">Telea (Fast, CPU-based)</option>
					<option value="migan">MI-GAN (Neural, ~28MB download)</option>
				</select>
			</label>
		{/if}
	</div>
{:else if appState.stage === 'processing'}
	<div class="min-h-screen bg-[#11111b] text-[#cdd6f4] font-sans">
		<ProcessingOverlay
			progress={appState.processingProgress}
			message={appState.processingMessage}
			error={appState.processingError}
			onRetry={handleRetry}
			onBack={handleBackToUpload}
		/>
	</div>
{:else if appState.stage === 'viewing'}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 bg-[#11111b]" onmousemove={handleMouseMoveDesktop}>
		<!-- Full-screen viewer -->
		<ViewerShell bind:this={viewerShell} />

		<!-- Depth map preview overlay -->
		{#if appState.showDepthPreview && appState.depthCanvas}
			<div class="fixed bottom-4 left-4 z-10 rounded-lg overflow-hidden border border-[#313244] shadow-xl">
				<canvas
					class="block max-w-48 max-h-36"
					width={appState.depthCanvas.width}
					height={appState.depthCanvas.height}
					use:drawDepthPreview={appState.depthCanvas}
				></canvas>
				<div class="absolute top-1 left-1.5 text-[10px] text-white/70 bg-black/50 px-1 rounded">Depth Map</div>
			</div>
		{/if}

		<!-- Desktop: floating control panel, auto-hides -->
		<div
			class="hidden md:block fixed top-4 right-4 w-80 transition-all duration-300 z-10 {showControls ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 pointer-events-none'}"
		>
			<ControlPanel onModeChange={handleModeChange} onConfigChange={handleConfigChange} onDepthUpdate={handleDepthUpdate} onMeshRebuild={handleMeshRebuild} />
		</div>

		<!-- Desktop: fullscreen button -->
		<button
			class="hidden md:flex fixed bottom-4 right-4 z-10 w-11 h-11 items-center justify-center rounded-lg bg-[#1e1e2e]/80 border border-[#313244] text-[#a6adc8] hover:text-white hover:bg-[#1e1e2e] transition-all cursor-pointer"
			onclick={handleFullscreen}
			aria-label="Toggle fullscreen"
			title="Toggle fullscreen"
		>
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
			</svg>
		</button>

		<!-- Mobile: floating action buttons -->
		<div class="flex md:hidden fixed bottom-4 right-4 z-10 gap-2">
			<button
				class="w-12 h-12 flex items-center justify-center rounded-full bg-[#1e1e2e]/80 border border-[#313244] text-[#a6adc8] active:text-white transition-all"
				onclick={handleFullscreen}
				aria-label="Toggle fullscreen"
				title="Toggle fullscreen"
			>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
				</svg>
			</button>
			<button
				class="w-12 h-12 flex items-center justify-center rounded-full bg-[#1e1e2e]/80 border border-[#313244] text-[#a6adc8] active:text-white transition-all"
				onclick={toggleControls}
				aria-label="Open settings"
				title="Settings"
			>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="3" />
					<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
				</svg>
			</button>
		</div>

		<!-- Mobile: slide-up controls panel -->
		{#if isMobile && showControls}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="md:hidden fixed inset-0 z-20 bg-black/50"
				role="dialog"
				aria-label="Settings panel"
				tabindex="-1"
				onclick={toggleControls}
				onkeydown={(e) => { if (e.key === 'Escape') toggleControls(); }}
			>
				<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
				<div class="absolute bottom-0 left-0 right-0 p-4 animate-slide-up" onclick={(e) => e.stopPropagation()}>
					<ControlPanel onModeChange={handleModeChange} onConfigChange={handleConfigChange} onDepthUpdate={handleDepthUpdate} onMeshRebuild={handleMeshRebuild} />
				</div>
			</div>
		{/if}
	</div>
{/if}

<script lang="ts" module>
	function drawDepthPreview(canvas: HTMLCanvasElement, depthCanvas: HTMLCanvasElement) {
		const ctx = canvas.getContext('2d');
		if (ctx && depthCanvas) {
			canvas.width = depthCanvas.width;
			canvas.height = depthCanvas.height;
			ctx.drawImage(depthCanvas, 0, 0);
		}

		return {
			update(newDepthCanvas: HTMLCanvasElement) {
				const ctx2 = canvas.getContext('2d');
				if (ctx2 && newDepthCanvas) {
					canvas.width = newDepthCanvas.width;
					canvas.height = newDepthCanvas.height;
					ctx2.drawImage(newDepthCanvas, 0, 0);
				}
			}
		};
	}
</script>

<style>
	@keyframes slide-up {
		from {
			transform: translateY(100%);
		}
		to {
			transform: translateY(0);
		}
	}

	:global(.animate-slide-up) {
		animation: slide-up 0.25s ease-out;
	}

	@media (prefers-reduced-motion: reduce) {
		:global(.animate-slide-up) {
			animation: none;
		}
	}
</style>
