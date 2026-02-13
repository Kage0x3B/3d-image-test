import type { DepthEstimationIncoming, DepthEstimationOutgoing } from './messages';

export type ProgressCallback = (event: {
	stage: 'model-loading' | 'inference';
	progress: number;
	message: string;
}) => void;

export class DepthEstimationClient {
	private worker: Worker;
	private _isReady = false;
	private initPromise: {
		resolve: () => void;
		reject: (err: Error) => void;
	} | null = null;
	private estimatePromise: {
		taskId: number;
		resolve: (value: { depthData: Float32Array; width: number; height: number }) => void;
		reject: (err: Error) => void;
	} | null = null;
	private onProgress: ProgressCallback | null = null;
	private nextTaskId = 1;
	private currentModelId: string | null = null;

	constructor() {
		this.worker = new Worker(
			new URL('./depth-estimation.worker.ts', import.meta.url),
			{ type: 'module' }
		);
		this.worker.onmessage = (e: MessageEvent<DepthEstimationOutgoing>) => {
			this.handleMessage(e.data);
		};
	}

	get isReady() {
		return this._isReady;
	}

	async initialize(modelId: string, onProgress?: ProgressCallback): Promise<void> {
		if (this._isReady && this.currentModelId === modelId) return;

		// Model changed — recreate worker
		if (this._isReady) {
			this.worker.terminate();
			this.worker = new Worker(
				new URL('./depth-estimation.worker.ts', import.meta.url),
				{ type: 'module' }
			);
			this.worker.onmessage = (e: MessageEvent<DepthEstimationOutgoing>) => {
				this.handleMessage(e.data);
			};
			this._isReady = false;
		}

		this.currentModelId = modelId;
		this.onProgress = onProgress ?? null;

		return new Promise((resolve, reject) => {
			this.initPromise = { resolve, reject };
			this.send({ type: 'initialize', modelId });
		});
	}

	async estimate(
		image: HTMLImageElement | ImageBitmap,
		onProgress?: ProgressCallback
	): Promise<{ depthData: Float32Array; width: number; height: number }> {
		if (!this._isReady) throw new Error('Not initialized');

		this.onProgress = onProgress ?? null;

		// Extract ImageData on main thread (needs DOM)
		const canvas = document.createElement('canvas');
		const width = image instanceof HTMLImageElement ? image.naturalWidth : image.width;
		const height = image instanceof HTMLImageElement ? image.naturalHeight : image.height;
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext('2d')!;
		ctx.drawImage(image, 0, 0);
		const imageData = ctx.getImageData(0, 0, width, height);

		const taskId = this.nextTaskId++;
		const pixelData = imageData.data;

		return new Promise((resolve, reject) => {
			this.estimatePromise = { taskId, resolve, reject };

			const msg: DepthEstimationIncoming = {
				type: 'estimate',
				taskId,
				imageData: pixelData,
				width,
				height
			};
			this.worker.postMessage(msg, [pixelData.buffer]);
		});
	}

	dispose() {
		this.worker.terminate();
		this._isReady = false;
	}

	private handleMessage(msg: DepthEstimationOutgoing) {
		if (msg.type === 'ready') {
			this._isReady = true;
			this.initPromise?.resolve();
			this.initPromise = null;
			return;
		}

		if (msg.type === 'progress') {
			this.onProgress?.({
				stage: msg.stage,
				progress: msg.progress,
				message: msg.message
			});
			return;
		}

		if (msg.type === 'result') {
			if (this.estimatePromise && this.estimatePromise.taskId === msg.taskId) {
				const p = this.estimatePromise;
				this.estimatePromise = null;
				p.resolve({
					depthData: msg.depthData,
					width: msg.width,
					height: msg.height
				});
			}
			return;
		}

		if (msg.type === 'error') {
			if (msg.taskId !== undefined && this.estimatePromise?.taskId === msg.taskId) {
				const p = this.estimatePromise;
				this.estimatePromise = null;
				p.reject(new Error(msg.message));
			} else if (this.initPromise) {
				const p = this.initPromise;
				this.initPromise = null;
				p.reject(new Error(msg.message));
			}
		}
	}

	private send(msg: DepthEstimationIncoming) {
		this.worker.postMessage(msg);
	}
}

let singleton: DepthEstimationClient | null = null;

export function getDepthEstimationClient(): DepthEstimationClient {
	if (!singleton) {
		singleton = new DepthEstimationClient();
	}
	return singleton;
}
