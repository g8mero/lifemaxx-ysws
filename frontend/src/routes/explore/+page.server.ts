import { error } from '@sveltejs/kit';

// Explore is hidden for now: the page and its section in home/+page.svelte are kept, but the
// URL 404s. To bring it back, restore `export { load } from '../home/+page.server';` and
// uncomment the nav item in home/+page.svelte.
export const load = () => error(404, 'Not Found');
