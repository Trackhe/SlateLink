import type { Handle } from '@sveltejs/kit';
import { startStatsSnapshotTimer } from '$lib/server/stats';
import { startCertSyncScheduler } from '$lib/server/certificates-sync';

let statsTimerStarted = false;
let certSyncStarted = false;

export const handle: Handle = async ({ event, resolve }) => {
	if (!statsTimerStarted) {
		statsTimerStarted = true;
		startStatsSnapshotTimer();
	}
	if (!certSyncStarted) {
		certSyncStarted = true;
		startCertSyncScheduler();
	}
	return resolve(event);
};
