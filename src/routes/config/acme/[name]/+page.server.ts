import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** Bearbeiten läuft nur noch über Modal auf /config/acme – Redirect. */
export const load: PageServerLoad = async () => {
	throw redirect(302, '/config/acme');
};
