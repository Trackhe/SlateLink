import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** Alle Store-Inhalte werden auf /config/crt-stores angezeigt – Redirect. */
export const load: PageServerLoad = async () => {
	throw redirect(302, '/config/crt-stores');
};
