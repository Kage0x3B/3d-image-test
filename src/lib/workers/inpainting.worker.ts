import type { InpaintingIncoming, InpaintingOutgoing } from './messages';

let miganSession: any = null;

self.onmessage = async (e: MessageEvent<InpaintingIncoming>) => {
	const msg = e.data;

	try {
		switch (msg.type) {
			case 'run-telea': {
				sendMsg({ type: 'progress', progress: 0, message: 'Running Telea inpainting...' });
				const { inpaintTelea } = await import('$lib/inpainting/telea');
				const result = inpaintTelea(msg.imageData, msg.width, msg.height, msg.mask, msg.radius);
				sendMsg({
					type: 'result',
					imageData: result,
					width: msg.width,
					height: msg.height
				}, [result.buffer]);
				break;
			}

			case 'load-migan': {
				sendMsg({ type: 'progress', progress: 0, message: 'Loading MI-GAN model (~28MB)...' });
				const { loadMiganSession } = await import('$lib/inpainting/migan');
				miganSession = await loadMiganSession();
				sendMsg({ type: 'migan-ready' });
				break;
			}

			case 'run-migan': {
				if (!miganSession) {
					sendMsg({ type: 'error', message: 'MI-GAN model not loaded' });
					return;
				}
				sendMsg({ type: 'progress', progress: 0, message: 'Running MI-GAN inpainting...' });
				const { runMigan } = await import('$lib/inpainting/migan');
				const result = await runMigan(miganSession, msg.imageData, msg.mask, msg.width, msg.height);
				sendMsg({
					type: 'result',
					imageData: result,
					width: msg.width,
					height: msg.height
				}, [result.buffer]);
				break;
			}
		}
	} catch (err) {
		sendMsg({
			type: 'error',
			message: err instanceof Error ? err.message : 'Unknown inpainting error'
		});
	}
};

function sendMsg(msg: InpaintingOutgoing, transfer?: Transferable[]) {
	(self as unknown as Worker).postMessage(msg, transfer ?? []);
}
