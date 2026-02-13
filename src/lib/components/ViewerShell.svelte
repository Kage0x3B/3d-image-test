<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		createSceneContext,
		disposeSceneContext,
		handleResize
	} from '$lib/renderer/scene-manager';
	import { getMode } from '$lib/modes';
	import { appState } from '$lib/stores/app-state.svelte';
	import { canvasToTexture } from '$lib/renderer/texture-utils';
	import type { SceneContext } from '$lib/renderer/types';
	import type { ViewingMode } from '$lib/modes/types';
	import * as THREE from 'three';

	let containerEl: HTMLDivElement;
	let sceneCtx: SceneContext | null = null;
	let activeMode: ViewingMode | null = null;
	let resizeObserver: ResizeObserver | null = null;

	function getFullConfig() {
		return {
			displacementScale: appState.displacementScale,
			parallaxMaxOffset: appState.parallaxMaxOffset,
			parallaxSmoothing: appState.parallaxSmoothing,
			parallaxAutoWiggle: appState.parallaxAutoWiggle,
			parallaxAutoWiggleSpeed: appState.parallaxAutoWiggleSpeed,
			stereoCrossEye: appState.stereoCrossEye,
			stereoEyeSeparation: appState.stereoEyeSeparation,
			webxrViewingDistance: appState.webxrViewingDistance,
		};
	}

	function activateMode(modeId: string) {
		if (!sceneCtx) return;
		activeMode?.deactivate();
		activeMode = getMode(modeId);
		activeMode.activate(sceneCtx, getFullConfig());
	}

	export function handleConfigChange(key: string, value: unknown) {
		if (key === 'displacementScale' && sceneCtx) {
			sceneCtx.material.displacementScale = value as number;
		}
		activeMode?.updateConfig(key, value);
	}

	export function handleModeChange(modeId: string) {
		activateMode(modeId);
	}

	export function handleDepthUpdate(canvas: HTMLCanvasElement) {
		if (!sceneCtx) return;
		const newTexture = canvasToTexture(canvas);
		newTexture.colorSpace = THREE.LinearSRGBColorSpace;
		sceneCtx.material.displacementMap?.dispose();
		sceneCtx.material.displacementMap = newTexture;
		sceneCtx.material.needsUpdate = true;
	}

	export function toggleFullscreen() {
		if (!containerEl) return;
		if (document.fullscreenElement) {
			document.exitFullscreen();
		} else {
			containerEl.requestFullscreen();
		}
	}

	onMount(() => {
		sceneCtx = createSceneContext({
			container: containerEl,
			photo: appState.uploadedImage!,
			depthCanvas: appState.depthCanvas!,
			displacementScale: appState.displacementScale
		});

		activateMode(appState.activeMode);

		resizeObserver = new ResizeObserver(() => {
			if (sceneCtx) handleResize(sceneCtx);
		});
		resizeObserver.observe(containerEl);
	});

	onDestroy(() => {
		activeMode?.deactivate();
		if (sceneCtx) disposeSceneContext(sceneCtx);
		resizeObserver?.disconnect();
	});
</script>

<div class="w-full h-full bg-[#11111b]" bind:this={containerEl}></div>
