import type { ViewingMode, ViewingModeConfig } from './types';
import type { SceneContext } from '../renderer/types';
import { VRButton } from 'three/addons/webxr/VRButton.js';

export class WebXRMode implements ViewingMode {
	readonly id = 'webxr';
	readonly label = 'VR Headset';

	private ctx: SceneContext | null = null;
	private vrButton: HTMLElement | null = null;
	private originalMeshPosition = { x: 0, y: 0, z: 0 };

	isAvailable(): boolean {
		return 'xr' in navigator;
	}

	activate(ctx: SceneContext, config: ViewingModeConfig): void {
		this.ctx = ctx;
		const viewDist = (config.webxrViewingDistance as number) ?? 1.8;

		// Save original mesh position
		this.originalMeshPosition.x = ctx.mesh.position.x;
		this.originalMeshPosition.y = ctx.mesh.position.y;
		this.originalMeshPosition.z = ctx.mesh.position.z;

		// Enable XR
		ctx.renderer.xr.enabled = true;
		ctx.renderer.xr.setReferenceSpaceType('local');

		// Position mesh for comfortable VR viewing
		ctx.mesh.position.set(0, 1.5, -viewDist);

		// Use setAnimationLoop for WebXR
		ctx.renderer.setAnimationLoop(() => {
			ctx.renderer.render(ctx.scene, ctx.camera);
		});

		// Create VR button
		this.vrButton = VRButton.createButton(ctx.renderer);
		this.vrButton.style.position = 'absolute';
		this.vrButton.style.bottom = '20px';
		this.vrButton.style.left = '50%';
		this.vrButton.style.transform = 'translateX(-50%)';
		ctx.container.style.position = 'relative';
		ctx.container.appendChild(this.vrButton);
	}

	deactivate(): void {
		if (this.ctx) {
			this.ctx.renderer.xr.enabled = false;
			this.ctx.renderer.setAnimationLoop(null);

			// Restore mesh position
			this.ctx.mesh.position.set(
				this.originalMeshPosition.x,
				this.originalMeshPosition.y,
				this.originalMeshPosition.z
			);

			if (this.vrButton && this.vrButton.parentElement) {
				this.vrButton.parentElement.removeChild(this.vrButton);
			}
		}
		this.vrButton = null;
		this.ctx = null;
	}

	updateConfig(key: string, value: unknown): void {
		if (key === 'viewingDistance' && this.ctx) {
			this.ctx.mesh.position.z = -(value as number);
		}
	}
}
