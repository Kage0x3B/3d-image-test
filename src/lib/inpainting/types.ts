export type RenderingMethod = 'simple' | 'torn-mesh';

export type InpaintingMethod = 'none' | 'telea' | 'migan';

export interface EdgeDetectionResult {
	edgeMask: Uint8Array;
	width: number;
	height: number;
}

export interface InpaintingMask {
	mask: Uint8Array;
	width: number;
	height: number;
}

export interface InpaintingResult {
	imageData: Uint8ClampedArray;
	width: number;
	height: number;
}
