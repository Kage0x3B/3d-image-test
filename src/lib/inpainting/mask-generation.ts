import type { EdgeDetectionResult, InpaintingMask } from './types';

/**
 * Generate an inpainting mask by dilating edge pixels toward the FOREGROUND side
 * (higher depth = closer to camera). This extends background content under the
 * foreground silhouette, filling areas revealed when the mesh tears at depth edges.
 * The mask is then upscaled from depth resolution to photo resolution.
 */
export function generateInpaintingMask(
	edgeResult: EdgeDetectionResult,
	depthData: Float32Array,
	depthW: number,
	depthH: number,
	photoW: number,
	photoH: number,
	stripWidth: number
): InpaintingMask {
	const { edgeMask } = edgeResult;

	// Work at depth resolution first
	const depthMask = new Uint8Array(depthW * depthH);

	// For each edge pixel, determine the background direction and dilate
	for (let y = 1; y < depthH - 1; y++) {
		for (let x = 1; x < depthW - 1; x++) {
			if (!edgeMask[y * depthW + x]) continue;

			const centerDepth = depthData[y * depthW + x];

			// Sample neighbors to find foreground direction (higher depth = closer to camera).
			// We dilate toward the foreground side so the inpainting extends background
			// content under the foreground silhouette, filling the area revealed by tears.
			const neighbors = [
				{ dx: -1, dy: 0 },
				{ dx: 1, dy: 0 },
				{ dx: 0, dy: -1 },
				{ dx: 0, dy: 1 }
			];

			let fgDx = 0;
			let fgDy = 0;
			let maxDiff = 0;

			for (const { dx, dy } of neighbors) {
				const nx = x + dx;
				const ny = y + dy;
				if (nx < 0 || nx >= depthW || ny < 0 || ny >= depthH) continue;

				const neighborDepth = depthData[ny * depthW + nx];
				const diff = neighborDepth - centerDepth; // positive = neighbor is foreground

				if (diff > maxDiff) {
					maxDiff = diff;
					fgDx = dx;
					fgDy = dy;
				}
			}

			// If no clear foreground direction, dilate in all directions
			if (maxDiff < 0.01) {
				// Radial dilation for ambiguous edges
				for (let dy2 = -stripWidth; dy2 <= stripWidth; dy2++) {
					for (let dx2 = -stripWidth; dx2 <= stripWidth; dx2++) {
						if (dx2 * dx2 + dy2 * dy2 > stripWidth * stripWidth) continue;
						const mx = x + dx2;
						const my = y + dy2;
						if (mx >= 0 && mx < depthW && my >= 0 && my < depthH) {
							depthMask[my * depthW + mx] = 1;
						}
					}
				}
			} else {
				// Directional dilation toward foreground
				for (let step = 0; step <= stripWidth; step++) {
					const mx = x + fgDx * step;
					const my = y + fgDy * step;
					if (mx < 0 || mx >= depthW || my < 0 || my >= depthH) break;
					depthMask[my * depthW + mx] = 1;

					// Also spread perpendicular to the dilation direction for coverage
					const perpDx = fgDy;
					const perpDy = fgDx;
					for (let perp = -2; perp <= 2; perp++) {
						const px = mx + perpDx * perp;
						const py = my + perpDy * perp;
						if (px >= 0 && px < depthW && py >= 0 && py < depthH) {
							depthMask[py * depthW + px] = 1;
						}
					}
				}
			}
		}
	}

	// Upscale mask from depth resolution to photo resolution via nearest-neighbor
	const mask = new Uint8Array(photoW * photoH);
	const scaleX = depthW / photoW;
	const scaleY = depthH / photoH;

	for (let y = 0; y < photoH; y++) {
		const srcY = Math.min(depthH - 1, Math.floor(y * scaleY));
		for (let x = 0; x < photoW; x++) {
			const srcX = Math.min(depthW - 1, Math.floor(x * scaleX));
			mask[y * photoW + x] = depthMask[srcY * depthW + srcX];
		}
	}

	return { mask, width: photoW, height: photoH };
}
