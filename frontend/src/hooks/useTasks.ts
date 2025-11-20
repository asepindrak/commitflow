// frontend/src/hooks/useTasks.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../api/projectApi";
import { enqueueOp } from "../utils/offlineQueue";
import { toast } from "react-toastify";

export function useTasksQuery(projectId?: string) {
  return useQuery({
    queryKey: ["tasks", projectId ?? "all"],
    queryFn: async () => {
      if (projectId) {
        const tasks = await api.getTasks(projectId);
        return Array.isArray(tasks) ? tasks : [];
      } else {
        const state = await api.getState();
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
      onError: (err: any, payload: any) => {
        try {
          // ensure queued op contains clientId if present on payload
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
      onSettled: (_data: any, _err: any, payload: any) => {
        // Invalidate the specific project tasks cache (if projectId present), otherwise all
        const key = ["tasks", payload?.projectId ?? "all"];
        qc.invalidateQueries(key);
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
        await qc.cancelQueries(["tasks"]);
        const prev = qc.getQueryData(["tasks"]);
        qc.setQueryData(["tasks"], (old: any) =>
          old?.map((t: any) =>
            String(t.id) === String(id) ? { ...t, ...patch } : t
          )
        );
        return { prev };
      },
      onError: (err, vars, ctx: any) => {
        try {
          enqueueOp({
            op: "update_task",
            payload: vars,
            createdAt: new Date().toISOString(),
          });
        } catch (_) {
          console.warn("enqueue update_task failed");
        }
        toast.dark("Update queued (backend failed)");
        if (ctx?.prev) qc.setQueryData(["tasks"], ctx.prev);
      },
      onSettled: () => qc.invalidateQueries(["tasks"]),
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
      toast.dark("Delete queued (backend failed)");
      if (ctx?.prev) qc.setQueryData(["tasks"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries(["tasks"]),
  });
}
