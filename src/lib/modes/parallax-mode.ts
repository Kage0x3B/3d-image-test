import type { ViewingMode, ViewingModeConfig, AnimationPreset } from './types';
import type { SceneContext } from '../renderer/types';
import { fitCameraToImage } from '../renderer/scene-manager';
import { simplex2D } from '../util/simplex-noise';

const EPSILON = 1e-6;

interface AnimationTarget {
	tx: number;
	ty: number;
	tz?: number;
	fov?: number;
}

export class ParallaxMode implements ViewingMode {
	readonly id = 'parallax';
	readonly label = 'Parallax 3D';

	private ctx: SceneContext | null = null;
	private animationId: number | null = null;
	private targetX = 0;
	private targetY = 0;
	private currentX = 0;
	private currentY = 0;
	private prevCamX = NaN;
	private prevCamY = NaN;
	private autoAnimate = false;
	private animationSpeed = 0.8;
	private animationType: AnimationPreset = 'wiggle';
	private maxOffset = 0.08;
	private lerpFactor = 0.08;
	private dirty = true;
	private boundMouseMove: ((e: MouseEvent) => void) | null = null;
	private boundTouchMove: ((e: TouchEvent) => void) | null = null;
	private boundDeviceOrientation: ((e: DeviceOrientationEvent) => void) | null = null;
	private hasGyroscope = false;
	private baseZ = 2;
	private baseFov = 50;

	isAvailable(): boolean {
		return true;
	}

	activate(ctx: SceneContext, config: ViewingModeConfig): void {
		// Prevent double-activate: clean up any existing animation loop and listeners
		this.cleanupListeners();
		if (this.animationId !== null) {
			cancelAnimationFrame(this.animationId);
			this.animationId = null;
		}

		this.ctx = ctx;
		this.maxOffset = config.parallaxMaxOffset ?? 0.08;
		this.lerpFactor = config.parallaxSmoothing ?? 0.08;
		const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		this.autoAnimate = prefersReducedMotion ? false : (config.parallaxAutoAnimate ?? false);
		this.animationSpeed = config.parallaxAnimationSpeed ?? 0.8;
		this.animationType = config.parallaxAnimationType ?? 'wiggle';
		this.dirty = true;
		this.prevCamX = NaN;
		this.prevCamY = NaN;

		// Reset renderer state
		ctx.renderer.xr.enabled = false;
		ctx.renderer.setScissorTest(false);
		ctx.renderer.setViewport(0, 0, ctx.container.clientWidth, ctx.container.clientHeight);
		ctx.camera.aspect = ctx.container.clientWidth / ctx.container.clientHeight;
		ctx.camera.fov = 50;
		ctx.camera.updateProjectionMatrix();
		ctx.mesh.position.set(0, 0, 0);
		fitCameraToImage(ctx);

		// Store base values after fitCameraToImage sets them
		this.baseZ = ctx.camera.position.z;
		this.baseFov = ctx.camera.fov;

		// Mouse tracking
		this.boundMouseMove = (e: MouseEvent) => {
			const rect = ctx.container.getBoundingClientRect();
			this.targetX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
			this.targetY = ((e.clientY - rect.top) / rect.height) * 2 - 1;
			this.dirty = true;
		};
		ctx.container.addEventListener('mousemove', this.boundMouseMove);

		// Touch tracking
		this.boundTouchMove = (e: TouchEvent) => {
			const rect = ctx.container.getBoundingClientRect();
			const touch = e.touches[0];
			this.targetX = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
			this.targetY = ((touch.clientY - rect.top) / rect.height) * 2 - 1;
			this.dirty = true;
		};
		ctx.container.addEventListener('touchmove', this.boundTouchMove, { passive: true });

		// Gyroscope
		if (typeof DeviceOrientationEvent !== 'undefined') {
			this.boundDeviceOrientation = (e: DeviceOrientationEvent) => {
				if (e.gamma !== null && e.beta !== null) {
					this.targetX = e.gamma / 45;
					this.targetY = (e.beta - 45) / 45;
					this.hasGyroscope = true;
					this.dirty = true;
				}
			};
			window.addEventListener('deviceorientation', this.boundDeviceOrientation);
		}

		// Render loop
		const animate = () => {
			this.animationId = requestAnimationFrame(animate);
			if (!this.ctx) return;

			let tx: number, ty: number;
			let tz: number | undefined;
			let fov: number | undefined;

			if (this.autoAnimate && !this.hasGyroscope) {
				const target = this.computeAnimationTarget(performance.now() * 0.001);
				tx = target.tx;
				ty = target.ty;
				tz = target.tz;
				fov = target.fov;
				this.dirty = true;
			} else {
				tx = this.targetX;
				ty = this.targetY;
			}

			// Smooth interpolation
			this.currentX += (tx - this.currentX) * this.lerpFactor;
			this.currentY += (ty - this.currentY) * this.lerpFactor;

			const camX = this.currentX * this.maxOffset;
			const camY = -this.currentY * this.maxOffset;

			// Only render if camera position changed meaningfully
			if (this.dirty || Math.abs(camX - this.prevCamX) > EPSILON || Math.abs(camY - this.prevCamY) > EPSILON) {
				this.ctx.camera.position.x = camX;
				this.ctx.camera.position.y = camY;
				this.ctx.camera.position.z = tz ?? this.baseZ;

				if (fov !== undefined) {
					this.ctx.camera.fov = fov;
					this.ctx.camera.updateProjectionMatrix();
				}

				this.ctx.camera.lookAt(0, 0, 0);

				this.ctx.renderer.render(this.ctx.scene, this.ctx.camera);
				this.prevCamX = camX;
				this.prevCamY = camY;
				this.dirty = false;
			}
		};
		animate();
	}

	private computeAnimationTarget(t: number): AnimationTarget {
		const speed = this.animationSpeed;

		switch (this.animationType) {
			case 'orbit':
				return {
					tx: Math.cos(t * speed) * 0.7,
					ty: Math.sin(t * speed) * 0.7
				};

			case 'ken-burns': {
				// Slow XY drift via layered sine waves + gentle Z zoom
				const tx = Math.sin(t * speed * 0.4) * 0.3 + Math.sin(t * speed * 0.17) * 0.2;
				const ty = Math.cos(t * speed * 0.3) * 0.2 + Math.cos(t * speed * 0.13) * 0.15;
				const zoomPhase = Math.sin(t * speed * 0.2) * 0.5 + 0.5; // 0..1
				const tz = this.baseZ * (1 - zoomPhase * 0.15); // oscillate between baseZ and baseZ*0.85
				return { tx, ty, tz };
			}

			case 'dolly-zoom': {
				// Camera moves in Z while FOV counter-adjusts (Vertigo effect)
				const phase = Math.sin(t * speed * 0.5);
				const zRange = this.baseZ * 0.3;
				const newZ = this.baseZ + phase * zRange;
				// newFov = 2 * atan(tan(baseFov/2) * baseZ / newZ)
				const baseFovRad = (this.baseFov * Math.PI) / 180;
				const newFovRad = 2 * Math.atan(Math.tan(baseFovRad / 2) * this.baseZ / newZ);
				const newFov = (newFovRad * 180) / Math.PI;
				// Subtle XY sway
				const tx = Math.sin(t * speed * 0.3) * 0.15;
				const ty = Math.cos(t * speed * 0.2) * 0.1;
				return { tx, ty, tz: newZ, fov: newFov };
			}

			case 'random-drift':
				return {
					tx: simplex2D(t * speed * 0.3, 0) * 0.6,
					ty: simplex2D(0, t * speed * 0.3 + 100) * 0.4
				};

			case 'wiggle':
			default:
				return {
					tx: Math.sin(t * speed) * 0.6,
					ty: Math.cos(t * speed * 0.75) * 0.3
				};
		}
	}

	deactivate(): void {
		if (this.animationId !== null) {
			cancelAnimationFrame(this.animationId);
			this.animationId = null;
		}
		this.cleanupListeners();
		this.restoreCamera();
		this.hasGyroscope = false;
		this.ctx = null;
	}

	private restoreCamera(): void {
		if (!this.ctx) return;
		this.ctx.camera.fov = this.baseFov;
		this.ctx.camera.position.z = this.baseZ;
		this.ctx.camera.updateProjectionMatrix();
	}

	private cleanupListeners(): void {
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
	}

	updateConfig(key: string, value: unknown): void {
		if (key === 'autoAnimate') this.autoAnimate = value as boolean;
		if (key === 'animationSpeed') this.animationSpeed = value as number;
		if (key === 'animationType') {
			const prev = this.animationType;
			this.animationType = value as AnimationPreset;
			// Restore camera when leaving dolly-zoom or ken-burns
			if ((prev === 'dolly-zoom' || prev === 'ken-burns') && prev !== this.animationType) {
				this.restoreCamera();
			}
		}
		if (key === 'maxOffset') this.maxOffset = value as number;
		if (key === 'smoothing') this.lerpFactor = value as number;
		this.dirty = true;
	}
}
