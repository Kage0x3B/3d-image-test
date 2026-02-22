export interface VideoExportOptions {
	canvas: HTMLCanvasElement;
	durationMs: number;
	onProgress?: (progress: number) => void;
	onComplete?: (blob: Blob) => void;
}

export interface VideoExportHandle {
	stop(): void;
	readonly isRecording: boolean;
}

function pickMimeType(): string {
	if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) return 'video/webm;codecs=vp9';
	if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) return 'video/webm;codecs=vp8';
	if (MediaRecorder.isTypeSupported('video/mp4')) return 'video/mp4';
	return 'video/webm';
}

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

export function startVideoExport(opts: VideoExportOptions): VideoExportHandle {
	const { canvas, durationMs, onProgress, onComplete } = opts;

	const stream = canvas.captureStream(30);
	const mimeType = pickMimeType();
	const recorder = new MediaRecorder(stream, {
		mimeType,
		videoBitsPerSecond: 8_000_000
	});

	const chunks: Blob[] = [];
	let stopped = false;
	const startTime = performance.now();

	recorder.ondataavailable = (e) => {
		if (e.data.size > 0) chunks.push(e.data);
	};

	recorder.onstop = () => {
		const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
		const blob = new Blob(chunks, { type: mimeType });
		onComplete?.(blob);
		downloadBlob(blob, `3d-photo.${ext}`);
	};

	// Progress timer
	const progressInterval = setInterval(() => {
		const elapsed = performance.now() - startTime;
		const progress = Math.min(elapsed / durationMs, 1);
		onProgress?.(progress);
		if (progress >= 1 && !stopped) {
			handle.stop();
		}
	}, 100);

	recorder.start(100); // collect data every 100ms

	const handle: VideoExportHandle = {
		get isRecording() {
			return !stopped;
		},
		stop() {
			if (stopped) return;
			stopped = true;
			clearInterval(progressInterval);
			if (recorder.state !== 'inactive') {
				recorder.stop();
			}
			stream.getTracks().forEach((t) => t.stop());
		}
	};

	return handle;
}
