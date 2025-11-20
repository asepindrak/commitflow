// src/utils/session.ts
export async function initSession() {
    const existing = localStorage.getItem('session_token');
    if (existing) return existing;

    const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/init-session`, {
        method: 'POST',
    });
    const data = await res.json();

    localStorage.setItem('session_token', data.sessionToken);
    return data.sessionToken;
}