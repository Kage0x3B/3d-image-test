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
