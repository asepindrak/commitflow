import { apiFetch } from "./apiFetch";
import { markdownToText } from "./markdownToText";

const playTts = async (text: string) => {
    const plainText = markdownToText(text).slice(0, 200); // batasi 200 karakter
    if (!plainText) return;

    try {
        // pakai apiFetch agar token otomatis init/refresh
        const res = await apiFetch(`${import.meta.env.VITE_API_URL}/tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: plainText }),
        });

        if (!res.ok) {
            throw new Error(`TTS request failed (HTTP ${res.status})`);
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.volume = 0.4;
        audio.play().catch(() => console.warn('Autoplay blocked'));
    } catch (err) {
        console.error('TTS error:', err);
    }
};




export { playTts }
