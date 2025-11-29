/* eslint-disable no-empty */
// frontend/src/hooks/useTasks.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../api/projectApi";
import { enqueueOp } from "../utils/offlineQueue";
import { toast } from "react-toastify";

export function useTasksQuery(projectId: string, workspaceId: string) {
  return useQuery({
    queryKey: ["tasks", projectId ?? "all"],
    queryFn: async () => {
      if (projectId) {
        const tasks = await api.getTasks(projectId);

        return Array.isArray(tasks) ? tasks : [];
      } else if (workspaceId) {
        const state = await api.getState(workspaceId);
        return state?.tasks ?? [];
      }
    },
    staleTime: 1000 * 5,
    refetchOnWindowFocus: true,
  });
}

/**
 * useCreateTask
 * - No optimistic UI here (we let ProjectManagement.tsx manage local optimistic state)
 * - Ensures payload is forwarded (including clientId) and retry is disabled
 * - On error we enqueue the exact payload (including clientId if present)
 */
export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation(
    async (payload: any) => {
      // forward payload as-is so clientId (if provided) is sent to backend
      return api.createTask(payload);
    },
    {
      retry: 0, // important: prevent automatic retry causing duplicate creates

      // optimistic: apply new task to all tasks* query caches
      onMutate: async (payload: any) => {
        await qc.cancelQueries(["tasks"]);
        // snapshot all tasks* queries for rollback
        const prevEntries = qc.getQueriesData(["tasks"]);
        const prevMap = new Map<string, any>();
        for (const [qk, data] of prevEntries) {
          prevMap.set(JSON.stringify(qk), data);
        }

        // apply optimistic insertion to every tasks* query
        const optimisticTask = payload; // payload usually contains clientId as id
        for (const [qk, data] of prevEntries) {
          try {
            qc.setQueryData(qk, (old: any) =>
              Array.isArray(old) ? [optimisticTask, ...old] : old
            );
          } catch (e) {
            console.warn(
              "createTask optimistic setQueryData failed for",
              qk,
              e
            );
          }
        }

        return { prevMap, clientId: payload?.clientId ?? payload?.id ?? null };
      },

      onError: (err: any, payload: any, ctx: any) => {
        // rollback
        try {
          const prevEntries: [string, any][] = ctx?.prevMap ?? [];
          for (const [keyStr, data] of prevEntries) {
            const qk = JSON.parse(keyStr);
            qc.setQueryData(qk as any, data);
          }
        } catch (e) {
          console.warn("rollback createTask failed", e);
        }

        try {
          enqueueOp({
            op: "create_task",
            payload: payload,
            createdAt: new Date().toISOString(),
          });
        } catch (_) {
          console.warn("enqueue create_task failed");
        }
        toast.dark("Offline/Backend error — task queued to sync later");
      },

      onSuccess: (created: any, payload: any, ctx: any) => {
        // Replace any optimistic task that used clientId with server-created task
        const clientId = ctx?.clientId;
        // Update all tasks* queries: replace item with id === clientId -> created
        const prevEntries = qc.getQueriesData(["tasks"]);
        for (const [qk, data] of prevEntries) {
          try {
            qc.setQueryData(qk, (old: any) => {
              if (!Array.isArray(old)) return old;
              // replace first matching id
              let found = false;
              const next = old.map((t: any) => {
                if (
                  !found &&
                  (String(t.id) === String(clientId) ||
                    String(t.clientId) === String(clientId))
                ) {
                  found = true;
                  return created;
                }
                return t;
              });
              if (!found) {
                // if not found, prepend created (server canonical)
                return [created, ...old];
              }
              return next;
            });
          } catch (e) {
            console.warn("onSuccess update cache failed for", qk, e);
          }
        }
      },

      onSettled: (_data: any, _err: any, payload: any) => {
        // Invalidate all tasks queries so server and cache converge
        qc.invalidateQueries(["tasks"]);
      },
    }
  );
}

/**
 * useUpdateTask
 * - keeps optimistic update on cache (we update `["tasks"]`)
 * - enqueue on error
 */
export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation(
    (payload: { id: string; patch: any }) =>
      api.updateTaskApi(payload.id, payload.patch),
    {
      retry: 0,
      onMutate: async ({ id, patch }) => {
        // cancel any outstanding "tasks*" queries
        await qc.cancelQueries(["tasks"]);

        // capture previous snapshots for rollback (all tasks* queries)
        const prevEntries = qc.getQueriesData(["tasks"]); // array of [queryKey, data]
        const prevMap = new Map<string, any>();
        for (const [qk, data] of prevEntries) {
          prevMap.set(JSON.stringify(qk), data);
        }

        // Apply optimistic update but PRESERVE existing comments unless patch explicitly sets them
        for (const [qk, data] of prevEntries) {
          try {
            qc.setQueryData(qk, (old: any) =>
              Array.isArray(old)
                ? old.map((t: any) =>
                    String(t.id) === String(id)
                      ? {
                          ...t,
                          ...patch,
                          // preserve comments if patch doesn't include comments field
                          comments:
                            typeof patch.comments === "undefined"
                              ? t.comments
                              : patch.comments,
                        }
                      : t
                  )
                : old
            );
          } catch (e) {
            console.warn("optimistic setQueryData failed for", qk, e);
          }
        }

        return { prevMap: Array.from(prevMap.entries()) };
      },
      onError: (err, vars, ctx: any) => {
        // rollback each saved query entry
        try {
          const prevEntries: [string, any][] = ctx?.prevMap ?? [];
          for (const [keyStr, data] of prevEntries) {
            try {
              const qk = JSON.parse(keyStr);
              qc.setQueryData(qk as any, data);
            } catch (e) {
              console.warn("rollback setQueryData failed for", keyStr, e);
            }
          }
        } catch (e) {
          console.warn("rollback overall failed", e);
        }

        // enqueue fallback for offline
        try {
          enqueueOp({
            op: "update_task",
            payload: vars,
            createdAt: new Date().toISOString(),
          });
        } catch (_) {
          console.warn("enqueue update_task failed");
        }
      },

      onSuccess: (serverTask, vars, ctx) => {
        // Replace item in all tasks* queries with serverTask
        const prevEntries = qc.getQueriesData(["tasks"]);
        for (const [qk, data] of prevEntries) {
          try {
            qc.setQueryData(qk, (old: any) => {
              if (!Array.isArray(old)) return old;
              return old.map((t: any) =>
                String(t.id) === String(vars.id)
                  ? // Preserve comments if server didn't return them
                    {
                      ...serverTask,
                      comments: serverTask.comments ?? t.comments,
                    }
                  : t
              );
            });
          } catch (e) {
            console.warn("onSuccess update cache failed for", qk, e);
          }
        }

        // Also update single-task/detail cache if present
        try {
          qc.setQueryData(["task", vars.id], (old: any) => {
            if (!old) return serverTask;
            return {
              ...old,
              ...serverTask,
              comments: serverTask.comments ?? old.comments,
            };
          });
        } catch (_) {}
      },

      onSettled: () => {
        // invalidate tasks (you may prefer invalidating specific project key)
        qc.invalidateQueries(["tasks"]);
      },
    }
  );
}

/**
 * useDeleteTask
 */
export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation((id: string) => api.deleteTaskApi(id), {
    retry: 0,
    onMutate: async (id: string) => {
      await qc.cancelQueries(["tasks"]);
      const prev = qc.getQueryData(["tasks"]);
      qc.setQueryData(["tasks"], (old: any) =>
        old?.filter((t: any) => String(t.id) !== String(id))
      );
      return { prev };
    },
    onError: (err, id, ctx: any) => {
      try {
        enqueueOp({
          op: "delete_task",
          payload: { id },
          createdAt: new Date().toISOString(),
        });
      } catch (_) {
        console.warn("enqueue delete_task failed");
      }
      if (ctx?.prev) qc.setQueryData(["tasks"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries(["tasks"]),
  });
}
