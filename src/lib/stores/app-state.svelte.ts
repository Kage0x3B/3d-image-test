import { defaultPostProcessOptions, type PostProcessOptions } from '$lib/depth/post-process';
import { DEFAULT_MODEL_ID } from '$lib/depth/models';
import { disposeGPUPostProcessor } from '$lib/gpu/gpu-post-processor';
import type { RenderingMethod, InpaintingMethod } from '$lib/inpainting/types';

export type AppStage = 'upload' | 'processing' | 'viewing';
export type ViewingModeId = 'parallax' | 'stereo' | 'webxr';

export const appState = $state({
	stage: 'upload' as AppStage,

	// Model selection
	selectedModelId: DEFAULT_MODEL_ID,

	// Upload
	uploadedFile: null as File | null,
	uploadedImage: null as HTMLImageElement | null,

	// Processing
	processingProgress: 0,
	processingMessage: '',
	processingError: null as string | null,

	// Depth result (raw from model, before post-processing)
	rawDepthCanvas: null as HTMLCanvasElement | null,
	// Depth result (after post-processing, used for rendering)
	depthCanvas: null as HTMLCanvasElement | null,

	// Raw depth data (Float32Array for worker reprocessing)
	rawDepthData: null as Float32Array | null,
	rawDepthWidth: 0,
	rawDepthHeight: 0,

	// Post-processing
	postProcess: { ...defaultPostProcessOptions } as PostProcessOptions,

	// Rendering method
	renderingMethod: 'simple' as RenderingMethod,
	inpaintingMethod: 'telea' as InpaintingMethod,
	edgeThreshold: 0.15,
	inpaintStripWidth: 20,
	inpaintedPhoto: null as HTMLCanvasElement | null,
	isInpainting: false,
	miganModelLoaded: false,

	// Viewing — rendering
	activeMode: 'parallax' as ViewingModeId,
	displacementScale: 0.3,
	meshSubdivisions: 512,

	// Viewing — parallax mode
	parallaxMaxOffset: 0.08,
	parallaxSmoothing: 0.08,
	parallaxAutoWiggle: false,
	parallaxAutoWiggleSpeed: 0.8,

	// Viewing — stereo mode
	stereoCrossEye: false,
	stereoEyeSeparation: 0.06,

	// Viewing — webxr mode
	webxrViewingDistance: 1.8,

	// Device capabilities
	hasWebXR: false,

	// UI
	showDepthPreview: false
});

/** Zero out a canvas to release its GPU backing store. */
function releaseCanvas(canvas: HTMLCanvasElement | null) {
	if (!canvas) return;
	canvas.width = 0;
	canvas.height = 0;
}

export function resetState() {
	// Release GPU-backed canvases before nulling references
	releaseCanvas(appState.rawDepthCanvas);
	releaseCanvas(appState.depthCanvas);
	releaseCanvas(appState.inpaintedPhoto);

	// Release GPU post-processor resources
	disposeGPUPostProcessor();

	appState.stage = 'upload';
	appState.uploadedFile = null;
	appState.uploadedImage = null;
	appState.processingProgress = 0;
	appState.processingMessage = '';
	appState.processingError = null;
	appState.rawDepthCanvas = null;
	appState.depthCanvas = null;
	appState.rawDepthData = null;
	appState.rawDepthWidth = 0;
	appState.rawDepthHeight = 0;
	appState.postProcess = { ...defaultPostProcessOptions };
	appState.renderingMethod = 'simple';
	appState.inpaintingMethod = 'telea';
	appState.edgeThreshold = 0.15;
	appState.inpaintStripWidth = 20;
	appState.inpaintedPhoto = null;
	appState.isInpainting = false;
	appState.miganModelLoaded = false;
	appState.activeMode = 'parallax';
	appState.showDepthPreview = false;
}
