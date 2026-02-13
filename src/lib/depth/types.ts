export interface DepthResult {
	depthCanvas: HTMLCanvasElement;
	depthData: Float32Array;
	width: number;
	height: number;
}

export type ProgressCallback = (event: {
	stage: 'model-loading' | 'inference';
	progress: number;
	message?: string;
}) => void;

export interface DepthEstimator {
	initialize(onProgress?: ProgressCallback): Promise<void>;
	estimate(image: HTMLImageElement | ImageBitmap): Promise<DepthResult>;
	readonly isReady: boolean;
	dispose(): void;
}
