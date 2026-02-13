import { defaultPostProcessOptions, type PostProcessOptions } from '$lib/depth/post-process';
import { DEFAULT_MODEL_ID } from '$lib/depth/models';

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

	// Viewing — rendering
	activeMode: 'parallax' as ViewingModeId,
	displacementScale: 0.3,
	meshSubdivisions: 256,

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

export function resetState() {
	appState.stage = 'upload';
	appState.uploadedFile = null;
	appState.uploadedImage = null;
	appState.processingProgress = 0;
	appState.processingMessage = '';
	appState.rawDepthCanvas = null;
	appState.depthCanvas = null;
	appState.rawDepthData = null;
	appState.rawDepthWidth = 0;
	appState.rawDepthHeight = 0;
	appState.postProcess = { ...defaultPostProcessOptions };
	appState.activeMode = 'parallax';
	appState.showDepthPreview = false;
}
