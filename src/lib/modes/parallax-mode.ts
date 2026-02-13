import type { ViewingMode, ViewingModeConfig } from './types';
import type { SceneContext } from '../renderer/types';
import { fitCameraToImage } from '../renderer/scene-manager';

export class ParallaxMode implements ViewingMode {
	readonly id = 'parallax';
	readonly label = 'Parallax 3D';

	private ctx: SceneContext | null = null;
	private animationId: number | null = null;
	private targetX = 0;
	private targetY = 0;
	private currentX = 0;
	private currentY = 0;
	private autoWiggle = false;
	private autoWiggleSpeed = 0.8;
	private maxOffset = 0.08;
	private lerpFactor = 0.08;
	private boundMouseMove: ((e: MouseEvent) => void) | null = null;
	private boundTouchMove: ((e: TouchEvent) => void) | null = null;
	private boundDeviceOrientation: ((e: DeviceOrientationEvent) => void) | null = null;
	private hasGyroscope = false;

	isAvailable(): boolean {
		return true;
	}

	activate(ctx: SceneContext, config: ViewingModeConfig): void {
		this.ctx = ctx;
		this.maxOffset = (config.parallaxMaxOffset as number) ?? 0.08;
		this.lerpFactor = (config.parallaxSmoothing as number) ?? 0.08;
		this.autoWiggle = (config.parallaxAutoWiggle as boolean) ?? false;
		this.autoWiggleSpeed = (config.parallaxAutoWiggleSpeed as number) ?? 0.8;

		// Reset renderer state
		ctx.renderer.xr.enabled = false;
		ctx.renderer.setScissorTest(false);
		ctx.renderer.setViewport(0, 0, ctx.container.clientWidth, ctx.container.clientHeight);
		ctx.camera.aspect = ctx.container.clientWidth / ctx.container.clientHeight;
		ctx.camera.updateProjectionMatrix();
		ctx.mesh.position.set(0, 0, 0);
		fitCameraToImage(ctx);

		// Mouse tracking
		this.boundMouseMove = (e: MouseEvent) => {
			const rect = ctx.container.getBoundingClientRect();
			this.targetX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
			this.targetY = ((e.clientY - rect.top) / rect.height) * 2 - 1;
		};
		ctx.container.addEventListener('mousemove', this.boundMouseMove);

		// Touch tracking
		this.boundTouchMove = (e: TouchEvent) => {
			const rect = ctx.container.getBoundingClientRect();
			const touch = e.touches[0];
			this.targetX = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
			this.targetY = ((touch.clientY - rect.top) / rect.height) * 2 - 1;
		};
		ctx.container.addEventListener('touchmove', this.boundTouchMove, { passive: true });

		// Gyroscope
		if (typeof DeviceOrientationEvent !== 'undefined') {
			this.boundDeviceOrientation = (e: DeviceOrientationEvent) => {
				if (e.gamma !== null && e.beta !== null) {
					this.targetX = e.gamma / 45;
					this.targetY = (e.beta - 45) / 45;
					this.hasGyroscope = true;
				}
			};
			window.addEventListener('deviceorientation', this.boundDeviceOrientation);
		}

		// Render loop
		const animate = () => {
			this.animationId = requestAnimationFrame(animate);
			if (!this.ctx) return;

			let tx: number, ty: number;

			if (this.autoWiggle && !this.hasGyroscope) {
				const t = performance.now() * 0.001;
				tx = Math.sin(t * this.autoWiggleSpeed) * 0.6;
				ty = Math.cos(t * this.autoWiggleSpeed * 0.75) * 0.3;
			} else {
				tx = this.targetX;
				ty = this.targetY;
			}

			// Smooth interpolation
			this.currentX += (tx - this.currentX) * this.lerpFactor;
			this.currentY += (ty - this.currentY) * this.lerpFactor;

			const baseZ = this.ctx.camera.position.z;
			this.ctx.camera.position.x = this.currentX * this.maxOffset;
			this.ctx.camera.position.y = -this.currentY * this.maxOffset;
			this.ctx.camera.position.z = baseZ;
			this.ctx.camera.lookAt(0, 0, 0);

			this.ctx.renderer.render(this.ctx.scene, this.ctx.camera);
		};
		animate();
	}

	deactivate(): void {
		if (this.animationId !== null) {
			cancelAnimationFrame(this.animationId);
			this.animationId = null;
		}
		if (this.boundMouseMove && this.ctx) {
			this.ctx.container.removeEventListener('mousemove', this.boundMouseMove);
		}
		if (this.boundTouchMove && this.ctx) {
			this.ctx.container.removeEventListener('touchmove', this.boundTouchMove);
		}
		if (this.boundDeviceOrientation) {
			window.removeEventListener('deviceorientation', this.boundDeviceOrientation);
		}
		this.boundMouseMove = null;
		this.boundTouchMove = null;
		this.boundDeviceOrientation = null;
		this.hasGyroscope = false;
		this.ctx = null;
	}

	updateConfig(key: string, value: unknown): void {
		if (key === 'autoWiggle') this.autoWiggle = value as boolean;
		if (key === 'autoWiggleSpeed') this.autoWiggleSpeed = value as number;
		if (key === 'maxOffset') this.maxOffset = value as number;
		if (key === 'smoothing') this.lerpFactor = value as number;
	}
}
