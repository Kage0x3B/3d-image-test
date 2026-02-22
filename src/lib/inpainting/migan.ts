/**
 * MI-GAN (Mobile-friendly Image Inpainting with Generative Adversarial Networks)
 * ONNX integration for browser-based neural inpainting.
 *
 * Model: migan_pipeline_v2.onnx from HuggingFace
 * Input:  uint8 [1,3,H,W] image + uint8 [1,1,H,W] mask (255=keep, 0=inpaint)
 * Output: uint8 [1,3,H,W] — preprocessing/blending baked into ONNX graph
 */

import type * as ort from 'onnxruntime-web';

const MODEL_URL =
	'https://huggingface.co/andraniksargsyan/migan/resolve/main/migan_pipeline_v2.onnx';

export async function loadMiganSession(): Promise<ort.InferenceSession> {
	const ortModule = await import('onnxruntime-web');

	// Prefer WebGPU, fall back to WASM
	const providers: ort.InferenceSession.ExecutionProviderConfig[] = ['wasm'];
	try {
		if ('gpu' in navigator) {
			providers.unshift('webgpu');
		}
	} catch {
		// WebGPU not available
	}

	const session = await ortModule.InferenceSession.create(MODEL_URL, {
		executionProviders: providers
	});

	return session;
}

export async function runMigan(
	session: ort.InferenceSession,
	imageData: Uint8ClampedArray,
	mask: Uint8Array,
	width: number,
	height: number
): Promise<Uint8ClampedArray> {
	const ortModule = await import('onnxruntime-web');

	const numPixels = width * height;

	// Build image tensor [1, 3, H, W] as uint8
	const imgTensor = new Uint8Array(3 * numPixels);
	for (let i = 0; i < numPixels; i++) {
		imgTensor[i] = imageData[i * 4]; // R
		imgTensor[numPixels + i] = imageData[i * 4 + 1]; // G
		imgTensor[2 * numPixels + i] = imageData[i * 4 + 2]; // B
	}

	// Build mask tensor [1, 1, H, W] as uint8 (255=keep, 0=inpaint)
	const maskTensor = new Uint8Array(numPixels);
	for (let i = 0; i < numPixels; i++) {
		maskTensor[i] = mask[i] ? 0 : 255; // Our mask: 1=inpaint → MI-GAN: 0=inpaint
	}

	const imageFeed = new ortModule.Tensor('uint8', imgTensor, [1, 3, height, width]);
	const maskFeed = new ortModule.Tensor('uint8', maskTensor, [1, 1, height, width]);

	const results = await session.run({
		image: imageFeed,
		mask: maskFeed
	});

	// Output is [1, 3, H, W] uint8
	const output = results[Object.keys(results)[0]];
	const outputData = output.data as Uint8Array;

	// Convert back to RGBA
	const result = new Uint8ClampedArray(numPixels * 4);
	for (let i = 0; i < numPixels; i++) {
		result[i * 4] = outputData[i]; // R
		result[i * 4 + 1] = outputData[numPixels + i]; // G
		result[i * 4 + 2] = outputData[2 * numPixels + i]; // B
		result[i * 4 + 3] = 255; // A
	}

	return result;
}
