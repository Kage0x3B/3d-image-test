// --- Inpainting worker messages ---

export type InpaintingIncoming =
	| InpaintingRunTelea
	| InpaintingLoadMigan
	| InpaintingRunMigan;

export interface InpaintingRunTelea {
	type: 'run-telea';
	imageData: Uint8ClampedArray;
	mask: Uint8Array;
	width: number;
	height: number;
	radius: number;
}

export interface InpaintingLoadMigan {
	type: 'load-migan';
}

export interface InpaintingRunMigan {
	type: 'run-migan';
	imageData: Uint8ClampedArray;
	mask: Uint8Array;
	width: number;
	height: number;
}

export type InpaintingOutgoing =
	| InpaintingResultMsg
	| InpaintingProgress
	| InpaintingError
	| InpaintingMiganReady;

export interface InpaintingResultMsg {
	type: 'result';
	imageData: Uint8ClampedArray;
	width: number;
	height: number;
}

export interface InpaintingProgress {
	type: 'progress';
	progress: number;
	message: string;
}

export interface InpaintingError {
	type: 'error';
	message: string;
}

export interface InpaintingMiganReady {
	type: 'migan-ready';
}

// --- Depth estimation worker messages ---

export type DepthEstimationIncoming = DepthEstimationInitialize | DepthEstimationEstimate;

export interface DepthEstimationInitialize {
	type: 'initialize';
	modelId: string;
}

export interface DepthEstimationEstimate {
	type: 'estimate';
	taskId: number;
	imageData: Uint8ClampedArray;
	width: number;
	height: number;
}

export type DepthEstimationOutgoing =
	| DepthEstimationReady
	| DepthEstimationResult
	| DepthEstimationProgress
	| DepthEstimationError;

export interface DepthEstimationReady {
	type: 'ready';
}

export interface DepthEstimationResult {
	type: 'result';
	taskId: number;
	depthData: Float32Array;
	width: number;
	height: number;
}

export interface DepthEstimationProgress {
	type: 'progress';
	stage: 'model-loading' | 'inference';
	progress: number;
	message: string;
}

export interface DepthEstimationError {
	type: 'error';
	taskId?: number;
	message: string;
}
