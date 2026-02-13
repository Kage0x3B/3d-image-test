import type { ViewingMode, ViewingModeConfig } from './types';
import type { SceneContext } from '../renderer/types';
import { fitCameraToImage } from '../renderer/scene-manager';

export class StereoMode implements ViewingMode {
	readonly id = 'stereo';
	readonly label = 'Stereo 3D';

	private ctx: SceneContext | null = null;
	private animationId: number | null = null;
	private crossEye = false;
	private eyeSeparation = 0.06;

	isAvailable(): boolean {
		return true;
	}

	activate(ctx: SceneContext, config: ViewingModeConfig): void {
		this.ctx = ctx;
		this.crossEye = (config.stereoCrossEye as boolean) ?? false;
		this.eyeSeparation = (config.stereoEyeSeparation as number) ?? 0.06;

		ctx.renderer.xr.enabled = false;
		ctx.mesh.position.set(0, 0, 0);

		// Fit camera for half-width viewport (each eye gets half)
		const halfWidth = Math.floor(ctx.container.clientWidth / 2);
		ctx.camera.aspect = halfWidth / ctx.container.clientHeight;
		ctx.camera.updateProjectionMatrix();
		fitCameraToImage(ctx, halfWidth);

		const animate = () => {
			this.animationId = requestAnimationFrame(animate);
			if (!this.ctx) return;

			const { renderer, scene, camera, container } = this.ctx;
			const width = container.clientWidth;
			const height = container.clientHeight;
			const halfW = Math.floor(width / 2);

			// Each eye has its own aspect ratio
			camera.aspect = halfW / height;
			camera.updateProjectionMatrix();

			const baseZ = camera.position.z;

			renderer.setScissorTest(true);

			// Left eye
			const leftEyeX = this.crossEye ? this.eyeSeparation / 2 : -this.eyeSeparation / 2;
			camera.position.set(leftEyeX, 0, baseZ);
			camera.lookAt(0, 0, 0);

			const leftViewportX = this.crossEye ? halfW : 0;
			renderer.setViewport(leftViewportX, 0, halfW, height);
			renderer.setScissor(leftViewportX, 0, halfW, height);
			renderer.render(scene, camera);

			// Right eye
			const rightEyeX = this.crossEye ? -this.eyeSeparation / 2 : this.eyeSeparation / 2;
			camera.position.set(rightEyeX, 0, baseZ);
			camera.lookAt(0, 0, 0);

			const rightViewportX = this.crossEye ? 0 : halfW;
			renderer.setViewport(rightViewportX, 0, halfW, height);
			renderer.setScissor(rightViewportX, 0, halfW, height);
			renderer.render(scene, camera);

			renderer.setScissorTest(false);
		};
		animate();
	}

	deactivate(): void {
		if (this.animationId !== null) {
			cancelAnimationFrame(this.animationId);
			this.animationId = null;
		}
		if (this.ctx) {
			this.ctx.renderer.setScissorTest(false);
			const { container } = this.ctx;
			this.ctx.renderer.setViewport(0, 0, container.clientWidth, container.clientHeight);
			// Restore full-width aspect
			this.ctx.camera.aspect = container.clientWidth / container.clientHeight;
			this.ctx.camera.updateProjectionMatrix();
			fitCameraToImage(this.ctx);
		}
		this.ctx = null;
	}

	updateConfig(key: string, value: unknown): void {
		if (key === 'crossEye') {
			this.crossEye = value as boolean;
		}
		if (key === 'eyeSeparation') {
			this.eyeSeparation = value as number;
		}
	}
}
