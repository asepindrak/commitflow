/* eslint-disable no-empty */
// frontend/src/hooks/useTasks.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../api/projectApi";
import { enqueueOp } from "../utils/offlineQueue";
import { toast } from "react-toastify";
import { getMyTasks, getReportTasks } from "../api/projectApi";

export function useTasksQuery(
  projectId: string,
  workspaceId: string,
  startDate?: string,
  endDate?: string,
) {
  return useQuery({
    queryKey: ["tasks", projectId ?? "all", startDate ?? null, endDate ?? null],
    queryFn: async () => {
      if (projectId) {
        const tasks = await api.getTasks(projectId, startDate, endDate);

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
 * - Manages optimistic UI by inserting task into React Query cache
 * - On success, replaces the optimistic task with server-returned task
 * - On error, enqueues to offline queue
 */
export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation(
    async (payload: any) => {
      // Clean payload: remove temporary IDs or fields the server might not want
      const cleanPayload = { ...payload };
      if (
        typeof cleanPayload.id === "string" &&
        cleanPayload.id.startsWith("tmp_")
      ) {
        cleanPayload.clientId = cleanPayload.id;
        delete cleanPayload.id;
      }

      const result = await api.createTask(cleanPayload);
      return result;
    },
    {
      retry: 0,
      onMutate: async (payload: any) => {
        await qc.cancelQueries(["tasks"]);
        const prevEntries = qc.getQueriesData(["tasks"]);

        const optimisticTask = {
          ...payload,
          id:
            payload.id ||
            payload.clientId ||
            `tmp_${Math.random().toString(36).slice(2, 9)}`,
        };

        for (const [qk, oldData] of prevEntries) {
          if (Array.isArray(oldData)) {
            qc.setQueryData(qk, [optimisticTask, ...oldData]);
          }
        }

        return {
          prevEntries,
          clientId: payload?.clientId ?? payload?.id ?? null,
        };
      },
      onSuccess: (data: any, payload: any, context: any) => {
        const clientId = context?.clientId || payload?.clientId || payload?.id;
        console.log("[useCreateTask] onSuccess", {
          clientId,
          dataId: data?.id,
        });
        if (clientId && data?.id) {
          qc.setQueriesData(["tasks"], (old: any) => {
            if (!Array.isArray(old)) return old;
            return old.map((t) =>
              String(t.id) === String(clientId) ||
              String((t as any).clientId) === String(clientId)
                ? { ...data, clientId }
                : t,
            );
          });
        }
      },
      onError: (err: any, payload: any, context: any) => {
        // rollback
        if (context?.prevEntries) {
          for (const [qk, data] of context.prevEntries) {
            qc.setQueryData(qk, data);
          }
        }

        try {
          enqueueOp({
            op: "create_task",
            payload: payload,
            createdAt: new Date().toISOString(),
          });
        } catch (_) {}
        toast.dark("Offline/Backend error — task queued to sync later");
      },
      onSettled: () => {
        qc.invalidateQueries(["tasks"]);
      },
    },
  );
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation(
    async ({ id, patch }: { id: string; patch: any }) => {
      const result = await api.patchTaskApi(id, patch);
      return result;
    },
    {
      onSettled: (data, err, variables) => {
        qc.invalidateQueries(["tasks"]);
        if (variables.id) qc.invalidateQueries(["task", variables.id]);
      },
    },
  );
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation(
    async (id: string) => {
      await api.deleteTaskApi(id);
      return id;
    },
    {
      onSettled: () => {
        qc.invalidateQueries(["tasks"]);
      },
    },
  );
}

export function useMyTasks(
  memberId?: string,
  workspaceId?: string,
  startDate?: string,
  endDate?: string,
) {
  return useQuery({
    queryKey: ["my-tasks", memberId, workspaceId, startDate, endDate],
    queryFn: async () => {
      if (!memberId || !workspaceId) return [];
      return await getMyTasks(memberId, workspaceId, startDate, endDate);
    },
    enabled: !!memberId && !!workspaceId,
  });
}

export function useReportTasks(
  workspaceId?: string,
  memberId?: string,
  startDate?: string,
  endDate?: string,
) {
  return useQuery({
    queryKey: ["report-tasks", workspaceId, memberId, startDate, endDate],
    queryFn: async () => {
      if (!workspaceId) return [];
      return await getReportTasks(workspaceId, memberId, startDate, endDate);
    },
    enabled: !!workspaceId,
  });
}
