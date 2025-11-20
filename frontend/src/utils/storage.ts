// frontend/src/utils/storage.ts
import type { Project, Task, TeamMember } from '../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Storage helpers (load / save / seed)
 * - Migration friendly: accepts previously-saved `team` as array of strings and converts to TeamMember[]
 * - Persists team as full objects (id, name, phone?, email?, role?, photo?)
 */

export const STORAGE_KEY = 'commitflow_demo_v1';



/** loadState: parse localStorage and migrate old team formats */
export function loadState() {
    // localStorage.removeItem('commitflow_demo_v1')
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);


        // If parsed.team is array of objects, ensure each has an id (for safety)
        if (parsed && Array.isArray(parsed.team) && parsed.team.length > 0 && typeof parsed.team[0] === 'object') {
            parsed.team = (parsed.team as any[]).map((m: any, idx: number) => ({
                id: m?.id || `tm_${idx}_${Math.random().toString(36).slice(2, 6)}`,
                name: m?.name || '',
                phone: m?.phone,
                email: m?.email,
                role: m?.role,
                photo: m?.photo,
            }));
        }

        return parsed;
    } catch (e) {
        console.error('[storage] loadState parse error', e);
        return null;
    }
}

/** saveState: persist full team objects (so photo, email etc. remain) */
export function saveState(state: any) {
    try {
        const toSave = {
            ...state,
            // normalize team if present
            team: Array.isArray(state.team)
                ? (state.team as TeamMember[]).map((m) => ({
                    id: m.id || uuidv4(),
                    name: m.name,
                    phone: m.phone,
                    email: m.email,
                    role: m.role,
                    photo: m.photo,
                }))
                : state.team,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) {
        console.error('[storage] saveState failed', e);
    }
}
