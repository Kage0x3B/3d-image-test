import { describe, it, expect } from 'vitest';
import { detectDepthEdges } from './edge-detection';

function makeDepthData(width: number, height: number, fill: number | ((x: number, y: number) => number)): Float32Array {
	const data = new Float32Array(width * height);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			data[y * width + x] = typeof fill === 'function' ? fill(x, y) : fill;
		}
	}
	return data;
}

describe('detectDepthEdges', () => {
	it('returns correct shape', () => {
		const data = makeDepthData(16, 16, 0.5);
		const result = detectDepthEdges(data, 16, 16, 0.1);
		expect(result.edgeMask).toBeInstanceOf(Uint8Array);
		expect(result.edgeMask.length).toBe(16 * 16);
		expect(result.width).toBe(16);
		expect(result.height).toBe(16);
	});

	it('detects no edges on a flat depth map', () => {
		const data = makeDepthData(16, 16, 0.5);
		const result = detectDepthEdges(data, 16, 16, 0.1);
		const totalEdges = result.edgeMask.reduce((s, v) => s + v, 0);
		expect(totalEdges).toBe(0);
	});

	it('detects edges at a sharp depth discontinuity', () => {
		// Left half = 0.0, right half = 1.0 (sharp vertical edge at x=8)
		const data = makeDepthData(16, 16, (x) => x < 8 ? 0.0 : 1.0);
		const result = detectDepthEdges(data, 16, 16, 0.1);

		// There should be edges near x=7-8 boundary
		let edgeCount = 0;
		for (let y = 1; y < 15; y++) {
			for (let x = 6; x <= 9; x++) {
				if (result.edgeMask[y * 16 + x]) edgeCount++;
			}
		}
		expect(edgeCount).toBeGreaterThan(0);
	});

	it('detects no edges for a smooth gradient below threshold', () => {
		// Very gentle gradient
		const data = makeDepthData(32, 32, (x) => x / 320);
		const result = detectDepthEdges(data, 32, 32, 0.1);
		const totalEdges = result.edgeMask.reduce((s, v) => s + v, 0);
		expect(totalEdges).toBe(0);
	});

	it('detects more edges with lower threshold', () => {
		// Moderate gradient
		const data = makeDepthData(16, 16, (x) => x / 15);
		const highThreshold = detectDepthEdges(data, 16, 16, 0.5);
		const lowThreshold = detectDepthEdges(data, 16, 16, 0.1);
		const highCount = highThreshold.edgeMask.reduce((s, v) => s + v, 0);
		const lowCount = lowThreshold.edgeMask.reduce((s, v) => s + v, 0);
		expect(lowCount).toBeGreaterThanOrEqual(highCount);
	});

	it('does not write edges at border pixels (row/col 0 and last)', () => {
		const data = makeDepthData(16, 16, (x) => x < 8 ? 0.0 : 1.0);
		const result = detectDepthEdges(data, 16, 16, 0.1);

		// Check row 0, row 15, col 0, col 15
		for (let x = 0; x < 16; x++) {
			expect(result.edgeMask[0 * 16 + x]).toBe(0); // top row
			expect(result.edgeMask[15 * 16 + x]).toBe(0); // bottom row
		}
		for (let y = 0; y < 16; y++) {
			expect(result.edgeMask[y * 16 + 0]).toBe(0); // left col
			expect(result.edgeMask[y * 16 + 15]).toBe(0); // right col
		}
	});
});
