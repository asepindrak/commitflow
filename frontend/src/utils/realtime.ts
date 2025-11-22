// frontend/src/utils/realtime.ts
import { QueryClient } from "@tanstack/react-query";

type Getter = (() => string) | undefined;

export function createRealtimeSocket(
  qc: QueryClient,
  getActiveProjectId?: Getter,
  getActiveWorkspaceId?: Getter
) {
  const base = import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "";
  const wsUrl = base.replace(/^http/, "ws") + "/ws"; // sesuaikan endpoint di backend

  let ws: WebSocket | null = null;
  let attempts = 0;
  let shouldStop = false;

  const connect = () => {
    attempts++;
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("[WS] connected");
      attempts = 0;
    };

    ws.onmessage = (ev) => {
      try {
        const payload = JSON.parse(ev.data);
        // contoh payload: { type: 'task.updated', data: { id: 't1', ... } }
        if (!payload || typeof payload.type !== "string") return;

        // TASKS
        if (payload.type.startsWith("task.")) {
          const pid = getActiveProjectId?.();
          if (pid) {
            // prefer invalidating only tasks for the current project
            qc.invalidateQueries(["tasks", pid]);
          } else {
            // fallback: invalidate all "tasks" queries (non-exact)
            qc.invalidateQueries(["tasks"], { exact: false });
          }
          return;
        }

        // PROJECTS
        if (payload.type.startsWith("project.")) {
          const wid = getActiveWorkspaceId?.();
          if (wid) {
            qc.invalidateQueries(["projects", wid]);
          } else {
            qc.invalidateQueries(["projects"], { exact: false });
          }
          return;
        }

        // TEAM
        if (payload.type.startsWith("team.")) {
          const wid = getActiveWorkspaceId?.();
          if (wid) {
            qc.invalidateQueries(["team", wid]);
          } else {
            qc.invalidateQueries(["team"], { exact: false });
          }
          return;
        }

        // Generic: if other types come in, try broad invalidation as last resort
        qc.invalidateQueries({ exact: false });
      } catch (e) {
        console.warn("ws parse", e);
      }
    };

    ws.onclose = (ev) => {
      console.warn("[WS] closed", ev.reason || ev);
      if (shouldStop) return;
      // exponential backoff reconnect
      const delay = Math.min(30000, 500 * 2 ** Math.max(0, attempts - 1));
      console.log(`[WS] reconnecting in ${delay}ms (attempt ${attempts})`);
      setTimeout(() => connect(), delay);
    };

    ws.onerror = (e) => {
      console.warn("[WS] error", e);
      // error will be followed by close which triggers reconnect
    };
  };

  connect();

  return {
    close: () => {
      shouldStop = true;
      try {
        ws?.close();
      } catch (_) {
        /* ignore */
      }
    },
  };
}
