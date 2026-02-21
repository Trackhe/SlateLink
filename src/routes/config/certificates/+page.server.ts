import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** Zertifikate und Stores sind auf einer Seite zusammengeführt. */
export const load: PageServerLoad = () => {
	throw redirect(302, '/config/crt-stores');
};
