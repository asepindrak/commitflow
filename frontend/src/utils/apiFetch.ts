import { useAuthStore } from "./store";

export async function apiFetch(url: string, options: RequestInit = {}) {
    const authStore: any = useAuthStore.getState();

    // pastikan punya token valid
    let token = authStore.token || (await authStore.initSession());

    // helper buat fetch dengan token
    const fetchWithToken = async (jwt: string) =>
        fetch(url, {
            ...options,
            headers: {
                ...(options.headers || {}),
                'Authorization': `Bearer ${jwt}`,
            },
        });
    let res = await fetchWithToken(token);

    // kalau backend kasih 401 (expired), refresh token
    if (res.status === 401) {
        console.warn('[apiFetch] Token expired, requesting new session...');
        token = await authStore.initSession();
        res = await fetchWithToken(token);
    }

    return res;
}
