export interface PostProcessOptions {
	/** Bilateral filter iterations (0 = disabled). Smooths depth while preserving edges. */
	bilateralIterations: number;
	/** Bilateral filter spatial sigma (pixels). Higher = more spatial smoothing. */
	bilateralSpatialSigma: number;
	/** Bilateral filter range sigma (0-1). Higher = less edge-preserving. */
	bilateralRangeSigma: number;
	/** Gaussian blur sigma (0 = disabled). Smooths overall depth noise. */
	gaussianSigma: number;
	/** Invert depth map (swap near/far). */
	invert: boolean;
	/** Contrast adjustment (1 = no change, >1 = more contrast). */
	contrast: number;
	/** Brightness adjustment (0 = no change, positive = brighter). */
	brightness: number;
}

export const defaultPostProcessOptions: PostProcessOptions = {
	bilateralIterations: 1,
	bilateralSpatialSigma: 3,
	bilateralRangeSigma: 0.1,
	gaussianSigma: 0,
	invert: false,
	contrast: 1.0,
	brightness: 0
};

export type PostProcessStepCallback = (progress: number, message: string) => void;

/**
 * DOM-free post-processing on raw Float32Array depth data.
 * Can be used in both main thread and Web Workers.
 */
export function postProcessDepthData(
	depthData: Float32Array,
	width: number,
	height: number,
	options: PostProcessOptions,
	onStep?: PostProcessStepCallback
): Float32Array {
	let depth = new Float32Array(depthData);

	const totalSteps = 2 + (options.gaussianSigma > 0 ? 1 : 0) + options.bilateralIterations;
	let currentStep = 0;

	function reportStep(message: string) {
		currentStep++;
		onStep?.(currentStep / totalSteps, message);
	}

	// Invert
	if (options.invert) {
		for (let i = 0; i < depth.length; i++) {
			depth[i] = 1 - depth[i];
		}
	}
	reportStep('Applied invert');

	// Contrast & brightness
	if (options.contrast !== 1.0 || options.brightness !== 0) {
		const mid = 0.5;
		for (let i = 0; i < depth.length; i++) {
			depth[i] = (depth[i] - mid) * options.contrast + mid + options.brightness;
			depth[i] = Math.max(0, Math.min(1, depth[i]));
		}
	}
	reportStep('Applied contrast/brightness');

	// Gaussian blur
	if (options.gaussianSigma > 0) {
		depth = gaussianBlur(depth, width, height, options.gaussianSigma) as Float32Array<ArrayBuffer>;
		reportStep('Applied gaussian blur');
	}

	// Bilateral filter
	for (let iter = 0; iter < options.bilateralIterations; iter++) {
		depth = bilateralFilter(
			depth,
			width,
			height,
			options.bilateralSpatialSigma,
			options.bilateralRangeSigma
		) as Float32Array<ArrayBuffer>;
		reportStep(`Bilateral filter ${iter + 1}/${options.bilateralIterations}`);
	}

	return depth;
}

/**
 * Extract single-channel depth data from a canvas.
 */
export function extractDepthFromCanvas(canvas: HTMLCanvasElement): {
	depthData: Float32Array;
	width: number;
	height: number;
} {
	const width = canvas.width;
	const height = canvas.height;
	const ctx = canvas.getContext('2d')!;
	const imgData = ctx.getImageData(0, 0, width, height);
	const depthData = new Float32Array(width * height);
	for (let i = 0; i < depthData.length; i++) {
		depthData[i] = imgData.data[i * 4] / 255;
	}
	return { depthData, width, height };
}

/**
 * Convert Float32Array depth data [0,1] back to a grayscale canvas.
 */
export function depthDataToCanvas(
	depthData: Float32Array,
	width: number,
	height: number
): HTMLCanvasElement {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d')!;
	const imgData = ctx.createImageData(width, height);
	for (let i = 0; i < depthData.length; i++) {
		const v = Math.round(Math.max(0, Math.min(1, depthData[i])) * 255);
		imgData.data[i * 4] = v;
		imgData.data[i * 4 + 1] = v;
		imgData.data[i * 4 + 2] = v;
		imgData.data[i * 4 + 3] = 255;
	}
	ctx.putImageData(imgData, 0, 0);
	return canvas;
}

/**
 * Apply post-processing to a depth map canvas.
 * Returns a new canvas with the processed depth map.
 * (Thin wrapper around postProcessDepthData for backward compat.)
 */
export function postProcessDepth(
	sourceCanvas: HTMLCanvasElement,
	options: PostProcessOptions
): HTMLCanvasElement {
	const { depthData, width, height } = extractDepthFromCanvas(sourceCanvas);
	const processed = postProcessDepthData(depthData, width, height, options);
	return depthDataToCanvas(processed, width, height);
}

/**
 * Separable Gaussian blur (two-pass: horizontal then vertical).
 */
function gaussianBlur(
	data: Float32Array,
	width: number,
	height: number,
	sigma: number
): Float32Array {
	const radius = Math.ceil(sigma * 3);
	const kernel = makeGaussianKernel(sigma, radius);

	// Horizontal pass
	let temp = new Float32Array(data.length);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			let sum = 0;
			let wSum = 0;
			for (let k = -radius; k <= radius; k++) {
				const sx = Math.min(width - 1, Math.max(0, x + k));
				const w = kernel[k + radius];
				sum += data[y * width + sx] * w;
				wSum += w;
			}
			temp[y * width + x] = sum / wSum;
		}
	}

	// Vertical pass
	const out = new Float32Array(data.length);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			let sum = 0;
			let wSum = 0;
			for (let k = -radius; k <= radius; k++) {
				const sy = Math.min(height - 1, Math.max(0, y + k));
				const w = kernel[k + radius];
				sum += temp[sy * width + x] * w;
				wSum += w;
			}
			out[y * width + x] = sum / wSum;
		}
	}

	return out;
}

function makeGaussianKernel(sigma: number, radius: number): Float32Array {
	const size = radius * 2 + 1;
	const kernel = new Float32Array(size);
	const s2 = 2 * sigma * sigma;
	for (let i = 0; i < size; i++) {
		const x = i - radius;
		kernel[i] = Math.exp(-(x * x) / s2);
	}
	return kernel;
}

/**
 * Bilateral filter — smooths depth while preserving edges.
 */
function bilateralFilter(
	data: Float32Array,
	width: number,
	height: number,
	spatialSigma: number,
	rangeSigma: number
): Float32Array {
	const radius = Math.ceil(spatialSigma * 2);
	const spatialKernel = makeGaussianKernel(spatialSigma, radius);
	const rangeSigma2 = 2 * rangeSigma * rangeSigma;
	const out = new Float32Array(data.length);

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const centerVal = data[y * width + x];
			let sum = 0;
			let wSum = 0;

			for (let dy = -radius; dy <= radius; dy++) {
				const sy = Math.min(height - 1, Math.max(0, y + dy));
				const spatialY = spatialKernel[dy + radius];

				for (let dx = -radius; dx <= radius; dx++) {
					const sx = Math.min(width - 1, Math.max(0, x + dx));
					const spatialX = spatialKernel[dx + radius];

					const val = data[sy * width + sx];
					const diff = val - centerVal;
					const rangeW = Math.exp(-(diff * diff) / rangeSigma2);

					const w = spatialX * spatialY * rangeW;
					sum += val * w;
					wSum += w;
				}
			}

			out[y * width + x] = sum / wSum;
		}
	}

	return out;
}
