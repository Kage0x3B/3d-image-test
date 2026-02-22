<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		createSceneContext,
		disposeSceneContext,
		handleResize,
		rebuildMesh
	} from '$lib/renderer/scene-manager';
	import { getMode } from '$lib/modes';
	import { appState } from '$lib/stores/app-state.svelte';
	import { canvasToTexture } from '$lib/renderer/texture-utils';
	import type { SceneContext, RendererConfig } from '$lib/renderer/types';
	import type { ViewingMode } from '$lib/modes/types';
	import { startVideoExport, type VideoExportHandle } from '$lib/export/video-exporter';
	import { exportGLTF } from '$lib/export/gltf-exporter';
	import * as THREE from 'three';

	let containerEl: HTMLDivElement;
	let sceneCtx: SceneContext | null = null;
	let activeMode: ViewingMode | null = null;
	let resizeObserver: ResizeObserver | null = null;
	let contextLost = $state(false);
	let resizeTimeout: ReturnType<typeof setTimeout> | null = null;

	function getFullConfig() {
		return {
			displacementScale: appState.displacementScale,
			parallaxMaxOffset: appState.parallaxMaxOffset,
			parallaxSmoothing: appState.parallaxSmoothing,
			parallaxAutoAnimate: appState.parallaxAutoAnimate,
			parallaxAnimationSpeed: appState.parallaxAnimationSpeed,
			parallaxAnimationType: appState.parallaxAnimationType,
			stereoCrossEye: appState.stereoCrossEye,
			stereoEyeSeparation: appState.stereoEyeSeparation,
			webxrViewingDistance: appState.webxrViewingDistance,
		};
	}

	function activateMode(modeId: string) {
		if (!sceneCtx || contextLost) return;
		const previousMode = activeMode;
		try {
			activeMode?.deactivate();
			activeMode = getMode(modeId);
			activeMode.activate(sceneCtx, getFullConfig());
		} catch (err) {
			console.error(`Failed to activate mode "${modeId}":`, err);
			// Try to reactivate the previous mode
			if (previousMode && previousMode.id !== modeId) {
				try {
					activeMode = previousMode;
					activeMode.activate(sceneCtx!, getFullConfig());
				} catch {
					// Last resort: fall back to parallax
					try {
						activeMode = getMode('parallax');
						activeMode.activate(sceneCtx!, getFullConfig());
						appState.activeMode = 'parallax';
					} catch {
						activeMode = null;
					}
				}
			}
		}
	}

	export function handleConfigChange(key: string, value: unknown) {
		if (key === 'displacementScale' && sceneCtx) {
			if (sceneCtx.renderingMethod === 'torn-mesh') {
				// For torn mesh, scale Z axis of the mesh
				sceneCtx.mesh.scale.z = (value as number) / appState.displacementScale || 1;
				// Scale fill mesh to match
				if (sceneCtx.fillMaterial) {
					sceneCtx.fillMaterial.displacementScale = value as number;
				}
			} else {
				sceneCtx.material.displacementScale = value as number;
			}
		}
		activeMode?.updateConfig(key, value);
	}

	export function handleModeChange(modeId: string) {
		activateMode(modeId);
	}

	export function handleDepthUpdate(canvas: HTMLCanvasElement) {
		if (!sceneCtx) return;

		if (sceneCtx.renderingMethod === 'torn-mesh') {
			// Torn mesh needs full rebuild when depth changes
			// The caller (page.svelte) should call handleMeshRebuild instead
			return;
		}

		const newTexture = canvasToTexture(canvas);
		newTexture.colorSpace = THREE.LinearSRGBColorSpace;
		sceneCtx.material.displacementMap?.dispose();
		sceneCtx.material.displacementMap = newTexture;
		sceneCtx.material.needsUpdate = true;
	}

	export function handleMeshRebuild(config: RendererConfig) {
		if (!sceneCtx) return;
		rebuildMesh(sceneCtx, config);
		// Re-activate current viewing mode with the new mesh
		activateMode(appState.activeMode);
	}

	export function toggleFullscreen() {
		if (!containerEl) return;
		if (document.fullscreenElement) {
			document.exitFullscreen().catch(() => {});
		} else {
			containerEl.requestFullscreen().catch(() => {});
		}
	}

	export function recordVideo(
		durationMs: number,
		callbacks: { onProgress?: (p: number) => void; onComplete?: (blob: Blob) => void; onStop?: () => void }
	): VideoExportHandle | null {
		if (!sceneCtx) return null;

		// Force auto-animate on during recording
		const wasAutoAnimate = appState.parallaxAutoAnimate;
		if (!wasAutoAnimate) {
			appState.parallaxAutoAnimate = true;
			activeMode?.updateConfig('autoAnimate', true);
		}

		const handle = startVideoExport({
			canvas: sceneCtx.canvas,
			durationMs,
			onProgress: callbacks.onProgress,
			onComplete: (blob) => {
				// Restore auto-animate state
				if (!wasAutoAnimate) {
					appState.parallaxAutoAnimate = false;
					activeMode?.updateConfig('autoAnimate', false);
				}
				callbacks.onComplete?.(blob);
				callbacks.onStop?.();
			}
		});

		return handle;
	}

	export async function handleExportGLTF(): Promise<void> {
		if (!sceneCtx) return;
		await exportGLTF(sceneCtx);
	}

	function extractProcessedDepth(): { data: Float32Array; width: number; height: number } | null {
		const canvas = appState.depthCanvas;
		if (!canvas) return null;
		const ctx = canvas.getContext('2d');
		if (!ctx) return null;
		const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
		const data = new Float32Array(canvas.width * canvas.height);
		for (let i = 0; i < data.length; i++) {
			data[i] = imgData.data[i * 4] / 255;
		}
		return { data, width: canvas.width, height: canvas.height };
	}

	function setupContextLossHandlers() {
		if (!sceneCtx) return;
		const canvas = sceneCtx.canvas;

		canvas.addEventListener('webglcontextlost', (e) => {
			e.preventDefault();
			contextLost = true;
			activeMode?.deactivate();
			activeMode = null;
		});

		canvas.addEventListener('webglcontextrestored', () => {
			contextLost = false;
			if (sceneCtx) {
				activateMode(appState.activeMode);
			}
		});
	}

	onMount(() => {
		// For torn-mesh, use post-processed depth (from depthCanvas), not raw model output
		const processedDepth = appState.renderingMethod === 'torn-mesh'
			? extractProcessedDepth()
			: null;

		const config: RendererConfig = {
			container: containerEl,
			photo: appState.uploadedImage!,
			depthCanvas: appState.depthCanvas!,
			displacementScale: appState.displacementScale,
			renderingMethod: appState.renderingMethod,
			inpaintedPhoto: appState.inpaintedPhoto,
			depthData: processedDepth?.data ?? appState.rawDepthData,
			depthWidth: processedDepth?.width ?? appState.rawDepthWidth,
			depthHeight: processedDepth?.height ?? appState.rawDepthHeight,
			edgeThreshold: appState.edgeThreshold
		};

		sceneCtx = createSceneContext(config);
		setupContextLossHandlers();

		activateMode(appState.activeMode);

		resizeObserver = new ResizeObserver(() => {
			if (resizeTimeout) clearTimeout(resizeTimeout);
			resizeTimeout = setTimeout(() => {
				if (sceneCtx && !contextLost) handleResize(sceneCtx);
			}, 100);
		});
		resizeObserver.observe(containerEl);
	});

	onDestroy(() => {
		if (resizeTimeout) clearTimeout(resizeTimeout);
		activeMode?.deactivate();
		if (sceneCtx) disposeSceneContext(sceneCtx);
		resizeObserver?.disconnect();
	});
</script>

<div class="w-full h-full bg-[#11111b] relative" bind:this={containerEl}>
	{#if contextLost}
		<div class="absolute inset-0 flex items-center justify-center bg-[#11111b]/90 z-10">
			<div class="text-center p-8">
				<p class="text-[#cdd6f4] text-lg font-semibold mb-2">WebGL Context Lost</p>
				<p class="text-[#a6adc8] text-sm">The browser reclaimed GPU resources. Waiting for recovery...</p>
			</div>
		</div>
	{/if}
</div>
