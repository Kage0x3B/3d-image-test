import type { DepthEstimator, DepthResult, ProgressCallback } from './types';
import { DEFAULT_MODEL_ID } from './models';

export class BrowserDepthEstimator implements DepthEstimator {
	private pipeline: any = null;
	private _isReady = false;
	private modelId: string;

	constructor(modelId: string = DEFAULT_MODEL_ID) {
		this.modelId = modelId;
	}

	get isReady() {
		return this._isReady;
	}

	async initialize(onProgress?: ProgressCallback): Promise<void> {
		const { pipeline, env } = await import('@huggingface/transformers');

		// Disable local model check — always fetch from HuggingFace Hub
		env.allowLocalModels = false;

		const device = (navigator as any).gpu ? 'webgpu' : undefined;

		this.pipeline = await pipeline('depth-estimation', this.modelId, {
			device,
			progress_callback: (data: any) => {
				if (data.status === 'progress') {
					onProgress?.({
						stage: 'model-loading',
						progress: (data.progress ?? 0) / 100,
						message: `Loading model... ${Math.round(data.progress ?? 0)}%`
					});
				} else if (data.status === 'ready') {
					onProgress?.({
						stage: 'model-loading',
						progress: 1,
						message: 'Model loaded'
					});
				}
			}
		});

		this._isReady = true;
	}

	async estimate(image: HTMLImageElement | ImageBitmap): Promise<DepthResult> {
		if (!this.pipeline) throw new Error('Pipeline not initialized');

		// Convert image to a canvas data URL for the pipeline
		const canvas = document.createElement('canvas');
		const width = image instanceof HTMLImageElement ? image.naturalWidth : image.width;
		const height = image instanceof HTMLImageElement ? image.naturalHeight : image.height;
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext('2d')!;
		ctx.drawImage(image, 0, 0);
		const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

		const result = await this.pipeline(dataUrl);

		// result.depth is a RawImage — convert to canvas
		const depthImage = result.depth;
		const depthCanvas = depthImage.toCanvas();

		// Extract and normalize depth data to [0, 1]
		const raw = depthImage.data as Float32Array;
		const depthData = new Float32Array(raw.length);
		let min = Infinity;
		let max = -Infinity;
		for (let i = 0; i < raw.length; i++) {
			if (raw[i] < min) min = raw[i];
			if (raw[i] > max) max = raw[i];
		}
		const range = max - min || 1;
		for (let i = 0; i < raw.length; i++) {
			depthData[i] = (raw[i] - min) / range;
		}

		return {
			depthCanvas,
			depthData,
			width: depthImage.width,
			height: depthImage.height
		};
	}

	dispose(): void {
		this.pipeline = null;
		this._isReady = false;
	}
}
