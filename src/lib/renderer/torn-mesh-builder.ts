import * as THREE from 'three';
import { imageToTexture, canvasToTexture } from './texture-utils';

export interface TornMeshConfig {
	photo: HTMLImageElement | ImageBitmap;
	inpaintedPhoto?: HTMLCanvasElement | null;
	depthData: Float32Array;
	depthWidth: number;
	depthHeight: number;
	displacementScale: number;
	subdivisions: number;
	edgeThreshold: number;
	depthCanvas: HTMLCanvasElement;
}

export interface TornMeshResult {
	mesh: THREE.Mesh;
	material: THREE.MeshStandardMaterial;
	fillMesh: THREE.Mesh | null;
	fillMaterial: THREE.MeshStandardMaterial | null;
}

/**
 * Build a torn mesh: geometry with depth baked into vertex Z positions
 * and triangles removed at depth discontinuities.
 *
 * When an inpainted photo is provided, also builds a fill mesh (standard
 * displacement mesh) that sits behind the torn mesh. The torn mesh's gaps
 * reveal the fill mesh's inpainted content.
 */
export function buildTornMesh(config: TornMeshConfig): TornMeshResult {
	const {
		photo,
		inpaintedPhoto,
		depthData,
		depthWidth,
		depthHeight,
		displacementScale,
		subdivisions,
		edgeThreshold,
		depthCanvas
	} = config;

	const width = photo instanceof HTMLImageElement ? photo.naturalWidth : photo.width;
	const height = photo instanceof HTMLImageElement ? photo.naturalHeight : photo.height;
	const aspect = width / height;

	// Normalize so the largest dimension is 2 units (same as mesh-builder.ts)
	const planeWidth = aspect >= 1 ? 2 : 2 * aspect;
	const planeHeight = aspect >= 1 ? 2 / aspect : 2;

	const subsX = subdivisions;
	const subsY = Math.round(subdivisions / aspect);
	const vertsX = subsX + 1;
	const vertsY = subsY + 1;

	// Build vertex grid with depth baked into Z
	const positions = new Float32Array(vertsX * vertsY * 3);
	const uvs = new Float32Array(vertsX * vertsY * 2);
	const vertexDepths = new Float32Array(vertsX * vertsY);

	for (let iy = 0; iy < vertsY; iy++) {
		for (let ix = 0; ix < vertsX; ix++) {
			const idx = iy * vertsX + ix;
			const u = ix / subsX;
			const v = iy / subsY;

			// Position (centered at origin)
			const x = (u - 0.5) * planeWidth;
			const y = (0.5 - v) * planeHeight; // flip Y: top of image = positive Y

			// Sample depth via bilinear interpolation
			const depthU = u * (depthWidth - 1);
			const depthV = v * (depthHeight - 1);
			const dx0 = Math.floor(depthU);
			const dy0 = Math.floor(depthV);
			const dx1 = Math.min(dx0 + 1, depthWidth - 1);
			const dy1 = Math.min(dy0 + 1, depthHeight - 1);
			const fx = depthU - dx0;
			const fy = depthV - dy0;

			const d00 = depthData[dy0 * depthWidth + dx0];
			const d10 = depthData[dy0 * depthWidth + dx1];
			const d01 = depthData[dy1 * depthWidth + dx0];
			const d11 = depthData[dy1 * depthWidth + dx1];

			const depth =
				d00 * (1 - fx) * (1 - fy) +
				d10 * fx * (1 - fy) +
				d01 * (1 - fx) * fy +
				d11 * fx * fy;

			vertexDepths[idx] = depth;

			positions[idx * 3] = x;
			positions[idx * 3 + 1] = y;
			positions[idx * 3 + 2] = depth * displacementScale;

			uvs[idx * 2] = u;
			uvs[idx * 2 + 1] = 1 - v; // Three.js UV convention
		}
	}

	// Build index buffer, skipping quads with depth discontinuities
	const indices: number[] = [];

	for (let iy = 0; iy < subsY; iy++) {
		for (let ix = 0; ix < subsX; ix++) {
			const a = iy * vertsX + ix;
			const b = iy * vertsX + (ix + 1);
			const c = (iy + 1) * vertsX + ix;
			const d = (iy + 1) * vertsX + (ix + 1);

			// Compute max depth difference across the quad's 4 corners
			const da = vertexDepths[a];
			const db = vertexDepths[b];
			const dc = vertexDepths[c];
			const dd = vertexDepths[d];

			const minD = Math.min(da, db, dc, dd);
			const maxD = Math.max(da, db, dc, dd);

			if (maxD - minD > edgeThreshold) {
				// Skip both triangles — creates the tear
				continue;
			}

			// Two triangles per quad (CCW winding for front-facing towards +Z)
			indices.push(a, d, b);
			indices.push(a, c, d);
		}
	}

	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
	geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
	geometry.setIndex(indices);
	geometry.computeVertexNormals();

	// Main torn mesh always uses the ORIGINAL photo texture (no smearing)
	const texture = imageToTexture(photo);

	const material = new THREE.MeshStandardMaterial({
		map: texture,
		side: THREE.FrontSide
	});

	const mesh = new THREE.Mesh(geometry, material);

	// Build fill mesh if inpainted photo is available.
	// This is a standard displacement mesh that sits behind the torn mesh.
	// The torn mesh's gaps reveal this fill mesh's inpainted content.
	let fillMesh: THREE.Mesh | null = null;
	let fillMaterial: THREE.MeshStandardMaterial | null = null;

	if (inpaintedPhoto) {
		const fillGeo = new THREE.PlaneGeometry(planeWidth, planeHeight, subsX, subsY);

		const fillTexture = canvasToTexture(inpaintedPhoto);
		fillTexture.colorSpace = THREE.SRGBColorSpace;

		const depthTexture = canvasToTexture(depthCanvas);
		depthTexture.colorSpace = THREE.LinearSRGBColorSpace;

		fillMaterial = new THREE.MeshStandardMaterial({
			map: fillTexture,
			displacementMap: depthTexture,
			displacementScale: displacementScale,
			side: THREE.FrontSide,
			// Push fill mesh behind in depth buffer to prevent z-fighting
			polygonOffset: true,
			polygonOffsetFactor: 1,
			polygonOffsetUnits: 1
		});

		fillMesh = new THREE.Mesh(fillGeo, fillMaterial);
	}

	return { mesh, material, fillMesh, fillMaterial };
}
