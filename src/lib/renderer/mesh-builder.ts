import * as THREE from 'three';
import type { MeshConfig } from './types';
import { canvasToTexture, imageToTexture } from './texture-utils';

export function buildDisplacedMesh(config: MeshConfig): {
	mesh: THREE.Mesh;
	material: THREE.MeshStandardMaterial;
} {
	const { photo, depthCanvas, displacementScale, subdivisions } = config;

	const width = photo instanceof HTMLImageElement ? photo.naturalWidth : photo.width;
	const height = photo instanceof HTMLImageElement ? photo.naturalHeight : photo.height;
	const aspect = width / height;

	// Normalize so the largest dimension is 2 units
	const planeWidth = aspect >= 1 ? 2 : 2 * aspect;
	const planeHeight = aspect >= 1 ? 2 / aspect : 2;

	const subsX = subdivisions;
	const subsY = Math.round(subdivisions / aspect);

	const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight, subsX, subsY);

	const photoTexture = imageToTexture(photo);
	const depthTexture = canvasToTexture(depthCanvas);
	// Depth map is linear data, not color
	depthTexture.colorSpace = THREE.LinearSRGBColorSpace;

	const material = new THREE.MeshStandardMaterial({
		map: photoTexture,
		displacementMap: depthTexture,
		displacementScale: displacementScale,
		side: THREE.FrontSide
	});

	const mesh = new THREE.Mesh(geometry, material);
	return { mesh, material };
}
