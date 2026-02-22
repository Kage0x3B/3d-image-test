/**
 * Telea inpainting algorithm (Fast Marching Method).
 * Based on "An Image Inpainting Technique Based on the Fast Marching Method"
 * by Alexandru Telea, 2004.
 *
 * Port inspired by antimatter15/inpaint.js.
 * Processes pixels inward from mask boundary using weighted average
 * following gradient direction.
 */

const KNOWN = 0;
const BAND = 1;
const INSIDE = 2;

interface FMMPixel {
	x: number;
	y: number;
	t: number; // arrival time
}

export function inpaintTelea(
	imageData: Uint8ClampedArray,
	width: number,
	height: number,
	mask: Uint8Array,
	radius: number = 5
): Uint8ClampedArray {
	const result = new Uint8ClampedArray(imageData);
	const numPixels = width * height;

	// Process each channel (R, G, B) independently
	for (let channel = 0; channel < 3; channel++) {
		const channelData = new Float32Array(numPixels);
		for (let i = 0; i < numPixels; i++) {
			channelData[i] = imageData[i * 4 + channel];
		}

		const inpainted = inpaintChannel(channelData, width, height, mask, radius);

		for (let i = 0; i < numPixels; i++) {
			result[i * 4 + channel] = Math.round(Math.max(0, Math.min(255, inpainted[i])));
		}
	}

	return result;
}

function inpaintChannel(
	data: Float32Array,
	width: number,
	height: number,
	mask: Uint8Array,
	radius: number
): Float32Array {
	const result = new Float32Array(data);
	const numPixels = width * height;

	// Initialize flags and distance (arrival time)
	const flags = new Uint8Array(numPixels);
	const dist = new Float32Array(numPixels);
	dist.fill(1e6);

	// Initialize: KNOWN = outside mask, INSIDE = inside mask
	for (let i = 0; i < numPixels; i++) {
		if (mask[i]) {
			flags[i] = INSIDE;
		} else {
			flags[i] = KNOWN;
			dist[i] = 0;
		}
	}

	// Find initial BAND pixels: INSIDE pixels adjacent to KNOWN
	const heap: FMMPixel[] = [];

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const idx = y * width + x;
			if (flags[idx] !== INSIDE) continue;

			// Check 4-neighbors
			const neighbors = [
				[x - 1, y], [x + 1, y],
				[x, y - 1], [x, y + 1]
			];

			for (const [nx, ny] of neighbors) {
				if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
				const nIdx = ny * width + nx;
				if (flags[nIdx] === KNOWN) {
					flags[idx] = BAND;
					dist[idx] = 1;
					heap.push({ x, y, t: 1 });
					break;
				}
			}
		}
	}

	// Sort heap by arrival time (min-heap via sorted array)
	heap.sort((a, b) => a.t - b.t);

	// Fast Marching: process BAND pixels in order of arrival time
	while (heap.length > 0) {
		// Pop pixel with smallest arrival time
		const pixel = heap.shift()!;
		const { x, y } = pixel;
		const idx = y * width + x;

		if (flags[idx] === KNOWN) continue;
		flags[idx] = KNOWN;

		// Inpaint this pixel using weighted average of nearby KNOWN pixels
		result[idx] = inpaintPixel(result, flags, dist, width, height, x, y, radius);

		// Update neighbors
		const neighbors = [
			[x - 1, y], [x + 1, y],
			[x, y - 1], [x, y + 1]
		];

		for (const [nx, ny] of neighbors) {
			if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
			const nIdx = ny * width + nx;

			if (flags[nIdx] !== KNOWN) {
				const newDist = solveEikonal(dist, flags, width, height, nx, ny);
				if (newDist < dist[nIdx]) {
					dist[nIdx] = newDist;
				}

				if (flags[nIdx] === INSIDE) {
					flags[nIdx] = BAND;
					// Insert into heap maintaining sort order
					insertSorted(heap, { x: nx, y: ny, t: dist[nIdx] });
				}
			}
		}
	}

	return result;
}

function inpaintPixel(
	data: Float32Array,
	flags: Uint8Array,
	dist: Float32Array,
	width: number,
	height: number,
	x: number,
	y: number,
	radius: number
): number {
	let weightSum = 0;
	let valueSum = 0;

	// Compute gradient of distance at this point
	const idx = y * width + x;
	let gradX = 0;
	let gradY = 0;

	if (x > 0 && x < width - 1) {
		gradX = (dist[idx + 1] - dist[idx - 1]) * 0.5;
	}
	if (y > 0 && y < height - 1) {
		gradY = (dist[(y + 1) * width + x] - dist[(y - 1) * width + x]) * 0.5;
	}

	const gradLen = Math.sqrt(gradX * gradX + gradY * gradY);
	if (gradLen > 1e-6) {
		gradX /= gradLen;
		gradY /= gradLen;
	}

	const r = Math.ceil(radius);

	for (let dy = -r; dy <= r; dy++) {
		for (let dx = -r; dx <= r; dx++) {
			const nx = x + dx;
			const ny = y + dy;

			if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
			const nIdx = ny * width + nx;
			if (flags[nIdx] !== KNOWN) continue;

			const distSq = dx * dx + dy * dy;
			if (distSq > radius * radius) continue;
			if (distSq === 0) continue;

			const d = Math.sqrt(distSq);

			// Directional weight: favor pixels along gradient direction
			const dirFactor = dx * gradX + dy * gradY;
			const dirWeight = Math.max(0, dirFactor) / d;

			// Distance weight: closer pixels have more influence
			const distWeight = 1 / (d * d);

			// Level-set weight: favor pixels at similar distance from boundary
			const levelDiff = 1 / (1 + Math.abs(dist[nIdx] - dist[idx]));

			const weight = distWeight * dirWeight * levelDiff;

			if (weight > 0) {
				valueSum += weight * data[nIdx];
				weightSum += weight;
			}
		}
	}

	if (weightSum > 0) {
		return valueSum / weightSum;
	}

	// Fallback: average of KNOWN neighbors
	let fallbackSum = 0;
	let fallbackCount = 0;
	const neighbors = [
		[x - 1, y], [x + 1, y],
		[x, y - 1], [x, y + 1]
	];
	for (const [nx, ny] of neighbors) {
		if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
		const nIdx = ny * width + nx;
		if (flags[nIdx] === KNOWN) {
			fallbackSum += data[nIdx];
			fallbackCount++;
		}
	}
	return fallbackCount > 0 ? fallbackSum / fallbackCount : data[idx];
}

/**
 * Solve the Eikonal equation at (x,y) from its KNOWN neighbors.
 * Returns the estimated arrival time.
 */
function solveEikonal(
	dist: Float32Array,
	flags: Uint8Array,
	width: number,
	height: number,
	x: number,
	y: number
): number {
	// Get horizontal and vertical minimum known distances
	let dH = 1e6;
	if (x > 0 && flags[y * width + (x - 1)] === KNOWN) {
		dH = Math.min(dH, dist[y * width + (x - 1)]);
	}
	if (x < width - 1 && flags[y * width + (x + 1)] === KNOWN) {
		dH = Math.min(dH, dist[y * width + (x + 1)]);
	}

	let dV = 1e6;
	if (y > 0 && flags[(y - 1) * width + x] === KNOWN) {
		dV = Math.min(dV, dist[(y - 1) * width + x]);
	}
	if (y < height - 1 && flags[(y + 1) * width + x] === KNOWN) {
		dV = Math.min(dV, dist[(y + 1) * width + x]);
	}

	// Solve quadratic for the Eikonal equation: (t - dH)^2 + (t - dV)^2 = 1
	if (dH > 1e5) return dV + 1;
	if (dV > 1e5) return dH + 1;

	const diff = dH - dV;
	if (Math.abs(diff) >= 1) {
		return Math.min(dH, dV) + 1;
	}

	return (dH + dV + Math.sqrt(2 - diff * diff)) / 2;
}

function insertSorted(heap: FMMPixel[], pixel: FMMPixel): void {
	// Binary search for insert position
	let lo = 0;
	let hi = heap.length;
	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		if (heap[mid].t < pixel.t) {
			lo = mid + 1;
		} else {
			hi = mid;
		}
	}
	heap.splice(lo, 0, pixel);
}
