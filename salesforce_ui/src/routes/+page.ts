import type { PageLoad } from './$types';
export const prerender = true;

export const load: PageLoad = async ({ fetch }) => {
    const res = await fetch('/my-server-route.json');
    return await res.json();
};