import { env } from '$env/dynamic/private';
import { redirect, type Handle } from '@sveltejs/kit';

// LANDING_ONLY=true (set on the public deploy until the logged-in pages are ready):
// only the landing page is served. Every other page sends you back to it, and the
// API is closed. Static files (images, favicon) never reach this hook.
export const handle: Handle = async ({ event, resolve }) => {
	if (env.LANDING_ONLY === 'true' && event.url.pathname !== '/') {
		if (event.url.pathname.startsWith('/api/')) {
			return new Response('Not found', { status: 404 });
		}
		redirect(307, '/');
	}
	return resolve(event);
};
