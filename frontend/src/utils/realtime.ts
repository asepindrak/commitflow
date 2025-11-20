// frontend/src/utils/realtime.ts
import { QueryClient } from '@tanstack/react-query';
export function createRealtimeSocket(qc: QueryClient) {
    const base = import.meta.env.VITE_API_URL?.replace(/\/$/, '') ?? '';
    const wsUrl = base.replace(/^http/, 'ws') + '/ws'; // sesuaikan endpoint di backend
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => console.log('[WS] connected');
    ws.onmessage = (ev) => {
        try {
            const payload = JSON.parse(ev.data);
            // contoh payload: { type: 'task.updated', data: { id: 't1', ... } }
            if (payload?.type?.startsWith('task.')) {
                qc.invalidateQueries(['tasks']);
            } else if (payload?.type?.startsWith('project.')) {
                qc.invalidateQueries(['projects']);
            } else if (payload?.type?.startsWith('team.')) {
                qc.invalidateQueries(['team']);
            }
        } catch (e) { console.warn('ws parse', e); }
    };
    ws.onclose = () => {
        console.warn('[WS] closed, will not auto reconnect here (add backoff reconnect if needed)');
        // optionally attempt reconnect
    };
    ws.onerror = (e) => console.warn('[WS] error', e);
    return ws;
}
