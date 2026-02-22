import type { EdgeDetectionResult } from './types';

/**
 * Detect depth discontinuity edges using Sobel gradient magnitude thresholding.
 * Pure math, DOM-free — works in main thread or Web Worker.
 */
export function detectDepthEdges(
	depthData: Float32Array,
	width: number,
	height: number,
	threshold: number
): EdgeDetectionResult {
	const edgeMask = new Uint8Array(width * height);

	for (let y = 1; y < height - 1; y++) {
		for (let x = 1; x < width - 1; x++) {
			// Sobel X kernel
			const gx =
				-depthData[(y - 1) * width + (x - 1)] +
				depthData[(y - 1) * width + (x + 1)] +
				-2 * depthData[y * width + (x - 1)] +
				2 * depthData[y * width + (x + 1)] +
				-depthData[(y + 1) * width + (x - 1)] +
				depthData[(y + 1) * width + (x + 1)];

			// Sobel Y kernel
			const gy =
				-depthData[(y - 1) * width + (x - 1)] +
				-2 * depthData[(y - 1) * width + x] +
				-depthData[(y - 1) * width + (x + 1)] +
				depthData[(y + 1) * width + (x - 1)] +
				2 * depthData[(y + 1) * width + x] +
				depthData[(y + 1) * width + (x + 1)];

			const magnitude = Math.sqrt(gx * gx + gy * gy);

			if (magnitude > threshold) {
				edgeMask[y * width + x] = 1;
			}
		}
	}

	return { edgeMask, width, height };
}
