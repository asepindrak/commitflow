import React, { useEffect, useRef, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Sidebar from "./Sidebar";
import TaskModal from "./TaskModal";
import type { Project, Task, TeamMember } from "../types";
import { Sun, Moon, PlusCircle } from "lucide-react";
import TaskView from "./TaskView";
import ExportImportControls from "./ExportImportControls";
import { toast } from "react-toastify";
import Swal from "sweetalert2";

// imports from utilities you already created
import * as api from "../api/projectApi";
import { normalizeTeamInput } from "../utils/teamNormalize";
import { getQueue, enqueueOp } from "../utils/offlineQueue";
import { createRealtimeSocket } from "../utils/realtime";
import {
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useTasksQuery,
} from "../hooks/useTasks";
import { useAuthStore } from "../utils/store";
import EditProfileModal from "./EditProfileModal";

// Create local QueryClient so this component works even if app not wrapped globally
const queryClient = new QueryClient();

// small helper to normalize ids for safe comparisons
const nid = (x: any) =>
  typeof x === "undefined" || x === null ? "" : String(x);

export default function ProjectManagement() {
  // const seeded = seedIfEmpty();

  const initialTeam: TeamMember[] = normalizeTeamInput([]);
  const [team, setTeam] = useState<TeamMember[]>(() => initialTeam);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editMember, setEditMember] = useState<TeamMember | null>(null);
  const authTeamMemberId = useAuthStore((s) => s.teamMemberId);
  const teamMemberId = useAuthStore((s) => s.teamMemberId);
  const currentMember = team.find((t) => t.id === teamMemberId);
  const userPhoto = currentMember?.photo || null;

  const token = useAuthStore((s) => s.token);
  const userId = useAuthStore((s) => s.userId);
  const logout = useAuthStore((s) => s.logout);

  // ambil huruf pertama sebagai icon
  const userInitial = (userId?.[0] || "U").toUpperCase();

  // if we have an auth teamMemberId but no team loaded yet, fetch team so we can resolve assignee
  useEffect(() => {
    if (!authTeamMemberId) return;
    if (team && team.length > 0) return;

    let mounted = true;
    (async () => {
      try {
        const serverTeam = await api.getTeam();
        if (!mounted) return;
        const normalized = normalizeTeamInput(serverTeam || []);
        setTeam(normalized);
      } catch (err) {
        // ignore network error — we still support optimistic flows
        console.warn("failed to fetch team for resolve", err);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [authTeamMemberId, team.length]);

  const openEditProfile = async () => {
    setShowProfileMenu(false);

    // prefer local team lookup
    let member = authTeamMemberId
      ? team.find((t) => t.id === authTeamMemberId)
      : undefined;

    if (!member) {
      // If not found locally, try fetching server team and normalize
      try {
        const serverTeam = await api.getTeam();
        const normalized = normalizeTeamInput(serverTeam || []);
        setTeam(normalized);
        member = authTeamMemberId
          ? normalized.find((t) => t.id === authTeamMemberId)
          : undefined;
      } catch (err) {
        // ignore — still allow creating blank profile if none found
      }
    }

    setEditMember(member ?? null);
    setShowEditProfile(true);
  };

  const handleSaveProfile = async (updated: TeamMember) => {
    // optimistic update locally
    setTeam((prev) => {
      const map = new Map(prev.map((p) => [p.id, p]));
      map.set(updated.id, updated);
      return Array.from(map.values());
    });

    // try save to backend
    try {
      // updateTeamMember expects id + payload
      const payload = {
        name: updated.name,
        email: updated.email ?? null,
        role: updated.role ?? null,
        photo: updated.photo ?? null,
        phone: updated.phone ?? null,
        password: updated.password ?? null,
      };
      const saved = await api.updateTeamMember(updated.id, payload);
      // ensure local state reflects server canonical response
      setTeam((prev) => prev.map((t) => (t.id === saved.id ? saved : t)));
    } catch (err) {
      // fallback: queue op
      try {
        enqueueOp({
          op: "update_team",
          payload: { id: updated.id, patch: updated },
          createdAt: new Date().toISOString(),
        });
        toast.dark("Offline: profile update queued");
      } catch (_) {
        toast.dark("Failed to queue profile update");
      }
    }
  };

  const handleLogout = () => {
    logout();
    setShowProfileMenu(false);
    toast.info("Logged out");
  };

  useEffect(() => {
    const close = (e: MouseEvent) => {
      // kalau klik bukan pada profile button/dropdown
      if (!(e.target as HTMLElement).closest(".profile-menu-area")) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>(
    projects[0]?.id ?? ""
  );
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dark, setDark] = useState<boolean>(() => {
    try {
      // prefer stored user preference, otherwise use system preference
      const stored = localStorage.getItem("commitflow_theme");
      if (stored) return stored === "dark";
      return (
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
      );
    } catch (e) {
      return true;
    }
  });

  // prevent double-create clicks
  const [creatingTask, setCreatingTask] = useState(false);

  // React Query client for hooks that need it
  const qcRef = useRef(queryClient);

  // If you already export hooks, use them. If not, the hooks use qcRef internally.
  // We'll call our custom hooks which you said you've created.
  const tasksQuery = useTasksQuery(activeProjectId); // returns { data, isLoading, ... }
  const createTaskMutation = useCreateTask();
  const updateTaskMutation = useUpdateTask();
  const deleteTaskMutation = useDeleteTask();

  // Persist local copy for offline fallback while migrating:
  useEffect(() => {
    try {
      const snapshot = { projects, tasks, ui: { dark }, team };
      localStorage.setItem(
        "commitflow_local_snapshot",
        JSON.stringify(snapshot)
      );
    } catch (e) {
      console.warn("Failed to save local snapshot", e);
    }
  }, [projects, tasks, dark, team]);

  // On mount: load server state (projects, team) so UI reflects persisted data
  useEffect(() => {
    (async () => {
      try {
        const state = await api.getState();
        if (state) {
          if (Array.isArray(state.projects) && state.projects.length > 0) {
            setProjects(state.projects);
            // ensure active project selected
            setActiveProjectId((prev) => prev || state.projects[0].id || "");
          }
          if (Array.isArray(state.team) && state.team.length > 0) {
            setTeam(normalizeTeamInput(state.team));
          }
          // tasks are handled by useTasksQuery effect
        }
      } catch (e) {
        // ignore; offline or endpoint not available
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On mount: setup realtime socket + periodic queue flush
  useEffect(() => {
    const ws = createRealtimeSocket(qcRef.current);

    let intervalId: number | undefined;
    const attemptFlush = async () => {
      try {
        // custom flush so we can remap tmp_ ids returned by create ops to later queued ops
        const q = getQueue();
        if (!q.length) return;
        let processed = 0;
        while (processed < 6) {
          const curQueue = getQueue();
          if (!curQueue.length) break;
          const op = curQueue[0];
          try {
            if (op.op === "create_task") {
              const originalTmpId = op.payload?.id ?? op.payload?.clientId;
              const payload = { ...op.payload } as any;
              if (
                payload &&
                typeof payload.id === "string" &&
                payload.id.startsWith("tmp_")
              ) {
                payload.clientId = payload.id;
                delete payload.id;
              }
              const created = await api.createTask(payload);
              // remove processed op
              const cur = getQueue();
              cur.shift();
              localStorage.setItem("cf_op_queue_v1", JSON.stringify(cur));

              // remap any remaining queued ops that reference the tmp id to the new id
              if (originalTmpId && typeof created?.id === "string") {
                const remaining = getQueue();
                let changed = false;
                for (const rem of remaining) {
                  if (
                    rem.op === "update_task" &&
                    rem.payload &&
                    rem.payload.id === originalTmpId
                  ) {
                    rem.payload.id = created.id;
                    changed = true;
                  }
                  if (
                    rem.op === "delete_task" &&
                    rem.payload &&
                    rem.payload.id === originalTmpId
                  ) {
                    rem.payload.id = created.id;
                    changed = true;
                  }
                  if (
                    rem.op === "create_comment" &&
                    rem.payload &&
                    rem.payload.taskId === originalTmpId
                  ) {
                    rem.payload.taskId = created.id;
                    changed = true;
                  }
                }
                if (changed)
                  localStorage.setItem(
                    "cf_op_queue_v1",
                    JSON.stringify(remaining)
                  );
              }
            } else if (op.op === "update_task") {
              await api.updateTaskApi(op.payload.id, op.payload.patch);
              const cur = getQueue();
              cur.shift();
              localStorage.setItem("cf_op_queue_v1", JSON.stringify(cur));
            } else if (op.op === "delete_task") {
              await api.deleteTaskApi(op.payload.id);
              const cur = getQueue();
              cur.shift();
              localStorage.setItem("cf_op_queue_v1", JSON.stringify(cur));
            } else if (op.op === "create_project") {
              const originalTmpId = op.payload?.id ?? op.payload?.clientId;
              const payload = { ...op.payload } as any;
              if (
                payload &&
                typeof payload.id === "string" &&
                payload.id.startsWith("tmp_")
              ) {
                payload.clientId = payload.id;
                delete payload.id;
              }
              const created = await api.createProject(payload);
              const cur = getQueue();
              cur.shift();
              localStorage.setItem("cf_op_queue_v1", JSON.stringify(cur));

              // remap any remaining queued ops that reference the tmp project id to the new project id
              if (originalTmpId && typeof created?.id === "string") {
                const remaining = getQueue();
                let changed = false;
                for (const rem of remaining) {
                  if (rem.payload && rem.payload.projectId === originalTmpId) {
                    rem.payload.projectId = created.id;
                    changed = true;
                  }
                  if (
                    rem.op === "create_task" &&
                    rem.payload &&
                    rem.payload.projectId === originalTmpId
                  ) {
                    rem.payload.projectId = created.id;
                    changed = true;
                  }
                  if (
                    rem.op === "update_task" &&
                    rem.payload &&
                    rem.payload.patch &&
                    rem.payload.patch.projectId === originalTmpId
                  ) {
                    rem.payload.patch.projectId = created.id;
                    changed = true;
                  }
                }
                if (changed)
                  localStorage.setItem(
                    "cf_op_queue_v1",
                    JSON.stringify(remaining)
                  );
              }
            } else if (op.op === "update_project") {
              await api.updateProjectApi(op.payload.id, op.payload.patch);
              const cur = getQueue();
              cur.shift();
              localStorage.setItem("cf_op_queue_v1", JSON.stringify(cur));
            } else if (op.op === "delete_project") {
              await api.deleteProjectApi(op.payload.id);
              const cur = getQueue();
              cur.shift();
              localStorage.setItem("cf_op_queue_v1", JSON.stringify(cur));
            } else if (op.op === "create_team") {
              const originalTmpId = op.payload?.id ?? op.payload?.clientId;
              const payload = { ...op.payload } as any;
              if (
                payload &&
                typeof payload.id === "string" &&
                payload.id.startsWith("tmp_")
              ) {
                payload.clientId = payload.id;
                delete payload.id;
              }
              const created = await api.createTeamMember(payload);
              const cur = getQueue();
              cur.shift();
              localStorage.setItem("cf_op_queue_v1", JSON.stringify(cur));

              // remap remaining ops referencing tmp team member id (if any)
              if (originalTmpId && typeof created?.id === "string") {
                const remaining = getQueue();
                let changed = false;
                for (const rem of remaining) {
                  // update_task patches referencing assigneeId
                  if (
                    rem.op === "update_task" &&
                    rem.payload &&
                    rem.payload.patch &&
                    rem.payload.patch.assigneeId === originalTmpId
                  ) {
                    rem.payload.patch.assigneeId = created.id;
                    changed = true;
                  }
                }
                if (changed)
                  localStorage.setItem(
                    "cf_op_queue_v1",
                    JSON.stringify(remaining)
                  );
              }
            } else if (op.op === "delete_team") {
              await api.deleteTeamMember(op.payload.id);
              const cur = getQueue();
              cur.shift();
              localStorage.setItem("cf_op_queue_v1", JSON.stringify(cur));
            } else if (op.op === "create_comment") {
              await api.createComment(op.payload.taskId, {
                author: op.payload.author,
                body: op.payload.body,
                attachments: op.payload.attachments || [],
              });
              const cur = getQueue();
              cur.shift();
              localStorage.setItem("cf_op_queue_v1", JSON.stringify(cur));
            } else {
              console.warn("Unknown queued op", op);
              const cur = getQueue();
              cur.shift();
              localStorage.setItem("cf_op_queue_v1", JSON.stringify(cur));
            }
          } catch (err) {
            // stop on first failure to avoid busy-loop; will retry later
            console.warn("flushQueue op failed", err, op);
            return;
          }
          processed++;
        }

        qcRef.current.invalidateQueries(["tasks"]);
        qcRef.current.invalidateQueries(["projects"]);
        qcRef.current.invalidateQueries(["team"]);
      } catch (e) {
        // backend still down — will retry later
      }
    };

    // eslint-disable-next-line prefer-const
    intervalId = window.setInterval(attemptFlush, 7000);
    window.addEventListener("online", attemptFlush);

    attemptFlush().catch(() => {});

    return () => {
      if (ws && typeof ws.close === "function") ws.close();
      if (intervalId) clearInterval(intervalId);
      window.removeEventListener("online", attemptFlush);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply dark class to document root and persist preference
  useEffect(() => {
    try {
      const root = document.documentElement;
      if (dark) root.classList.add("dark");
      else root.classList.remove("dark");
      localStorage.setItem("commitflow_theme", dark ? "dark" : "light");
    } catch (e) {
      // ignore (best-effort)
    }
  }, [dark]);

  // Keep local UI state in sync with server query results when available
  useEffect(() => {
    if (tasksQuery.data && Array.isArray(tasksQuery.data)) {
      setTasks((localTasks) => {
        const serverTasks = tasksQuery.data as Task[];
        const tmp = localTasks.filter((t) => nid(t.id).startsWith("tmp_"));
        const others = localTasks.filter(
          (t) => t.projectId !== activeProjectId || nid(t.id).startsWith("tmp_")
        );
        const merged = [
          ...others.filter((o) => !nid(o.id).startsWith("tmp_")),
          ...serverTasks,
          ...tmp,
        ];
        const map = new Map<string, Task>();
        for (const t of merged) map.set(nid(t.id), t);
        return Array.from(map.values());
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasksQuery.data, activeProjectId]);

  // UI handlers using mutations (optimistic)
  async function handleAddTask(title: string) {
    // prevent double-clicks creating multiple optimistic items
    if (creatingTask) return;
    setCreatingTask(true);

    const optimistic: Task = {
      id: `tmp_${Math.random().toString(36).slice(2, 9)}`,
      title,
      status: "todo" as Task["status"],
      projectId: activeProjectId || null,
      comments: [],
      priority: "low" as Task["priority"],
      assigneeId: null as string | null,
      assigneeName: null as string | null,
      startDate: null as string | null,
      dueDate: null as string | null,
    };

    setTasks((s: any) => [optimistic, ...s]);
    setSelectedTask(optimistic);

    try {
      // do not send optimistic/temp id to server — let backend create canonical id
      const { id: _tmp, ...payload } = { ...optimistic, title } as any;
      const created = await createTaskMutation.mutateAsync({
        ...payload,
        clientId: optimistic.id,
      });

      // replace tmp with created and dedupe by normalized id
      setTasks((s) => {
        const replaced = s.map((t) =>
          nid(t.id) === nid(optimistic.id) ? created : t
        );
        const map = new Map<string, Task>();
        for (const t of replaced) map.set(nid(t.id), t);
        return Array.from(map.values());
      });

      // if the optimistic item is currently selected, replace selection with server-created task
      setSelectedTask((cur) =>
        cur && nid(cur.id) === nid(optimistic.id) ? created : cur
      );

      // ensure queries updated
      qcRef.current.invalidateQueries(["tasks"]);
      toast.dark("Task created");
    } catch (err) {
      console.error(
        "[handleAddTask] create failed:",
        err,
        "optimistic:",
        optimistic
      );
      // enqueue if mutation failed (offline)
      try {
        enqueueOp({
          op: "create_task",
          payload: { ...optimistic, clientId: optimistic.id },
          createdAt: new Date().toISOString(),
        });
      } catch (_) {
        /* best-effort */
      }
      toast.dark("Offline: task queued to sync");
    } finally {
      setCreatingTask(false);
    }
  }

  async function handleUpdateTask(updated: Task) {
    // immediate local replace (normalize id compare)
    setTasks((s) =>
      s.map((t) => (nid(t.id) === nid(updated.id) ? updated : t))
    );

    // If this task still has a temporary id, queue the update instead of sending to backend
    if (nid(updated.id).startsWith("tmp_")) {
      try {
        // queue patch with only allowed fields + client-side id
        const patchToQueue = {
          id: updated.id,
          patch: {
            title: updated.title,
            description: (updated as any).description ?? null,
            projectId: updated.projectId ?? null,
            status: updated.status ?? undefined,
            priority: (updated as any).priority ?? undefined,
            assigneeId: updated.assigneeId ?? null,
            startDate:
              (updated as any).startDate == null
                ? null
                : (updated as any).startDate instanceof Date
                ? (updated as any).startDate.toISOString()
                : String((updated as any).startDate),
            dueDate:
              (updated as any).dueDate == null
                ? null
                : (updated as any).dueDate instanceof Date
                ? (updated as any).dueDate.toISOString()
                : String((updated as any).dueDate),
          },
        };
        enqueueOp({
          op: "update_task",
          payload: patchToQueue,
          createdAt: new Date().toISOString(),
        });
      } catch (_) {
        console.log("handle update task enqueue failed");
      }
      toast.dark("Update queued (offline)");
      return;
    }

    try {
      // Build clean patch containing only allowed fields
      const patch: any = {};
      patch.title = updated.title;
      patch.description = (updated as any).description ?? undefined;
      patch.projectId = updated.projectId ?? undefined;
      patch.status = updated.status ?? undefined;
      patch.priority = (updated as any).priority ?? undefined;
      patch.assigneeId = updated.assigneeId ?? undefined;

      // Ensure dates are strings (ISO) or null/undefined
      if (typeof (updated as any).startDate !== "undefined") {
        patch.startDate =
          (updated as any).startDate === null
            ? null
            : (updated as any).startDate instanceof Date
            ? (updated as any).startDate.toISOString()
            : String((updated as any).startDate);
      }

      if (typeof (updated as any).dueDate !== "undefined") {
        patch.dueDate =
          (updated as any).dueDate === null
            ? null
            : (updated as any).dueDate instanceof Date
            ? (updated as any).dueDate.toISOString()
            : String((updated as any).dueDate);
      }

      await updateTaskMutation.mutateAsync({ id: updated.id, patch });
      toast.dark("Task updated");
    } catch (err) {
      try {
        enqueueOp({
          op: "update_task",
          payload: { id: updated.id, patch: updated },
          createdAt: new Date().toISOString(),
        });
      } catch (_) {
        console.log("handle update task failed");
      }
      toast.dark("Update queued (offline)");
    }
  }

  async function handleDeleteTask(id: string) {
    // simpan snapshot untuk rollback
    const prev = tasks;
    // remove locally immediately (optimistic)
    setTasks((s) => s.filter((t) => nid(t.id) !== nid(id)));

    try {
      // attempt remote delete via mutation
      await deleteTaskMutation.mutateAsync(id);

      // invalidate queries so server state refreshes
      try {
        qcRef.current.invalidateQueries(["tasks"]);
      } catch (e) {
        /* best-effort */
      }

      toast.dark("Task deleted");
    } catch (err) {
      // restore local list on failure
      setTasks(prev);

      // if offline or remote failed, queue op for later sync
      try {
        enqueueOp({
          op: "delete_task",
          payload: { id },
          createdAt: new Date().toISOString(),
        });
      } catch (_) {
        console.log("handle delete task failed");
      }
      toast.dark("Delete queued (offline)");
    } finally {
      // ensure modal/selection closed if the deleted task was selected
      setSelectedTask((cur) => (cur && nid(cur.id) === nid(id) ? null : cur));
    }
  }

  // Team operations (local optimistic + API call, fallback to queue)
  async function addTeamMember(newMember: TeamMember) {
    const m = {
      ...newMember,
      id: newMember.id || `tmp_${Math.random().toString(36).slice(2, 9)}`,
    };
    setTeam((s) => [...s, m]);
    try {
      const created = await api.createTeamMember({ ...m, clientId: m.id });
      // replace tmp id with server id if returned
      setTeam((prev) => prev.map((t) => (t.id === m.id ? created : t)));
      toast.dark(`${created.name} added`);
    } catch (err) {
      try {
        enqueueOp({
          op: "create_team",
          payload: { ...m, clientId: m.id },
          createdAt: new Date().toISOString(),
        });
      } catch (_) {
        console.log("add team failed");
      }
      toast.dark(`${m.name} queued to sync`);
    }
  }

  function removeTeamMember(idOrName: string) {
    Swal.fire({
      title: "Delete member?",
      text: `Member will be deleted.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#ef4444",
      background: "#111827",
      color: "#e5e7eb",
    }).then(async (result) => {
      if (!result.isConfirmed) return;
      const target = team.find((t) => t.id === idOrName || t.name === idOrName);
      if (!target) {
        toast.dark("Member not found");
        return;
      }
      const prevTeam = team;
      setTeam((s) =>
        s.filter((tm) => tm.id !== idOrName && tm.name !== idOrName)
      );
      setTasks((prev) =>
        prev.map((task) =>
          task.assigneeName === target.name
            ? { ...task, assigneeName: undefined, assigneeId: undefined }
            : task
        )
      );

      try {
        await api.deleteTeamMember(target.id);
        toast.dark("Member deleted");
      } catch (err) {
        try {
          enqueueOp({
            op: "delete_team",
            payload: { id: target.id },
            createdAt: new Date().toISOString(),
          });
        } catch (_) {
          console.log("remove team failed");
        }
        toast.dark("Member deletion queued (offline)");
      }
    });
  }

  const removeProject = (id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  function handleImport(payload: {
    projects?: Project[];
    tasks?: Task[];
    team?: string[];
  }) {
    if (payload.projects && payload.projects.length > 0) {
      setProjects((prev) => {
        const map = new Map(prev.map((p) => [p.id, p]));
        payload.projects!.forEach((p) => {
          if (!map.has(p.id)) map.set(p.id, p);
        });
        return Array.from(map.values());
      });
    }
    if (payload.tasks && payload.tasks.length > 0) {
      setTasks((prev) => {
        const map = new Map(prev.map((t) => [t.id, t]));
        payload.tasks!.forEach((t) => {
          if (!map.has(t.id)) map.set(t.id, t);
        });
        return Array.from(map.values());
      });
    }
    if (payload.team && payload.team.length > 0) {
      const normalized = normalizeTeamInput(payload.team);
      setTeam((prev) => {
        const exist = new Set(prev.map((p) => p.name.toLowerCase()));
        const toAdd = normalized.filter(
          (n) => !exist.has(n.name.toLowerCase())
        );
        return [...prev, ...toAdd];
      });
    }
    toast.dark("Imported data applied");
  }

  // Build columns for TaskView
  const projectTasks = tasks.filter(
    (t) => nid(t.projectId) === nid(activeProjectId)
  );
  const columns = [
    {
      key: "todo" as Task["status"],
      title: "Todo",
      items: projectTasks.filter((t) => t.status === "todo"),
    },
    {
      key: "inprogress" as Task["status"],
      title: "In Progress",
      items: projectTasks.filter((t) => t.status === "inprogress"),
    },
    {
      key: "done" as Task["status"],
      title: "Done",
      items: projectTasks.filter((t) => t.status === "done"),
    },
  ];

  // Render inside QueryClientProvider to ensure hooks work
  return (
    <QueryClientProvider client={qcRef.current}>
      <div className="fixed z-20 inset-0 flex bg-white dark:bg-gray-900 text-slate-900 dark:text-slate-100">
        <Sidebar
          projects={projects}
          activeProjectId={activeProjectId}
          setActiveProjectId={setActiveProjectId}
          addProject={(name) => {
            const p: Project = {
              id: `tmp_${Math.random().toString(36).slice(2, 9)}`,
              name,
            };
            setProjects((s) => [...s, p]);
            setActiveProjectId(p.id);

            api
              .createProject({ ...p, clientId: p.id })
              .then((created) => {
                setProjects((prev) =>
                  prev.map((pp) => (pp.id === p.id ? created : pp))
                );
                setTasks((prev) =>
                  prev.map((t) =>
                    t.projectId === p.id ? { ...t, projectId: created.id } : t
                  )
                );
                setActiveProjectId((cur) => (cur === p.id ? created.id : cur));
                toast.dark(`Project "${created.name}" created`);
              })
              .catch(() => {
                try {
                  enqueueOp({
                    op: "create_project",
                    payload: { ...p, clientId: p.id },
                    createdAt: new Date().toISOString(),
                  });
                } catch (err) {
                  console.log(err);
                }
                toast.dark("Project queued to sync");
              });
          }}
          team={team}
          removeTeamMember={(id) => removeTeamMember(id)}
          addTeamMember={(m) => addTeamMember(m)}
          removeProject={(id) => removeProject(id)}
        />

        <main className="flex-1 h-full overflow-auto">
          <div className="cf-main-container p-8 min-h-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">
                {projects.find((x) => x.id === activeProjectId)?.name || "—"}
              </h2>
              <div className="flex items-center gap-5">
                <button
                  onClick={() => handleAddTask("New Task")}
                  disabled={creatingTask}
                  className="group flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-sky-600 text-white text-sm font-medium shadow-sm hover:shadow-md active:scale-[0.98] transition-all duration-200 dark:from-sky-600 dark:to-sky-700"
                >
                  <PlusCircle
                    size={18}
                    className="transition-transform group-hover:rotate-90"
                  />
                  <span>{creatingTask ? "Adding..." : "New Task"}</span>
                </button>

                <ExportImportControls
                  projects={projects}
                  tasks={tasks}
                  team={team}
                  onImport={(payload: any) => {
                    // Projects: upsert by id, overwrite fields from import
                    if (payload.projects) {
                      setProjects((prev) => {
                        const map = new Map(prev.map((p) => [p.id, p]));
                        payload.projects.forEach((p: any) => {
                          if (!p.id) return;
                          const existing = map.get(p.id) ?? {};
                          // merge: prefer imported fields, fallback to existing ones
                          map.set(p.id, {
                            ...existing,
                            ...p,
                          });
                        });
                        return Array.from(map.values());
                      });
                    }

                    // Team: normalize incoming names -> TeamMember[] using existing ids if present
                    // We will create normalized list from payload.team (if it's string[] or objects),
                    // but also allow payload to include full team rows (id, name, role, email, photo).
                    if (payload.team) {
                      // payload.team might be string[] (names) or array of objects (rows) depending on importer
                      const incomingTeamObjs: TeamMember[] = (
                        payload.team || []
                      ).map((r: any) => {
                        if (typeof r === "string") {
                          return { id: "", name: r } as TeamMember;
                        }
                        // allow object rows exported earlier
                        return {
                          id: r.id ?? r.ID ?? "",
                          name: r.name ?? r.Name ?? r.username ?? "",
                          role: r.role ?? r.Role ?? null,
                          email: r.email ?? r.Email ?? null,
                          photo: r.photo ?? r.Photo ?? null,
                        } as TeamMember;
                      });

                      // normalize (your existing util) will fill ids for missing names if needed
                      const normalized = normalizeTeamInput(incomingTeamObjs);

                      setTeam((prev) => {
                        const byId = new Map(
                          prev.filter((p) => !!p.id).map((p) => [p.id, p])
                        );
                        const byNameLower = new Map(
                          prev.map((p) => [p.name.toLowerCase(), p])
                        );

                        for (const n of normalized) {
                          if (n.id && byId.has(n.id)) {
                            // update existing by id (overwrite fields)
                            const ex = byId.get(n.id)!;
                            byId.set(n.id, { ...ex, ...n });
                          } else if (
                            n.name &&
                            byNameLower.has(n.name.toLowerCase())
                          ) {
                            // update existing by name (no id)
                            const ex = byNameLower.get(n.name.toLowerCase())!;
                            // prefer existing id if present
                            const idToUse = ex.id || n.id || "";
                            const merged = { ...ex, ...n, id: idToUse };
                            if (idToUse) byId.set(idToUse, merged);
                            else byNameLower.set(n.name.toLowerCase(), merged);
                          } else {
                            // new entry: if it has id use byId, else push into byNameLower
                            if (n.id) byId.set(n.id, n);
                            else byNameLower.set(n.name.toLowerCase(), n);
                          }
                        }

                        // combine maps back into array, preserving existing order-ish (id map first then names)
                        const result: TeamMember[] = [];
                        for (const v of byId.values()) result.push(v);
                        for (const v of byNameLower.values()) {
                          // avoid duplicates (by name)
                          if (
                            !result.some(
                              (r) =>
                                r.name.toLowerCase() === v.name.toLowerCase()
                            )
                          )
                            result.push(v);
                        }
                        return result;
                      });
                    }

                    // Tasks: upsert by id and also normalize fields and resolve assigneeId if only assigneeName given
                    if (payload.tasks) {
                      setTasks((prev) => {
                        const map = new Map(prev.map((t) => [t.id, t]));
                        // create a quick map of current team (name->id) to help resolving assigneeName -> assigneeId
                        const teamByName = new Map(
                          team.map((m) => [m.name.toLowerCase(), m.id])
                        );
                        const teamById = new Map(team.map((m) => [m.id, m]));

                        payload.tasks.forEach((t: any) => {
                          if (!t.id) {
                            // If incoming task has no id, we skip (or you may choose to generate a local id)
                            return;
                          }

                          // normalize incoming fields
                          const normalized: any = {
                            ...t,
                            // normalize empty strings to null for optional fields you want null
                            assigneeId:
                              t.assigneeId === "" ? null : t.assigneeId ?? null,
                            assigneeName: t.assigneeName ?? t.assignee ?? null,
                            priority: t.priority ?? null,
                            startDate: t.startDate ?? null,
                            dueDate: t.dueDate ?? null,
                          };

                          // if assigneeId missing but assigneeName present, try to resolve using current team
                          if (
                            (!normalized.assigneeId ||
                              normalized.assigneeId === "") &&
                            normalized.assigneeName
                          ) {
                            const foundId = teamByName.get(
                              String(normalized.assigneeName).toLowerCase()
                            );
                            if (foundId) normalized.assigneeId = foundId;
                          }

                          // try to parse comments if they are JSON string (import/export roundtrip)
                          if (typeof t.comments === "string") {
                            try {
                              const parsed = JSON.parse(t.comments);
                              normalized.comments = Array.isArray(parsed)
                                ? parsed
                                : [];
                            } catch {
                              normalized.comments = [];
                            }
                          } else {
                            normalized.comments = t.comments ?? [];
                          }

                          const existing = map.get(t.id);
                          // merge: overwrite existing with incoming fields (incoming takes precedence)
                          map.set(t.id, { ...(existing ?? {}), ...normalized });
                        });

                        return Array.from(map.values());
                      });
                    }

                    toast.dark("Imported data applied");
                  }}
                />

                <button
                  onClick={() => setDark(!dark)}
                  className="p-2 rounded-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200"
                >
                  {dark ? (
                    <Moon className="w-4 h-4 text-sky-400" />
                  ) : (
                    <Sun className="w-4 h-4 text-amber-500" />
                  )}
                </button>

                {/* PROFILE ICON + DROPDOWN */}
                <div className="relative profile-menu-area">
                  <button
                    onClick={() => setShowProfileMenu((v) => !v)}
                    className="relative w-10 h-10 rounded-full overflow-hidden border border-white/20 shadow hover:opacity-90 transition"
                  >
                    {userPhoto ? (
                      <img
                        src={userPhoto}
                        alt="User"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-r from-purple-500 to-indigo-500 flex items-center justify-center">
                        <span className="font-semibold text-white text-sm">
                          {userInitial}
                        </span>
                      </div>
                    )}
                  </button>

                  {showProfileMenu && (
                    <div className="absolute right-0 mt-2 w-40 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-lg py-1 z-50">
                      <button
                        onClick={() => {
                          openEditProfile();
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-slate-900 dark:text-slate-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                      >
                        Edit Profile
                      </button>
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                      >
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <TaskView
              currentMemberId={authTeamMemberId}
              columns={columns}
              onDropTo={(status) => {
                if (!dragTaskId) return;
                setTasks((s) =>
                  s.map((t) =>
                    nid(t.id) === nid(dragTaskId) ? { ...t, status } : t
                  )
                );
                updateTaskMutation.mutate(
                  { id: dragTaskId, patch: { status } },
                  {
                    onError: () => {
                      try {
                        enqueueOp({
                          op: "update_task",
                          payload: { id: dragTaskId, patch: { status } },
                          createdAt: new Date().toISOString(),
                        });
                      } catch (_) {
                        console.log("update task failed");
                      }
                      toast.dark("Move queued (offline)");
                    },
                    onSettled: () => qcRef.current.invalidateQueries(["tasks"]),
                  }
                );
                setDragTaskId(null);
              }}
              onDragStart={(id) => setDragTaskId(id)}
              onSelectTask={(t) => setSelectedTask(t)}
              team={team}
            />

            {selectedTask && (
              <TaskModal
                projects={projects}
                activeProjectId={activeProjectId}
                currentMemberId={authTeamMemberId}
                task={selectedTask}
                onClose={() => setSelectedTask(null)}
                onSave={async (u) => {
                  console.log(u);
                  await handleUpdateTask(u);
                  setSelectedTask(u);
                }}
                onAddComment={async (author, body, attachments) => {
                  // optimistic add: create local comment with temp id
                  const tmpComment = {
                    id: `c_tmp_${Math.random().toString(36).slice(2, 9)}`,
                    author,
                    body,
                    createdAt: new Date().toISOString(),
                    attachments,
                  };
                  // update local tasks state
                  setTasks((s) =>
                    s.map((t) =>
                      nid(t.id) === nid(selectedTask.id)
                        ? {
                            ...t,
                            comments: [...(t.comments || []), tmpComment],
                          }
                        : t
                    )
                  );

                  // find latest task reference from local state (not stale selectedTask)
                  const latest =
                    tasks.find((t) => nid(t.id) === nid(selectedTask.id)) ||
                    selectedTask;

                  try {
                    // Attempt create via API
                    const created = await api.createComment(latest.id, {
                      author,
                      body,
                      attachments,
                    });
                    // replace tmpComment with server-created comment (if id differs)
                    setTasks((s) =>
                      s.map((t) => {
                        if (nid(t.id) !== nid(latest.id)) return t;
                        const cs = (t.comments || []).map((c) =>
                          c.id === tmpComment.id ? created : c
                        );
                        // if created is not in list (e.g. server returns full list or single comment), ensure it's present
                        const has = cs.some((c) => c.id === created.id);
                        return { ...t, comments: has ? cs : [...cs, created] };
                      })
                    );
                    toast.dark("Comment added");
                  } catch (err) {
                    // enqueue create_comment op for later syncing
                    try {
                      enqueueOp({
                        op: "create_comment",
                        payload: {
                          taskId: latest.id,
                          author,
                          body,
                          attachments,
                        },
                        createdAt: new Date().toISOString(),
                      });
                    } catch (_) {
                      console.log("create_comment failed");
                    }
                    toast.dark("Comment queued (offline)");
                  } finally {
                    // invalidate tasks query so when server back online it will refresh
                    qcRef.current.invalidateQueries(["tasks"]);
                  }
                }}
                team={team}
                dark={dark}
                onDelete={async (id: string) => {
                  // delegate ke handler (TaskModal expects a promise)
                  await handleDeleteTask(id);
                }}
              />
            )}
          </div>
        </main>
      </div>
      {/* EDIT PROFILE MODAL */}
      <EditProfileModal
        open={showEditProfile}
        onClose={() => setShowEditProfile(false)}
        member={editMember}
        onSave={handleSaveProfile}
        dark={dark}
      />
    </QueryClientProvider>
  );
}
