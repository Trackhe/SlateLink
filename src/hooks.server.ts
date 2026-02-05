import type { Handle } from '@sveltejs/kit';
import { startStatsSnapshotTimer } from '$lib/server/stats';

let statsTimerStarted = false;

export const handle: Handle = async ({ event, resolve }) => {
	if (!statsTimerStarted) {
		statsTimerStarted = true;
		startStatsSnapshotTimer();
	}
	return resolve(event);
};
