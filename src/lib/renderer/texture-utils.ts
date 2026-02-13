import * as THREE from 'three';

export function canvasToTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
	const texture = new THREE.CanvasTexture(canvas);
	texture.minFilter = THREE.LinearFilter;
	texture.magFilter = THREE.LinearFilter;
	return texture;
}

export function imageToTexture(image: HTMLImageElement | ImageBitmap): THREE.Texture {
	const texture = new THREE.Texture(image as TexImageSource);
	texture.colorSpace = THREE.SRGBColorSpace;
	texture.needsUpdate = true;
	return texture;
}
