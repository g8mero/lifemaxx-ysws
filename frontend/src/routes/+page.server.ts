import { env } from '$env/dynamic/private';
import { getAuthenticatedUser } from '$lib/server/auth';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies }) => {
	// Landing-only deploy: no login, no backend call (see hooks.server.ts).
	if (env.LANDING_ONLY === 'true') return { authenticated: false, landingOnly: true };

	const user = await getAuthenticatedUser(cookies);
	if (!user) return { authenticated: false, landingOnly: false };
	redirect(302, '/home');
};
