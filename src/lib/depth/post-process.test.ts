import { describe, it, expect } from 'vitest';
import { postProcessDepthData, type PostProcessOptions } from './post-process';

function makeDepthData(width: number, height: number, fill: number | ((x: number, y: number) => number)): Float32Array {
	const data = new Float32Array(width * height);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			data[y * width + x] = typeof fill === 'function' ? fill(x, y) : fill;
		}
	}
	return data;
}

function defaultOptions(overrides: Partial<PostProcessOptions> = {}): PostProcessOptions {
	return {
		bilateralIterations: 0,
		bilateralSpatialSigma: 3,
		bilateralRangeSigma: 0.1,
		gaussianSigma: 0,
		invert: false,
		contrast: 1.0,
		brightness: 0,
		...overrides
	};
}

describe('postProcessDepthData', () => {
	describe('invert', () => {
		it('flips all values (v → 1 - v)', () => {
			const data = makeDepthData(4, 4, 0.2);
			const result = postProcessDepthData(data, 4, 4, defaultOptions({ invert: true }));
			for (let i = 0; i < result.length; i++) {
				expect(result[i]).toBeCloseTo(0.8, 5);
			}
		});

		it('double invert returns original', () => {
			const data = makeDepthData(4, 4, (x, y) => (x + y) / 6);
			const once = postProcessDepthData(data, 4, 4, defaultOptions({ invert: true }));
			const twice = postProcessDepthData(once, 4, 4, defaultOptions({ invert: true }));
			for (let i = 0; i < data.length; i++) {
				expect(twice[i]).toBeCloseTo(data[i], 5);
			}
		});
	});

	describe('contrast', () => {
		it('increases range when > 1', () => {
			const data = makeDepthData(4, 4, (x) => 0.4 + x * 0.05);
			const result = postProcessDepthData(data, 4, 4, defaultOptions({ contrast: 2.0 }));
			// Center value (0.5) should stay at 0.5
			// Values below 0.5 should go lower, above should go higher
			const minIn = Math.min(...data);
			const maxIn = Math.max(...data);
			const rangeIn = maxIn - minIn;
			const minOut = Math.min(...result);
			const maxOut = Math.max(...result);
			const rangeOut = maxOut - minOut;
			expect(rangeOut).toBeGreaterThan(rangeIn);
		});

		it('decreases range when < 1', () => {
			const data = makeDepthData(4, 4, (x) => x / 3);
			const result = postProcessDepthData(data, 4, 4, defaultOptions({ contrast: 0.5 }));
			const rangeIn = Math.max(...data) - Math.min(...data);
			const rangeOut = Math.max(...result) - Math.min(...result);
			expect(rangeOut).toBeLessThan(rangeIn);
		});
	});

	describe('brightness', () => {
		it('shifts values up', () => {
			const data = makeDepthData(4, 4, 0.3);
			const result = postProcessDepthData(data, 4, 4, defaultOptions({ brightness: 0.2 }));
			for (let i = 0; i < result.length; i++) {
				expect(result[i]).toBeCloseTo(0.5, 5);
			}
		});

		it('clamps values to [0, 1]', () => {
			const data = makeDepthData(4, 4, 0.9);
			const result = postProcessDepthData(data, 4, 4, defaultOptions({ brightness: 0.5 }));
			for (let i = 0; i < result.length; i++) {
				expect(result[i]).toBeLessThanOrEqual(1);
				expect(result[i]).toBeGreaterThanOrEqual(0);
			}
		});
	});

	describe('gaussian blur', () => {
		it('smooths out a single bright pixel', () => {
			const data = makeDepthData(9, 9, 0);
			data[4 * 9 + 4] = 1.0; // center pixel bright
			const result = postProcessDepthData(data, 9, 9, defaultOptions({ gaussianSigma: 1.0 }));
			// Center should be lower than 1.0 (energy spread)
			expect(result[4 * 9 + 4]).toBeLessThan(1.0);
			// Neighbors should be non-zero
			expect(result[4 * 9 + 3]).toBeGreaterThan(0);
			expect(result[3 * 9 + 4]).toBeGreaterThan(0);
		});

		it('does not change a uniform field', () => {
			const data = makeDepthData(8, 8, 0.5);
			const result = postProcessDepthData(data, 8, 8, defaultOptions({ gaussianSigma: 2.0 }));
			for (let i = 0; i < result.length; i++) {
				expect(result[i]).toBeCloseTo(0.5, 3);
			}
		});
	});

	describe('bilateral filter', () => {
		it('smooths flat regions', () => {
			// Slightly noisy flat region
			const data = makeDepthData(8, 8, () => 0.5 + (Math.random() - 0.5) * 0.05);
			const result = postProcessDepthData(data, 8, 8, defaultOptions({
				bilateralIterations: 2,
				bilateralSpatialSigma: 3,
				bilateralRangeSigma: 0.1
			}));
			// Variance should decrease
			const variance = (arr: Float32Array) => {
				const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
				return arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length;
			};
			expect(variance(result)).toBeLessThan(variance(data));
		});

		it('preserves edges', () => {
			// Left half = 0.2, right half = 0.8
			const data = makeDepthData(20, 10, (x) => x < 10 ? 0.2 : 0.8);
			const result = postProcessDepthData(data, 20, 10, defaultOptions({
				bilateralIterations: 2,
				bilateralSpatialSigma: 3,
				bilateralRangeSigma: 0.05
			}));
			// Far-from-edge pixels should still be close to their original values
			expect(result[5 * 20 + 2]).toBeCloseTo(0.2, 1);
			expect(result[5 * 20 + 17]).toBeCloseTo(0.8, 1);
		});
	});

	describe('no-op options', () => {
		it('returns a copy when all processing is disabled', () => {
			const data = makeDepthData(4, 4, (x, y) => (x + y) / 6);
			const result = postProcessDepthData(data, 4, 4, defaultOptions());
			expect(result).not.toBe(data); // New array
			for (let i = 0; i < data.length; i++) {
				expect(result[i]).toBeCloseTo(data[i], 5);
			}
		});
	});

	describe('progress callbacks', () => {
		it('reports progress steps', () => {
			const steps: { progress: number; message: string }[] = [];
			const data = makeDepthData(4, 4, 0.5);
			postProcessDepthData(data, 4, 4, defaultOptions({ bilateralIterations: 1 }), (progress, message) => {
				steps.push({ progress, message });
			});
			expect(steps.length).toBeGreaterThan(0);
			expect(steps[steps.length - 1].progress).toBe(1);
		});
	});
});
