<script lang="ts">
	import { onMount } from 'svelte';
	import { appState } from '$lib/stores/app-state.svelte';
	import ImageUploader from '$lib/components/ImageUploader.svelte';
	import ProcessingOverlay from '$lib/components/ProcessingOverlay.svelte';
	import ViewerShell from '$lib/components/ViewerShell.svelte';
	import ControlPanel from '$lib/components/ControlPanel.svelte';
	import { getDepthEstimationClient } from '$lib/workers/depth-estimation-client';
	import { depthDataToCanvas } from '$lib/depth/post-process';
	import { analyzeDepth } from '$lib/depth/auto-params';
	import { getGPUPostProcessor } from '$lib/gpu/gpu-post-processor';
	import { getModelGroups } from '$lib/depth/models';
	import type { ViewingModeId } from '$lib/stores/app-state.svelte';

	const modelGroups = getModelGroups();

	let viewerShell = $state<ViewerShell>();
	let showControls = $state(true);
	let hideTimeout: ReturnType<typeof setTimeout> | null = null;
	let isMobile = $state(false);

	onMount(async () => {
		isMobile = window.matchMedia('(max-width: 768px)').matches;

		if ('xr' in navigator) {
			try {
				appState.hasWebXR = await (navigator as any).xr.isSessionSupported('immersive-vr');
			} catch {
				appState.hasWebXR = false;
			}
		}
	});

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
			appState.depthCanvas = gpuProcessor.process(
				depthResult.depthData,
				depthResult.width,
				depthResult.height,
				suggested
			);

			appState.processingProgress = 1;
			appState.processingMessage = 'Done!';
			appState.stage = 'viewing';
		} catch (err) {
			console.error('Depth estimation failed:', err);
			appState.processingMessage = `Error: ${err instanceof Error ? err.message : 'Unknown error'}`;
		}
	}

	function handleModeChange(modeId: ViewingModeId) {
		viewerShell?.handleModeChange(modeId);
	}

	function handleConfigChange(key: string, value: unknown) {
		viewerShell?.handleConfigChange(key, value);
	}

	function handleDepthUpdate(canvas: HTMLCanvasElement) {
		viewerShell?.handleDepthUpdate(canvas);
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
							<option value={model.id}>{model.label}</option>
						{/each}
					</optgroup>
				{/each}
			</select>
		</label>
	</div>
{:else if appState.stage === 'processing'}
	<div class="min-h-screen bg-[#11111b] text-[#cdd6f4] font-sans">
		<ProcessingOverlay progress={appState.processingProgress} message={appState.processingMessage} />
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
			<ControlPanel onModeChange={handleModeChange} onConfigChange={handleConfigChange} onDepthUpdate={handleDepthUpdate} />
		</div>

		<!-- Desktop: fullscreen button -->
		<button
			class="hidden md:flex fixed bottom-4 right-4 z-10 w-10 h-10 items-center justify-center rounded-lg bg-[#1e1e2e]/80 border border-[#313244] text-[#a6adc8] hover:text-white hover:bg-[#1e1e2e] transition-all cursor-pointer"
			onclick={handleFullscreen}
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
				title="Toggle fullscreen"
			>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
				</svg>
			</button>
			<button
				class="w-12 h-12 flex items-center justify-center rounded-full bg-[#1e1e2e]/80 border border-[#313244] text-[#a6adc8] active:text-white transition-all"
				onclick={toggleControls}
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
			<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
			<div class="md:hidden fixed inset-0 z-20 bg-black/50" onclick={toggleControls}>
				<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
				<div class="absolute bottom-0 left-0 right-0 p-4 animate-slide-up" onclick={(e) => e.stopPropagation()}>
					<ControlPanel onModeChange={handleModeChange} onConfigChange={handleConfigChange} onDepthUpdate={handleDepthUpdate} />
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
</style>
