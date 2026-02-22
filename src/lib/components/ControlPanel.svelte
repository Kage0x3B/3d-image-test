<script lang="ts">
	import { appState, resetState, type ViewingModeId } from '$lib/stores/app-state.svelte';
	import { listModes } from '$lib/modes';
	import { getGPUPostProcessor } from '$lib/gpu/gpu-post-processor';
	import type { RenderingMethod, InpaintingMethod } from '$lib/inpainting/types';

	let modes = listModes().filter((m) => m.id !== 'webxr' || appState.hasWebXR);

	interface Props {
		onModeChange?: (modeId: ViewingModeId) => void;
		onConfigChange?: (key: string, value: unknown) => void;
		onDepthUpdate?: (canvas: HTMLCanvasElement) => void;
		onMeshRebuild?: () => void;
	}
	let { onModeChange, onConfigChange, onDepthUpdate, onMeshRebuild }: Props = $props();

	let showDepthSettings = $state(false);
	let showModeSettings = $state(true);
	let showRenderSettings = $state(false);
	let showMeshSettings = $state(false);

	function selectMode(id: string) {
		appState.activeMode = id as ViewingModeId;
		onModeChange?.(id as ViewingModeId);
	}

	// --- Depth post-processing ---

	function reprocessDepth() {
		if (!appState.rawDepthData) return;

		const processor = getGPUPostProcessor();
		const canvas = processor.process(
			appState.rawDepthData,
			appState.rawDepthWidth,
			appState.rawDepthHeight,
			JSON.parse(JSON.stringify(appState.postProcess))
		);
		appState.depthCanvas = canvas;
		onDepthUpdate?.(canvas);
	}

	function updatePostProcess(key: string, value: number | boolean) {
		(appState.postProcess as any)[key] = value;
		reprocessDepth();
	}

	// --- Render settings ---

	function updateDisplacement(e: Event) {
		const value = parseFloat((e.target as HTMLInputElement).value);
		appState.displacementScale = value;
		onConfigChange?.('displacementScale', value);
	}

	// --- Mesh & Inpainting settings ---

	function updateRenderingMethod(e: Event) {
		const value = (e.target as HTMLSelectElement).value as RenderingMethod;
		appState.renderingMethod = value;
		onMeshRebuild?.();
	}

	function updateInpaintingMethod(e: Event) {
		const value = (e.target as HTMLSelectElement).value as InpaintingMethod;
		appState.inpaintingMethod = value;
		onMeshRebuild?.();
	}

	function updateEdgeThreshold(e: Event) {
		const value = parseFloat((e.target as HTMLInputElement).value);
		appState.edgeThreshold = value;
		onMeshRebuild?.();
	}

	function updateInpaintStripWidth(e: Event) {
		const value = parseInt((e.target as HTMLInputElement).value);
		appState.inpaintStripWidth = value;
		onMeshRebuild?.();
	}

	// --- Parallax settings ---

	function updateParallaxMaxOffset(e: Event) {
		const v = parseFloat((e.target as HTMLInputElement).value);
		appState.parallaxMaxOffset = v;
		onConfigChange?.('maxOffset', v);
	}

	function updateParallaxSmoothing(e: Event) {
		const v = parseFloat((e.target as HTMLInputElement).value);
		appState.parallaxSmoothing = v;
		onConfigChange?.('smoothing', v);
	}

	function toggleAutoWiggle() {
		appState.parallaxAutoWiggle = !appState.parallaxAutoWiggle;
		onConfigChange?.('autoWiggle', appState.parallaxAutoWiggle);
	}

	function updateAutoWiggleSpeed(e: Event) {
		const v = parseFloat((e.target as HTMLInputElement).value);
		appState.parallaxAutoWiggleSpeed = v;
		onConfigChange?.('autoWiggleSpeed', v);
	}

	// --- Stereo settings ---

	function toggleCrossEye() {
		appState.stereoCrossEye = !appState.stereoCrossEye;
		onConfigChange?.('crossEye', appState.stereoCrossEye);
	}

	function updateEyeSeparation(e: Event) {
		const v = parseFloat((e.target as HTMLInputElement).value);
		appState.stereoEyeSeparation = v;
		onConfigChange?.('eyeSeparation', v);
	}

	// --- WebXR settings ---

	function updateViewingDistance(e: Event) {
		const v = parseFloat((e.target as HTMLInputElement).value);
		appState.webxrViewingDistance = v;
		onConfigChange?.('viewingDistance', v);
	}

	function toggleDepthPreview() {
		appState.showDepthPreview = !appState.showDepthPreview;
	}
</script>

<div class="p-4 bg-[#1e1e2e] rounded-xl border border-[#313244] max-h-[calc(100vh-2rem)] overflow-y-auto space-y-3 text-sm">
	<!-- Mode tabs -->
	<div class="flex gap-1.5" role="tablist" aria-label="Viewing mode">
		{#each modes as mode}
			<button
				role="tab"
				aria-selected={appState.activeMode === mode.id}
				class="flex-1 px-3 py-2 rounded-lg text-sm transition-all cursor-pointer border {appState.activeMode === mode.id
					? 'bg-blue-400 text-[#1e1e2e] border-blue-400 font-semibold'
					: 'bg-transparent text-[#a6adc8] border-[#313244] hover:border-blue-400 hover:text-[#cdd6f4]'}"
				onclick={() => selectMode(mode.id)}
			>
				{mode.label}
			</button>
		{/each}
	</div>

	<!-- Rendering Settings -->
	<div>
		<button
			class="flex items-center justify-between w-full text-[#cdd6f4] font-medium py-1 cursor-pointer"
			onclick={() => (showRenderSettings = !showRenderSettings)}
			aria-expanded={showRenderSettings}
			aria-controls="render-settings"
		>
			<span>Rendering</span>
			<span class="text-[#6c7086] text-xs">{showRenderSettings ? '▾' : '▸'}</span>
		</button>
		{#if showRenderSettings}
			<div id="render-settings" class="flex flex-col gap-2.5 pt-1">
				<label class="flex items-center gap-3 text-[#cdd6f4]">
					<span class="min-w-24 text-xs">Depth Intensity</span>
					<input type="range" min="0" max="1" step="0.01" value={appState.displacementScale}
						oninput={updateDisplacement} class="flex-1 accent-blue-400" />
					<span class="min-w-9 text-right font-mono text-xs text-[#6c7086]">{appState.displacementScale.toFixed(2)}</span>
				</label>
			</div>
		{/if}
	</div>

	<!-- Mesh & Inpainting Settings -->
	<div>
		<button
			class="flex items-center justify-between w-full text-[#cdd6f4] font-medium py-1 cursor-pointer"
			onclick={() => (showMeshSettings = !showMeshSettings)}
			aria-expanded={showMeshSettings}
			aria-controls="mesh-settings"
		>
			<span>Mesh & Inpainting</span>
			<span class="text-[#6c7086] text-xs">{showMeshSettings ? '▾' : '▸'}</span>
		</button>
		{#if showMeshSettings}
			<div id="mesh-settings" class="flex flex-col gap-2.5 pt-1">
				<label class="flex flex-col gap-1 text-[#cdd6f4]">
					<span class="text-xs">Rendering Method</span>
					<select
						class="w-full px-2 py-1.5 rounded-lg bg-[#11111b] border border-[#313244] text-[#cdd6f4] text-xs focus:outline-none focus:border-blue-400 cursor-pointer"
						value={appState.renderingMethod}
						onchange={updateRenderingMethod}
					>
						<option value="simple">Simple (Displacement Map)</option>
						<option value="torn-mesh">Torn Mesh</option>
					</select>
				</label>

				{#if appState.renderingMethod === 'torn-mesh'}
					<label class="flex flex-col gap-1 text-[#cdd6f4]">
						<span class="text-xs">Inpainting Method</span>
						<select
							class="w-full px-2 py-1.5 rounded-lg bg-[#11111b] border border-[#313244] text-[#cdd6f4] text-xs focus:outline-none focus:border-blue-400 cursor-pointer"
							value={appState.inpaintingMethod}
							onchange={updateInpaintingMethod}
						>
							<option value="none">None</option>
							<option value="telea">Telea (Fast)</option>
							<option value="migan">MI-GAN (Neural){appState.miganModelLoaded ? '' : ' - Downloads ~28MB'}</option>
						</select>
					</label>

					<label class="flex items-center gap-3 text-[#cdd6f4]">
						<span class="min-w-24 text-xs">Edge Threshold</span>
						<input type="range" min="0.05" max="0.5" step="0.01" value={appState.edgeThreshold}
							oninput={updateEdgeThreshold} class="flex-1 accent-blue-400" />
						<span class="min-w-9 text-right font-mono text-xs text-[#6c7086]">{appState.edgeThreshold.toFixed(2)}</span>
					</label>

					{#if appState.inpaintingMethod !== 'none'}
						<label class="flex items-center gap-3 text-[#cdd6f4]">
							<span class="min-w-24 text-xs">Inpaint Width</span>
							<input type="range" min="5" max="60" step="1" value={appState.inpaintStripWidth}
								oninput={updateInpaintStripWidth} class="flex-1 accent-blue-400" />
							<span class="min-w-9 text-right font-mono text-xs text-[#6c7086]">{appState.inpaintStripWidth}px</span>
						</label>
					{/if}

					{#if appState.isInpainting}
						<div class="text-xs text-blue-400 animate-pulse">Inpainting...</div>
					{/if}
				{/if}
			</div>
		{/if}
	</div>

	<!-- Mode-Specific Settings -->
	<div>
		<button
			class="flex items-center justify-between w-full text-[#cdd6f4] font-medium py-1 cursor-pointer"
			onclick={() => (showModeSettings = !showModeSettings)}
			aria-expanded={showModeSettings}
			aria-controls="mode-settings"
		>
			<span>Mode Settings</span>
			<span class="text-[#6c7086] text-xs">{showModeSettings ? '▾' : '▸'}</span>
		</button>
		{#if showModeSettings}
			<div id="mode-settings" class="flex flex-col gap-2.5 pt-1">
				{#if appState.activeMode === 'parallax'}
					<label class="flex items-center gap-3 text-[#cdd6f4]">
						<span class="min-w-24 text-xs">Movement Range</span>
						<input type="range" min="0.01" max="0.25" step="0.005" value={appState.parallaxMaxOffset}
							oninput={updateParallaxMaxOffset} class="flex-1 accent-blue-400" />
						<span class="min-w-9 text-right font-mono text-xs text-[#6c7086]">{appState.parallaxMaxOffset.toFixed(3)}</span>
					</label>
					<label class="flex items-center gap-3 text-[#cdd6f4]">
						<span class="min-w-24 text-xs">Smoothing</span>
						<input type="range" min="0.01" max="0.3" step="0.005" value={appState.parallaxSmoothing}
							oninput={updateParallaxSmoothing} class="flex-1 accent-blue-400" />
						<span class="min-w-9 text-right font-mono text-xs text-[#6c7086]">{appState.parallaxSmoothing.toFixed(3)}</span>
					</label>
					<label class="flex items-center gap-2 text-[#cdd6f4] text-xs cursor-pointer">
						<input type="checkbox" checked={appState.parallaxAutoWiggle} onchange={toggleAutoWiggle} class="accent-blue-400" />
						<span>Auto wiggle</span>
					</label>
					{#if appState.parallaxAutoWiggle}
						<label class="flex items-center gap-3 text-[#cdd6f4]">
							<span class="min-w-24 text-xs">Wiggle Speed</span>
							<input type="range" min="0.1" max="3" step="0.1" value={appState.parallaxAutoWiggleSpeed}
								oninput={updateAutoWiggleSpeed} class="flex-1 accent-blue-400" />
							<span class="min-w-9 text-right font-mono text-xs text-[#6c7086]">{appState.parallaxAutoWiggleSpeed.toFixed(1)}</span>
						</label>
					{/if}
				{/if}

				{#if appState.activeMode === 'stereo'}
					<label class="flex items-center gap-2 text-[#cdd6f4] text-xs cursor-pointer">
						<input type="checkbox" checked={appState.stereoCrossEye} onchange={toggleCrossEye} class="accent-blue-400" />
						<span>Cross-eye view</span>
					</label>
					<label class="flex items-center gap-3 text-[#cdd6f4]">
						<span class="min-w-24 text-xs">Eye Separation</span>
						<input type="range" min="0.01" max="0.2" step="0.005" value={appState.stereoEyeSeparation}
							oninput={updateEyeSeparation} class="flex-1 accent-blue-400" />
						<span class="min-w-9 text-right font-mono text-xs text-[#6c7086]">{appState.stereoEyeSeparation.toFixed(3)}</span>
					</label>
				{/if}

				{#if appState.activeMode === 'webxr'}
					<label class="flex items-center gap-3 text-[#cdd6f4]">
						<span class="min-w-24 text-xs">View Distance</span>
						<input type="range" min="0.5" max="5" step="0.1" value={appState.webxrViewingDistance}
							oninput={updateViewingDistance} class="flex-1 accent-blue-400" />
						<span class="min-w-9 text-right font-mono text-xs text-[#6c7086]">{appState.webxrViewingDistance.toFixed(1)}m</span>
					</label>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Depth Post-Processing -->
	<div>
		<button
			class="flex items-center justify-between w-full text-[#cdd6f4] font-medium py-1 cursor-pointer"
			onclick={() => (showDepthSettings = !showDepthSettings)}
			aria-expanded={showDepthSettings}
			aria-controls="depth-settings"
		>
			<span>Depth Processing</span>
			<span class="text-[#6c7086] text-xs">{showDepthSettings ? '▾' : '▸'}</span>
		</button>
		{#if showDepthSettings}
			<div id="depth-settings" class="flex flex-col gap-2.5 pt-1">
				<label class="flex items-center gap-2 text-[#cdd6f4] text-xs cursor-pointer">
					<input type="checkbox" checked={appState.postProcess.invert}
						onchange={() => updatePostProcess('invert', !appState.postProcess.invert)} class="accent-blue-400" />
					<span>Invert depth</span>
				</label>

				<label class="flex items-center gap-3 text-[#cdd6f4]">
					<span class="min-w-24 text-xs">Contrast</span>
					<input type="range" min="0.5" max="3" step="0.05" value={appState.postProcess.contrast}
						oninput={(e) => updatePostProcess('contrast', parseFloat((e.target as HTMLInputElement).value))}
						class="flex-1 accent-blue-400" />
					<span class="min-w-9 text-right font-mono text-xs text-[#6c7086]">{appState.postProcess.contrast.toFixed(2)}</span>
				</label>

				<label class="flex items-center gap-3 text-[#cdd6f4]">
					<span class="min-w-24 text-xs">Brightness</span>
					<input type="range" min="-0.5" max="0.5" step="0.01" value={appState.postProcess.brightness}
						oninput={(e) => updatePostProcess('brightness', parseFloat((e.target as HTMLInputElement).value))}
						class="flex-1 accent-blue-400" />
					<span class="min-w-9 text-right font-mono text-xs text-[#6c7086]">{appState.postProcess.brightness.toFixed(2)}</span>
				</label>

				<label class="flex items-center gap-3 text-[#cdd6f4]">
					<span class="min-w-24 text-xs">Blur</span>
					<input type="range" min="0" max="5" step="0.25" value={appState.postProcess.gaussianSigma}
						oninput={(e) => updatePostProcess('gaussianSigma', parseFloat((e.target as HTMLInputElement).value))}
						class="flex-1 accent-blue-400" />
					<span class="min-w-9 text-right font-mono text-xs text-[#6c7086]">{appState.postProcess.gaussianSigma.toFixed(1)}</span>
				</label>

				<label class="flex items-center gap-3 text-[#cdd6f4]">
					<span class="min-w-24 text-xs">Edge Smooth</span>
					<input type="range" min="0" max="5" step="1" value={appState.postProcess.bilateralIterations}
						oninput={(e) => updatePostProcess('bilateralIterations', parseInt((e.target as HTMLInputElement).value))}
						class="flex-1 accent-blue-400" />
					<span class="min-w-9 text-right font-mono text-xs text-[#6c7086]">{appState.postProcess.bilateralIterations}</span>
				</label>

				{#if appState.postProcess.bilateralIterations > 0}
					<label class="flex items-center gap-3 text-[#cdd6f4]">
						<span class="min-w-24 text-xs">Spatial Sigma</span>
						<input type="range" min="1" max="10" step="0.5" value={appState.postProcess.bilateralSpatialSigma}
							oninput={(e) => updatePostProcess('bilateralSpatialSigma', parseFloat((e.target as HTMLInputElement).value))}
							class="flex-1 accent-blue-400" />
						<span class="min-w-9 text-right font-mono text-xs text-[#6c7086]">{appState.postProcess.bilateralSpatialSigma.toFixed(1)}</span>
					</label>
					<label class="flex items-center gap-3 text-[#cdd6f4]">
						<span class="min-w-24 text-xs">Range Sigma</span>
						<input type="range" min="0.01" max="0.5" step="0.01" value={appState.postProcess.bilateralRangeSigma}
							oninput={(e) => updatePostProcess('bilateralRangeSigma', parseFloat((e.target as HTMLInputElement).value))}
							class="flex-1 accent-blue-400" />
						<span class="min-w-9 text-right font-mono text-xs text-[#6c7086]">{appState.postProcess.bilateralRangeSigma.toFixed(2)}</span>
					</label>
				{/if}

				<button
					class="text-xs text-[#a6adc8] hover:text-[#cdd6f4] cursor-pointer transition-colors py-1"
					onclick={toggleDepthPreview}
				>
					{appState.showDepthPreview ? 'Hide' : 'Show'} depth map preview
				</button>
			</div>
		{/if}
	</div>

	<!-- Actions -->
	<div class="pt-1 border-t border-[#313244]">
		<button
			class="w-full py-2 rounded-lg text-xs border border-[#313244] bg-transparent text-[#a6adc8] cursor-pointer transition-all hover:border-red-400 hover:text-red-400"
			onclick={resetState}
		>
			Upload New Image
		</button>
	</div>
</div>
