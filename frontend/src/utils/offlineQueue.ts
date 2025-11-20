// frontend/src/utils/offlineQueue.ts
const Q_KEY = "cf_op_queue_v1";

export type OpType = {
  op:
    | "create_task"
    | "update_task"
    | "delete_task"
    | "create_project"
    | "update_project"
    | "delete_project"
    | "create_team"
    | "update_team"
    | "delete_team"
    | "create_comment";
  payload: any;
  createdAt: string;
  id?: string;
};

export function enqueueOp(op: OpType) {
  const raw = localStorage.getItem(Q_KEY);
  const arr: OpType[] = raw ? JSON.parse(raw) : [];
  arr.push(op);
  localStorage.setItem(Q_KEY, JSON.stringify(arr));
}

export function getQueue(): OpType[] {
  const raw = localStorage.getItem(Q_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function clearQueue() {
  localStorage.removeItem(Q_KEY);
}

export async function flushQueue(
  flushFn: (op: OpType) => Promise<void>,
  opts?: { batchSize?: number }
) {
  const q = getQueue();
  if (!q.length) return;
  const toProcess = q.slice(0, opts?.batchSize ?? 5);
  for (const op of toProcess) {
    try {
      await flushFn(op);
      // remove processed op
      const cur = getQueue();
      cur.shift();
      localStorage.setItem(Q_KEY, JSON.stringify(cur));
    } catch (err) {
      // stop on first error to avoid busy-loop; will retry later
      console.warn("flushQueue fail", err);
      return;
    }
  }
}
