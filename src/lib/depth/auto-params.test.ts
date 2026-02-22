import { describe, it, expect } from 'vitest';
import { analyzeDepth } from './auto-params';

function makeDepthData(width: number, height: number, fill: number | ((x: number, y: number) => number)): Float32Array {
	const data = new Float32Array(width * height);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			data[y * width + x] = typeof fill === 'function' ? fill(x, y) : fill;
		}
	}
	return data;
}

describe('analyzeDepth', () => {
	it('returns valid PostProcessOptions shape', () => {
		const data = makeDepthData(32, 32, 0.5);
		const result = analyzeDepth(data, 32, 32);
		expect(result).toHaveProperty('invert');
		expect(result).toHaveProperty('contrast');
		expect(result).toHaveProperty('brightness');
		expect(result).toHaveProperty('gaussianSigma');
		expect(result).toHaveProperty('bilateralIterations');
		expect(result).toHaveProperty('bilateralSpatialSigma');
		expect(result).toHaveProperty('bilateralRangeSigma');
	});

	describe('inversion detection', () => {
		it('does not invert when center is brighter (closer) than edges', () => {
			// Center bright, edges dark — standard Depth Anything output
			const data = makeDepthData(64, 64, (x, y) => {
				const cx = x - 32, cy = y - 32;
				const dist = Math.sqrt(cx * cx + cy * cy);
				return Math.max(0, 1 - dist / 32);
			});
			const result = analyzeDepth(data, 64, 64);
			expect(result.invert).toBe(false);
		});

		it('inverts when edges are brighter than center', () => {
			// Edges bright, center dark — inverted depth
			const data = makeDepthData(64, 64, (x, y) => {
				const cx = x - 32, cy = y - 32;
				const dist = Math.sqrt(cx * cx + cy * cy);
				return Math.min(1, dist / 32);
			});
			const result = analyzeDepth(data, 64, 64);
			expect(result.invert).toBe(true);
		});
	});

	describe('contrast/brightness (auto-levels)', () => {
		it('increases contrast for narrow histogram', () => {
			// All values in [0.4, 0.6] range
			const data = makeDepthData(32, 32, () => 0.4 + Math.random() * 0.2);
			const result = analyzeDepth(data, 32, 32);
			expect(result.contrast).toBeGreaterThan(1.0);
		});

		it('keeps contrast moderate for wide histogram', () => {
			// Values spanning [0.05, 0.95]
			const data = makeDepthData(32, 32, (x, y) => (x + y * 32) / (32 * 32));
			const result = analyzeDepth(data, 32, 32);
			expect(result.contrast).toBeLessThanOrEqual(1.5);
		});
	});

	describe('noise-adaptive smoothing', () => {
		it('suggests minimal smoothing for clean depth', () => {
			// Smooth gradient — very low noise
			const data = makeDepthData(32, 32, (x, y) => (x + y) / 62);
			const result = analyzeDepth(data, 32, 32);
			expect(result.bilateralIterations).toBeLessThanOrEqual(1);
		});

		it('suggests more smoothing for noisy depth', () => {
			// High-frequency noise
			const data = makeDepthData(32, 32, () => Math.random());
			const result = analyzeDepth(data, 32, 32);
			expect(result.bilateralIterations).toBeGreaterThanOrEqual(2);
		});
	});
});
