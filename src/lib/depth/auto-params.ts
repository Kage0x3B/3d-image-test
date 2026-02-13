import type { PostProcessOptions } from './post-process';

/**
 * Analyze raw depth data and return suggested post-processing parameters.
 *
 * Three heuristics:
 * 1. Histogram auto-levels — stretches [p2, p98] to ~[0.05, 0.95] via contrast/brightness.
 * 2. Inversion detection — compares center region (likely subject) to edges (likely background).
 *    Depth Anything V2 outputs closer = higher; if edges are higher, suggests inversion.
 * 3. Laplacian noise estimation — mean absolute Laplacian drives gaussian/bilateral strength.
 */
export function analyzeDepth(
	depthData: Float32Array,
	width: number,
	height: number
): PostProcessOptions {
	const n = depthData.length;

	// --- Histogram for percentile computation ---
	const BINS = 256;
	const histogram = new Uint32Array(BINS);
	for (let i = 0; i < n; i++) {
		const bin = Math.min(BINS - 1, Math.max(0, Math.floor(depthData[i] * (BINS - 1))));
		histogram[bin]++;
	}

	function percentile(p: number): number {
		const target = Math.floor(n * p);
		let cumulative = 0;
		for (let i = 0; i < BINS; i++) {
			cumulative += histogram[i];
			if (cumulative >= target) return (i + 0.5) / BINS;
		}
		return 1;
	}

	const p2 = percentile(0.02);
	const p98 = percentile(0.98);
	const range = p98 - p2;

	// --- 1. Auto-levels (contrast + brightness) ---
	// Maps [p2, p98] → roughly [0.05, 0.95] using the existing shader formula:
	//   output = (input - 0.5) * contrast + 0.5 + brightness
	let contrast = 1.0;
	let brightness = 0;

	if (range > 0.01) {
		contrast = clamp(0.9 / range, 0.5, 3.0);
		const mid = (p2 + p98) / 2;
		brightness = clamp(contrast * (0.5 - mid), -0.5, 0.5);

		// Round to slider-friendly precision
		contrast = Math.round(contrast * 20) / 20;
		brightness = Math.round(brightness * 100) / 100;
	}

	// --- 2. Inversion detection ---
	const invert = detectInversion(depthData, width, height);

	// --- 3. Noise-adaptive smoothing ---
	const noise = estimateNoise(depthData, width, height);

	let gaussianSigma: number;
	let bilateralIterations: number;
	let bilateralSpatialSigma: number;
	const bilateralRangeSigma = 0.1;

	if (noise < 0.005) {
		// Very clean depth — minimal processing
		gaussianSigma = 0;
		bilateralIterations = 0;
		bilateralSpatialSigma = 3;
	} else if (noise < 0.015) {
		// Moderate noise — light bilateral only
		gaussianSigma = 0;
		bilateralIterations = 1;
		bilateralSpatialSigma = 3;
	} else if (noise < 0.03) {
		// Noisy — light blur + stronger bilateral
		gaussianSigma = 0.5;
		bilateralIterations = 2;
		bilateralSpatialSigma = 4;
	} else {
		// Very noisy
		gaussianSigma = 1.0;
		bilateralIterations = 3;
		bilateralSpatialSigma = 5;
	}

	return {
		invert,
		contrast,
		brightness,
		gaussianSigma,
		bilateralIterations,
		bilateralSpatialSigma,
		bilateralRangeSigma
	};
}

/**
 * Compare average depth in center region vs outer ring.
 * Depth Anything V2 outputs closer = higher values.
 * If edges are significantly brighter than center, the map is likely inverted.
 */
function detectInversion(
	depthData: Float32Array,
	width: number,
	height: number
): boolean {
	const cx = width / 2;
	const cy = height / 2;
	const innerR2 = (Math.min(width, height) * 0.15) ** 2;
	const outerR2 = (Math.min(width, height) * 0.4) ** 2;

	let centerSum = 0,
		centerCount = 0;
	let edgeSum = 0,
		edgeCount = 0;

	const step = 4;
	for (let y = 0; y < height; y += step) {
		for (let x = 0; x < width; x += step) {
			const dx = x - cx;
			const dy = y - cy;
			const dist2 = dx * dx + dy * dy;
			const val = depthData[y * width + x];

			if (dist2 < innerR2) {
				centerSum += val;
				centerCount++;
			} else if (dist2 > outerR2) {
				edgeSum += val;
				edgeCount++;
			}
		}
	}

	const centerAvg = centerCount > 0 ? centerSum / centerCount : 0.5;
	const edgeAvg = edgeCount > 0 ? edgeSum / edgeCount : 0.5;

	return edgeAvg - centerAvg > 0.15;
}

/**
 * Estimate depth map noise via mean absolute Laplacian.
 * Samples every 4th pixel for speed.
 */
function estimateNoise(
	depthData: Float32Array,
	width: number,
	height: number
): number {
	let sum = 0;
	let count = 0;
	const step = 4;

	for (let y = 1; y < height - 1; y += step) {
		for (let x = 1; x < width - 1; x += step) {
			const idx = y * width + x;
			const laplacian = Math.abs(
				4 * depthData[idx] -
					depthData[idx - 1] -
					depthData[idx + 1] -
					depthData[idx - width] -
					depthData[idx + width]
			);
			sum += laplacian;
			count++;
		}
	}

	return count > 0 ? sum / count : 0;
}

function clamp(v: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, v));
}
