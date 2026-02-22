import type { InpaintingIncoming, InpaintingOutgoing } from './messages';
import type { InpaintingResult } from '$lib/inpainting/types';

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
	let timeoutId: ReturnType<typeof setTimeout>;
	const timeout = new Promise<never>((_, reject) => {
		timeoutId = setTimeout(() => reject(new Error(message)), ms);
	});
	return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

export class InpaintingClient {
	private worker: Worker;
	private pending: {
		resolve: (result: InpaintingResult) => void;
		reject: (err: Error) => void;
	} | null = null;
	private miganLoadPromise: {
		resolve: () => void;
		reject: (err: Error) => void;
	} | null = null;
	private _miganLoaded = false;

	constructor() {
		this.worker = this.createWorker();
	}

	private createWorker(): Worker {
		const worker = new Worker(
			new URL('./inpainting.worker.ts', import.meta.url),
			{ type: 'module' }
		);
		worker.onmessage = (e: MessageEvent<InpaintingOutgoing>) => {
			this.handleMessage(e.data);
		};
		worker.onerror = (e) => {
			const error = new Error(`Inpainting worker crashed: ${e.message || 'unknown error'}`);
			if (this.pending) {
				this.pending.reject(error);
				this.pending = null;
			}
			if (this.miganLoadPromise) {
				this.miganLoadPromise.reject(error);
				this.miganLoadPromise = null;
			}
			this._miganLoaded = false;
			// Reset singleton so next call creates a fresh worker
			singleton = null;
		};
		return worker;
	}

	get miganLoaded() {
		return this._miganLoaded;
	}

	async runTelea(
		imageData: Uint8ClampedArray,
		mask: Uint8Array,
		width: number,
		height: number,
		radius: number = 5
	): Promise<InpaintingResult> {
		const promise = new Promise<InpaintingResult>((resolve, reject) => {
			this.pending = { resolve, reject };
			const msg: InpaintingIncoming = {
				type: 'run-telea',
				imageData,
				mask,
				width,
				height,
				radius
			};
			this.worker.postMessage(msg, [imageData.buffer, mask.buffer]);
		});
		return withTimeout(promise, 30_000, 'Telea inpainting timed out after 30 seconds');
	}

	async loadMigan(onProgress?: (msg: string) => void): Promise<void> {
		if (this._miganLoaded) return;

		const promise = new Promise<void>((resolve, reject) => {
			this.miganLoadPromise = { resolve, reject };

			this.worker.onmessage = (e: MessageEvent<InpaintingOutgoing>) => {
				const msg = e.data;
				if (msg.type === 'progress') {
					onProgress?.(msg.message);
				}
				this.handleMessage(msg);
			};

			const loadMsg: InpaintingIncoming = { type: 'load-migan' };
			this.worker.postMessage(loadMsg);
		});
		return withTimeout(promise, 120_000, 'MI-GAN model loading timed out after 2 minutes');
	}

	async runMigan(
		imageData: Uint8ClampedArray,
		mask: Uint8Array,
		width: number,
		height: number
	): Promise<InpaintingResult> {
		if (!this._miganLoaded) {
			throw new Error('MI-GAN model not loaded. Call loadMigan() first.');
		}

		const promise = new Promise<InpaintingResult>((resolve, reject) => {
			this.pending = { resolve, reject };
			const msg: InpaintingIncoming = {
				type: 'run-migan',
				imageData,
				mask,
				width,
				height
			};
			this.worker.postMessage(msg, [imageData.buffer, mask.buffer]);
		});
		return withTimeout(promise, 60_000, 'MI-GAN inpainting timed out after 60 seconds');
	}

	dispose() {
		this.worker.terminate();
	}

	private handleMessage(msg: InpaintingOutgoing) {
		switch (msg.type) {
			case 'result': {
				const p = this.pending;
				this.pending = null;
				p?.resolve({
					imageData: msg.imageData,
					width: msg.width,
					height: msg.height
				});
				break;
			}

			case 'migan-ready': {
				this._miganLoaded = true;
				const p = this.miganLoadPromise;
				this.miganLoadPromise = null;
				p?.resolve();
				break;
			}

			case 'error': {
				const err = new Error(msg.message);
				if (this.pending) {
					const p = this.pending;
					this.pending = null;
					p.reject(err);
				} else if (this.miganLoadPromise) {
					const p = this.miganLoadPromise;
					this.miganLoadPromise = null;
					p.reject(err);
				}
				break;
			}

			case 'progress':
				// Progress handled inline in loadMigan
				break;
		}
	}
}

let singleton: InpaintingClient | null = null;

export function getInpaintingClient(): InpaintingClient {
	if (!singleton) {
		singleton = new InpaintingClient();
	}
	return singleton;
}
