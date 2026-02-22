import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import type { SceneContext } from '../renderer/types';

function downloadBlob(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

/**
 * For simple meshes (displacement map based), bake the displacement
 * into vertex positions so the exported glTF has real 3D geometry.
 */
function bakeDisplacement(mesh: THREE.Mesh): THREE.Mesh {
	const srcGeo = mesh.geometry;
	const srcMat = mesh.material as THREE.MeshStandardMaterial;

	const geo = srcGeo.clone();
	const positions = geo.attributes.position;
	const uvs = geo.attributes.uv;

	const dispMap = srcMat.displacementMap;
	const dispScale = srcMat.displacementScale;

	if (dispMap && dispMap.image) {
		// Read displacement map pixel data
		const canvas = document.createElement('canvas');
		const img = dispMap.image as HTMLImageElement | HTMLCanvasElement;
		canvas.width = img.width;
		canvas.height = img.height;
		const ctx = canvas.getContext('2d')!;
		ctx.drawImage(img, 0, 0);
		const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
		const pixels = imgData.data;

		const normal = new THREE.Vector3(0, 0, 1); // plane normal

		for (let i = 0; i < positions.count; i++) {
			const u = uvs.getX(i);
			const v = uvs.getY(i);

			// Sample displacement value from texture
			const px = Math.min(Math.floor(u * canvas.width), canvas.width - 1);
			const py = Math.min(Math.floor((1 - v) * canvas.height), canvas.height - 1);
			const idx = (py * canvas.width + px) * 4;
			const dispValue = pixels[idx] / 255;

			// Apply displacement along normal
			const offset = dispValue * dispScale;
			positions.setZ(i, positions.getZ(i) + offset * normal.z);
		}

		positions.needsUpdate = true;
		geo.computeVertexNormals();

		// Release the temp canvas
		canvas.width = 0;
		canvas.height = 0;
	}

	// Create material with just the color texture (no displacement)
	const mat = new THREE.MeshStandardMaterial({
		map: srcMat.map, // share, don't clone — we won't dispose it
		side: THREE.FrontSide
	});

	return new THREE.Mesh(geo, mat);
}

export async function exportGLTF(ctx: SceneContext): Promise<void> {
	const exporter = new GLTFExporter();

	// Build an export scene with baked geometry
	const exportScene = new THREE.Scene();

	if (ctx.renderingMethod === 'torn-mesh') {
		// Torn mesh already has displacement baked into vertices — just clone geometry
		const clonedGeo = ctx.mesh.geometry.clone();
		const mat = new THREE.MeshStandardMaterial({
			map: (ctx.material as THREE.MeshStandardMaterial).map,
			side: THREE.FrontSide
		});
		exportScene.add(new THREE.Mesh(clonedGeo, mat));

		if (ctx.fillMesh) {
			const fillGeo = ctx.fillMesh.geometry.clone();
			const fillMat = new THREE.MeshStandardMaterial({
				map: (ctx.fillMaterial as THREE.MeshStandardMaterial)?.map ?? null,
				side: THREE.FrontSide
			});
			exportScene.add(new THREE.Mesh(fillGeo, fillMat));
		}
	} else {
		// Simple mesh: bake displacement into vertices
		const baked = bakeDisplacement(ctx.mesh);
		exportScene.add(baked);
	}

	const glb = await exporter.parseAsync(exportScene, { binary: true });

	// Cleanup cloned geometry/materials (don't dispose shared textures)
	exportScene.traverse((obj) => {
		if (obj instanceof THREE.Mesh) {
			obj.geometry.dispose();
			(obj.material as THREE.MeshStandardMaterial).dispose();
		}
	});

	const blob = new Blob([glb as ArrayBuffer], { type: 'model/gltf-binary' });
	downloadBlob(blob, '3d-photo.glb');
}
