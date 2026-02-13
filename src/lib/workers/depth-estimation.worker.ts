/// <reference lib="webworker" />

import type { DepthEstimationIncoming, DepthEstimationOutgoing } from './messages';

let pipelineInstance: any = null;

self.onmessage = async (e: MessageEvent<DepthEstimationIncoming>) => {
	const msg = e.data;

	if (msg.type === 'initialize') {
		try {
			const { pipeline, env } = await import('@huggingface/transformers');
			env.allowLocalModels = false;

			const device = (navigator as any).gpu ? 'webgpu' : undefined;

			pipelineInstance = await pipeline(
				'depth-estimation',
				msg.modelId,
				{
					device,
					progress_callback: (data: any) => {
						if (data.status === 'progress') {
							send({
								type: 'progress',
								stage: 'model-loading',
								progress: (data.progress ?? 0) / 100,
								message: `Loading model... ${Math.round(data.progress ?? 0)}%`
							});
						} else if (data.status === 'ready') {
							send({
								type: 'progress',
								stage: 'model-loading',
								progress: 1,
								message: 'Model loaded'
							});
						}
					}
				}
			);

			send({ type: 'ready' });
		} catch (err) {
			send({
				type: 'error',
				message: err instanceof Error ? err.message : 'Failed to initialize model'
			});
		}
		return;
	}

	if (msg.type === 'estimate') {
		const { taskId, imageData, width, height } = msg;

		try {
			if (!pipelineInstance) {
				throw new Error('Pipeline not initialized');
			}

			// Convert ImageData to blob URL via OffscreenCanvas
			const offscreen = new OffscreenCanvas(width, height);
			const ctx = offscreen.getContext('2d')!;
			const pixels = new Uint8ClampedArray(imageData.buffer as ArrayBuffer);
			const imgData = new ImageData(pixels, width, height);
			ctx.putImageData(imgData, 0, 0);
			const blob = await offscreen.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
			const dataUrl = await blobToDataUrl(blob);

			// Time-based progress estimation during inference
			const startTime = Date.now();
			const expectedDuration = 5000; // rough estimate: 5 seconds
			const progressInterval = setInterval(() => {
				const elapsed = Date.now() - startTime;
				// Asymptotic ease toward 95%
				const t = 1 - Math.exp(-elapsed / expectedDuration);
				const progress = t * 0.95;
				send({
					type: 'progress',
					stage: 'inference',
					progress,
					message: 'Estimating depth...'
				});
			}, 200);

			const result = await pipelineInstance(dataUrl);

			clearInterval(progressInterval);

			send({
				type: 'progress',
				stage: 'inference',
				progress: 1,
				message: 'Depth estimation complete'
			});

			// Normalize depth to Float32Array [0,1]
			const depthImage = result.depth;
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

			const outMsg: DepthEstimationOutgoing = {
				type: 'result',
				taskId,
				depthData,
				width: depthImage.width,
				height: depthImage.height
			};
			(self as unknown as Worker).postMessage(outMsg, [depthData.buffer]);
		} catch (err) {
			send({
				type: 'error',
				taskId,
				message: err instanceof Error ? err.message : 'Estimation failed'
			});
		}
		return;
	}
};

function send(msg: DepthEstimationOutgoing) {
	(self as unknown as Worker).postMessage(msg);
}

function blobToDataUrl(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = reject;
		reader.readAsDataURL(blob);
	});
}
