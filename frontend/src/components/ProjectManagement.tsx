import React, { useEffect, useRef, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Sidebar from "./Sidebar";
import TaskModal from "./TaskModal";
import type { Project, Task, TeamMember, Workspace } from "../types";
import {
  Sun,
  Moon,
  PlusCircle,
  VolumeX,
  Volume2,
  RefreshCw,
} from "lucide-react";
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
import { playSound } from "../utils/playSound";
import { getState, saveState } from "../utils/local";

// Create local QueryClient so this component works even if app not wrapped globally
const queryClient = new QueryClient();

// small helper to normalize ids for safe comparisons
const nid = (x: any) =>
  typeof x === "undefined" || x === null ? "" : String(x);

export default function ProjectManagement({
  isPlaySound,
  setIsPlaySound,
}: {
  isPlaySound: boolean;
  setIsPlaySound: (value: boolean) => void;
}) {
  const initialWorkspaceId = getState("workspaceId");
  const initialProjectId = getState("projectId");
  const setAuth = useAuthStore((s) => s.setAuth); // ambil setter dari store

  const [isLoaded, setIsLoaded] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [isRequestSync, setIsRequestSync] = useState(false);
  const initialTeam: TeamMember[] = normalizeTeamInput([]);
  const [team, setTeam] = useState<TeamMember[]>(() => initialTeam);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editMember, setEditMember] = useState<TeamMember | null>(null);
  const teamMemberId = useAuthStore((s) => s.teamMemberId);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>(
    initialProjectId ? initialProjectId : projects[0]?.id ?? ""
  );

  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(
    initialWorkspaceId ? initialWorkspaceId : workspaces[0]?.id ?? ""
  );
  const [lastActiveWorkspaceId, setLastActiveWorkspaceId] = useState<string>(
    initialWorkspaceId ? initialWorkspaceId : workspaces[0]?.id ?? ""
  );

  const rafRef = useRef<number | null>(null);
  const pendingPosRef = useRef<{ x: number; y: number; width: number } | null>(
    null
  );
  console.log(team);
  const currentMember = team.find((t) => t.id === teamMemberId);

  const token = useAuthStore((s) => s.token);
  const userId = useAuthStore((s) => s.userId);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  console.log(user);
  console.log(currentMember?.name);
  const userWorkspace = user?.members.filter(
    (item: any) => item.workspaceId === activeWorkspaceId
  );
  const userWorkspaceActive =
    userWorkspace.length > 0 ? userWorkspace[0] : user;
  console.log("userWorkspace", userWorkspaceActive);
  if (!userWorkspaceActive?.photo) {
    userWorkspaceActive.photo = user?.photo ?? null;
  }
  // ambil huruf pertama sebagai icon
  const userInitial = user?.name?.slice(0, 1) || "U".toUpperCase();
  const userPhoto = user?.photo
    ? user?.photo
    : userWorkspaceActive.photo || null;
  console.log(userInitial);

  const authTeamMemberId = userWorkspaceActive.id || null;
  useEffect(() => {
    if (!authTeamMemberId) return;
    if (team && team.length > 0) return;

    let mounted = true;
    (async () => {
      try {
        // prefer passing workspace id to server if available
        const serverTeam = await api.getTeam(activeWorkspaceId);
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
  }, [authTeamMemberId, team.length, activeWorkspaceId]);

  useEffect(() => {
    setTimeout(() => {
      setIsLoaded(true);
    }, 3000);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      playSound("/sounds/close.mp3", isPlaySound);
    }
    saveState("workspaceId", activeWorkspaceId);
  }, [activeWorkspaceId]);

  useEffect(() => {
    if (activeWorkspaceId === lastActiveWorkspaceId && isLoaded) {
      playSound("/sounds/close.mp3", isPlaySound);
    } else {
      setLastActiveWorkspaceId(activeWorkspaceId);
    }
    saveState("projectId", activeProjectId);
  }, [activeProjectId]);

  const onOffSound = () => {
    setIsPlaySound(!isPlaySound);
    playSound("/sounds/close.mp3", isPlaySound);
  };

  // move team-dependent logic after activeWorkspaceId is defined

  const openEditProfile = async () => {
    setShowProfileMenu(false);
    setEditMember(userWorkspaceActive ?? null);

    setShowEditProfile(true);
  };

  const handleSync = async () => {
    setSyncing(true);
    setIsRequestSync(!isRequestSync);
  };

  const handleSaveProfile = async (updated: TeamMember) => {
    setTeam((prev) => {
      const map = new Map(prev.map((p) => [p.id, p]));
      map.set(updated.id, updated);
      return Array.from(map.values());
    });

    try {
      const payload = {
        name: updated.name,
        email: updated.email ?? null,
        role: updated.role ?? null,
        photo: updated.photo ?? null,
        phone: updated.phone ?? null,
        password: updated.password ?? null,
      };
      const saved = await api.updateTeamMember(updated.id, payload);
      console.log("saved", token);
      console.log("saved", userId);

      setAuth({
        token: token ?? "",
        userId: userId ?? "",
        user: saved.user,
        teamMemberId: teamMemberId ?? null,
      });
      setTeam((prev) => prev.map((t) => (t.id === saved.id ? saved : t)));
      window.location.reload();
    } catch (err) {
      try {
        enqueueOp({
          op: "update_team",
          payload: { id: updated.id, patch: updated },
          createdAt: new Date().toISOString(),
        });
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
      if (!(e.target as HTMLElement).closest(".profile-menu-area")) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState<{
    x: number;
    y: number;
    width: number;
  }>({ x: 0, y: 0, width: 300 });
  const offsetRef = useRef<{ x: number; y: number; width: number }>({
    x: 0,
    y: 0,
    width: 300,
  });

  // panggil ini instead of onDragStart untuk pointer devices
  function startPointerDrag(
    id: string,
    clientX: number,
    clientY: number,
    el: HTMLElement | null,
    opts: { captureImmediately?: boolean } = {}
  ) {
    // set dragging id asap
    setDragTaskId(id);

    // compute rect (viewport coords)
    const rect = el?.getBoundingClientRect();
    const width = rect?.width ?? 300;

    // IMPORTANT: offsetRef uses client coords (viewport)
    offsetRef.current = {
      x: rect ? clientX - rect.left : 12,
      y: rect ? clientY - rect.top : 12,
      width,
    };

    // If we want preview to appear exactly on top of original card,
    // set dragPos to the card's top-left (viewport)
    const initial = {
      x: rect ? rect.left : clientX - offsetRef.current.x,
      y: rect ? rect.top : clientY - offsetRef.current.y,
      width,
    };
    setDragPos(initial);

    // Now attach pointermove/pointerup to track movement (RAF-batched)
    let localRaf: number | null = null;

    const onMove = (ev: PointerEvent) => {
      pendingPosRef.current = {
        x: ev.clientX - offsetRef.current.x,
        y: ev.clientY - offsetRef.current.y,
        width: offsetRef.current.width,
      };
      if (localRaf == null) {
        localRaf = window.requestAnimationFrame(() => {
          if (pendingPosRef.current) {
            setDragPos(pendingPosRef.current);
            pendingPosRef.current = null;
          }
          localRaf = null;
        });
      }
    };

    const onUp = (ev: PointerEvent) => {
      if (localRaf != null) {
        window.cancelAnimationFrame(localRaf);
        localRaf = null;
      }

      // perform hit-test/drop
      const els = document.elementsFromPoint(ev.clientX, ev.clientY);
      const dropEl = els.find((el) =>
        (el as HTMLElement).closest("[data-drop-key]")
      );
      const dropKeyEl = dropEl
        ? ((dropEl as HTMLElement).closest("[data-drop-key]") as HTMLElement)
        : null;
      const dropKey = dropKeyEl
        ? (dropKeyEl.dataset.dropKey as any)
        : undefined;

      if (dropKey) {
        // use the same update logic as onDropTo
        const idToUse = id;
        setTasks((s) =>
          s.map((t) =>
            nid(t.id) === nid(idToUse) ? { ...t, status: dropKey } : t
          )
        );
        updateTaskMutation.mutate(
          { id: idToUse, patch: { status: dropKey } },
          {
            onError: () => {
              try {
                enqueueOp({
                  op: "update_task",
                  payload: { id: idToUse, patch: { status: dropKey } },
                  createdAt: new Date().toISOString(),
                });
              } catch (e) {
                console.log(e);
              }
            },
            onSettled: () =>
              qcRef.current.invalidateQueries(["tasks", activeProjectId]),
          }
        );
      }

      // cleanup
      setDragTaskId(null);
      setDragPos({ x: 0, y: 0, width: 300 });
      offsetRef.current = { x: 0, y: 0, width: 300 };

      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    // attach listeners AFTER setting initial pos so preview immediately visible
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp, { once: true });
  }

  // dipassing ke KanbanBoard via TaskView
  function handleDragStart(e: React.DragEvent, id: string) {
    console.log("handleDragStart", id);
    setDragTaskId(id);

    try {
      e.dataTransfer?.setDragImage(new Image(), 0, 0);
      e.dataTransfer?.setData("text/plain", id);
      e.dataTransfer!.effectAllowed = "move";
    } catch (err) {
      console.log(err);
    }

    const el = e.currentTarget as HTMLElement;
    if (!el) return;
    const rect = el.getBoundingClientRect();

    // IMPORTANT: use client coords (viewport). DO NOT add window.scrollX/Y here.
    offsetRef.current = {
      x: e.clientX - rect.left, // clientX - rect.left (both viewport-based)
      y: e.clientY - rect.top,
      width: rect.width,
    };

    // store dragPos as viewport-based target (client coords minus offset)
    setDragPos({
      x: e.clientX - offsetRef.current.x, // equals rect.left
      y: e.clientY - offsetRef.current.y, // equals rect.top
      width: rect.width,
    });
  }

  // ensure rafRef and pendingPosRef are declared at top-level of component
  // const rafRef = useRef<number | null>(null);
  // const pendingPosRef = useRef<{ x:number;y:number;width:number } | null>(null);

  function handleDrag(e: React.DragEvent) {
    if (!dragTaskId) return;
    if (e.clientX === 0 && e.clientY === 0) return;

    // compute viewport-based target coords
    const next = {
      x: e.clientX - offsetRef.current.x,
      y: e.clientY - offsetRef.current.y,
      width: offsetRef.current.width,
    };

    pendingPosRef.current = next;

    if (rafRef.current == null) {
      rafRef.current = window.requestAnimationFrame(() => {
        const p = pendingPosRef.current;
        if (p) setDragPos(p);
        pendingPosRef.current = null;
        rafRef.current = null;
      });
    }
  }

  function handleDragEnd(_e: React.DragEvent) {
    if (rafRef.current != null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      pendingPosRef.current = null;
    }
    setDragTaskId(null);
    offsetRef.current = { x: 0, y: 0, width: 300 };
    setDragPos({ x: 0, y: 0, width: 300 });
  }

  const [dark, setDark] = useState<boolean>(() => {
    try {
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

  const [creatingTask, setCreatingTask] = useState(false);
  const qcRef = useRef(queryClient);

  const tasksQuery = useTasksQuery(
    activeProjectId ?? "",
    activeWorkspaceId ?? ""
  );
  const createTaskMutation = useCreateTask();
  const updateTaskMutation = useUpdateTask();
  const deleteTaskMutation = useDeleteTask();

  useEffect(() => {
    (async () => {
      try {
        const workspaces = await api.getWorkspaces();
        if (workspaces && workspaces.length > 0) {
          setWorkspaces(workspaces);
          setActiveWorkspaceId((prev) => prev || workspaces[0].id);
        }
      } catch (e) {
        console.log("get workspaces failed.");
      }
    })();
  }, []);

  useEffect(() => {
    try {
      const snapshot = { workspaces, projects, tasks, ui: { dark }, team };
      localStorage.setItem(
        "commitflow_local_snapshot",
        JSON.stringify(snapshot)
      );
    } catch (e) {
      console.warn("Failed to save local snapshot", e);
    }
  }, [workspaces, projects, tasks, dark, team]);

  useEffect(() => {
    (async () => {
      try {
        if (!activeWorkspaceId) return;
        const state = await api.getState(activeWorkspaceId);
        if (!state) return;

        if (Array.isArray(state.projects) && state.projects.length > 0) {
          setProjects(state.projects);
          setActiveProjectId((prev) => {
            if (prev && state.projects.some((p: any) => p.id === prev))
              return prev;
            return state.projects[0].id ?? "";
          });
        } else {
          setProjects([]);
          setActiveProjectId("");
        }

        if (Array.isArray(state.team) && state.team.length > 0) {
          setTeam(normalizeTeamInput(state.team));
        }
      } catch (e) {
        // ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspaceId]);

  // helper: tentukan apakah error itu unrecoverable (tidak perlu retry)
  function isUnrecoverableError(err: any) {
    // sesuaikan tergantung shape error dari projectApi (axios, fetch, custom)
    // contoh: axios: err?.response?.status
    const status = err?.response?.status ?? err?.status;
    const msg = (err?.message || "").toString();

    // treat 400/404 as unrecoverable by default (adjust to your API semantics)
    if (status === 400 || status === 404) return true;

    // match specific message text too (your log showed "Project not found")
    if (/project not found/i.test(msg)) return true;
    if (/task not found/i.test(msg)) return true;

    return false;
  }

  useEffect(() => {
    const prefix = (...args: any[]) =>
      console.log("[SYNC]", new Date().toISOString(), ...args);

    prefix("useEffect mounted", {
      activeProjectId,
      activeWorkspaceId,
      isRequestSync,
    });

    const wsHandle = createRealtimeSocket(
      qcRef.current,
      () => activeProjectId,
      () => activeWorkspaceId
    );

    prefix("websocket handle created", { wsHandleExists: !!wsHandle });

    let isFlushing = false;
    const attemptFlush = async () => {
      if (isFlushing) {
        prefix("attemptFlush skipped because another flush is running");
        return;
      }
      isFlushing = true;
      prefix("attemptFlush start", { activeProjectId, activeWorkspaceId });

      try {
        const rawQueue = getQueue();
        prefix("rawQueue read", { length: rawQueue?.length ?? 0, rawQueue });

        if (!rawQueue || !rawQueue.length) {
          prefix("queue empty - nothing to flush");
          return;
        }

        // local mutable copy
        const queue: any[] = [...rawQueue];

        setSyncing(true);
        prefix("setSyncing(true)");

        let processed = 0;
        const MAX_PER_RUN = 6;

        while (processed < MAX_PER_RUN && queue.length) {
          const op = queue[0];
          prefix("processing op", {
            index: processed,
            opType: op?.op,
            opSnapshot: op,
            currentActiveProjectId: activeProjectId,
            currentActiveWorkspaceId: activeWorkspaceId,
            queueLengthBefore: queue.length,
          });

          try {
            if (op.op === "create_task") {
              const originalTmpId = op.payload?.id ?? op.payload?.clientId;
              const payload = { ...op.payload } as any;

              prefix("create_task - before normalize", {
                originalTmpId,
                payload,
              });

              if (
                payload &&
                typeof payload.id === "string" &&
                payload.id.startsWith("tmp_")
              ) {
                payload.clientId = payload.id;
                delete payload.id;
                prefix("create_task - normalized tmp id -> clientId", {
                  payload,
                });
              }

              prefix("API createTask CALL start", { payload });
              const created = await api.createTask(payload);
              prefix("API createTask CALL success", { created });

              // remove first item from local queue
              queue.shift();
              processed++;

              prefix("create_task - update remaining refs start", {
                originalTmpId,
                remainingBefore: queue.length + 1,
              });

              if (originalTmpId && typeof created?.id === "string") {
                let changed = false;
                for (const rem of queue) {
                  if (
                    rem.op === "update_task" &&
                    rem.payload &&
                    rem.payload.id === originalTmpId
                  ) {
                    prefix("updating rem.update_task.id", { rem });
                    rem.payload.id = created.id;
                    changed = true;
                  }
                  if (
                    rem.op === "delete_task" &&
                    rem.payload &&
                    rem.payload.id === originalTmpId
                  ) {
                    prefix("updating rem.delete_task.id", { rem });
                    rem.payload.id = created.id;
                    changed = true;
                  }
                  if (
                    rem.op === "create_comment" &&
                    rem.payload &&
                    rem.payload.taskId === originalTmpId
                  ) {
                    prefix("updating rem.create_comment.taskId", { rem });
                    rem.payload.taskId = created.id;
                    changed = true;
                  }
                }
                prefix("create_task - update remaining refs done", { changed });
              }
            } else if (op.op === "update_task") {
              prefix("API updateTaskApi CALL start", {
                id: op.payload.id,
                patch: op.payload.patch,
              });
              await api.updateTaskApi(op.payload.id, op.payload.patch);
              prefix("API updateTaskApi CALL success", { id: op.payload.id });
              queue.shift();
              processed++;
            } else if (op.op === "delete_task") {
              prefix("API deleteTaskApi CALL start", { id: op.payload.id });
              await api.deleteTaskApi(op.payload.id);
              prefix("API deleteTaskApi CALL success", { id: op.payload.id });
              queue.shift();
              processed++;
            } else if (op.op === "create_project") {
              const originalTmpId = op.payload?.id ?? op.payload?.clientId;
              const payload = { ...op.payload } as any;

              prefix("create_project - before normalize", {
                originalTmpId,
                payload,
              });

              if (
                payload &&
                typeof payload.id === "string" &&
                payload.id.startsWith("tmp_")
              ) {
                payload.clientId = payload.id;
                delete payload.id;
                prefix("create_project - normalized tmp id -> clientId", {
                  payload,
                });
              }

              const workspaceIdToUse = payload.workspaceId ?? activeWorkspaceId;
              prefix("create_project - workspaceIdToUse computed", {
                workspaceIdToUse,
                activeWorkspaceId,
                payloadWorkspaceId: op.payload.workspaceId,
              });

              if (!workspaceIdToUse || typeof workspaceIdToUse !== "string") {
                console.warn(
                  "flushQueue: create_project missing workspaceId — skipping for now, will retry later",
                  op
                );
                prefix(
                  "create_project - MISSING workspaceId, will break and retry later",
                  { op }
                );
                // don't remove this op; break to retry later
                break;
              }

              payload.workspaceId = workspaceIdToUse;

              prefix("API createProject CALL start", { payload });
              const created = await api.createProject(payload);
              prefix("API createProject CALL success", { created });

              queue.shift();
              processed++;

              if (originalTmpId && typeof created?.id === "string") {
                for (const rem of queue) {
                  if (rem.payload && rem.payload.projectId === originalTmpId) {
                    prefix("updating rem.projectId -> created.id", { rem });
                    rem.payload.projectId = created.id;
                  }
                  if (
                    rem.op === "create_task" &&
                    rem.payload &&
                    rem.payload.projectId === originalTmpId
                  ) {
                    prefix("updating rem.create_task.projectId -> created.id", {
                      rem,
                    });
                    rem.payload.projectId = created.id;
                  }
                  if (
                    rem.op === "update_task" &&
                    rem.payload &&
                    rem.payload.patch &&
                    rem.payload.patch.projectId === originalTmpId
                  ) {
                    prefix(
                      "updating rem.update_task.patch.projectId -> created.id",
                      { rem }
                    );
                    rem.payload.patch.projectId = created.id;
                  }
                }
              }
            } else if (op.op === "update_project") {
              prefix("API updateProjectApi CALL start", {
                id: op.payload.id,
                patch: op.payload.patch,
              });
              await api.updateProjectApi(op.payload.id, op.payload.patch);
              prefix("API updateProjectApi success", { id: op.payload.id });
              queue.shift();
              processed++;
            } else if (op.op === "delete_project") {
              prefix("API deleteProjectApi CALL start", { id: op.payload.id });
              await api.deleteProjectApi(op.payload.id);
              prefix("API deleteProjectApi success", { id: op.payload.id });
              queue.shift();
              processed++;
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
                prefix("create_team - normalized tmp id -> clientId", {
                  payload,
                });
              }
              prefix("API createTeamMember CALL start", { payload });
              const created = await api.createTeamMember(payload);
              prefix("API createTeamMember success", { created });

              queue.shift();
              processed++;

              if (originalTmpId && typeof created?.id === "string") {
                for (const rem of queue) {
                  if (
                    rem.op === "update_task" &&
                    rem.payload &&
                    rem.payload.patch &&
                    rem.payload.patch.assigneeId === originalTmpId
                  ) {
                    prefix(
                      "updating rem.update_task.patch.assigneeId -> created.id",
                      { rem }
                    );
                    rem.payload.patch.assigneeId = created.id;
                  }
                }
              }
            } else if (op.op === "delete_team") {
              prefix("API deleteTeamMember CALL start", { id: op.payload.id });
              await api.deleteTeamMember(op.payload.id);
              prefix("API deleteTeamMember success", { id: op.payload.id });
              queue.shift();
              processed++;
            } else if (op.op === "create_comment") {
              prefix("API createComment CALL start", {
                taskId: op.payload.taskId,
                preview: { author: op.payload.author, body: op.payload.body },
              });
              await api.createComment(op.payload.taskId, {
                author: op.payload.author,
                body: op.payload.body,
                attachments: op.payload.attachments || [],
              });
              prefix("API createComment success", {
                taskId: op.payload.taskId,
              });
              queue.shift();
              processed++;
            } else {
              prefix("Unknown queued op - shifting and continuing", { op });
              queue.shift();
              processed++;
            }

            // Persist queue state after each successful op to localStorage to survive reloads/crashes
            localStorage.setItem("cf_op_queue_v1", JSON.stringify(queue));
            prefix("persisted queue to localStorage", {
              remaining: queue.length,
            });
          } catch (err: any) {
            // per-op failure (network/server).
            // Decide whether to retry later (network/server error) or drop op (unrecoverable)
            console.warn("flushQueue op failed (raw)", err, op);
            prefix("op failed", { err: err?.message || err, op });

            // attach and increment retryCount on the op (so we don't retry forever)
            op.__retryCount = (op.__retryCount || 0) + 1;

            const UNRECOVERABLE = isUnrecoverableError(err);

            if (UNRECOVERABLE) {
              // Remove the bad op — it won't succeed by retrying (e.g., project/task gone)
              prefix("op considered UNRECOVERABLE -> removing from queue", {
                op,
                reason: err?.message ?? err,
              });

              // shift it off the local queue and persist
              queue.shift();
              localStorage.setItem("cf_op_queue_v1", JSON.stringify(queue));

              // Optionally: push to a dead-letter store so user/admin can review
              try {
                const dlKey = "cf_op_queue_v1_dead";
                const dlRaw = localStorage.getItem(dlKey);
                const dlArr = dlRaw ? JSON.parse(dlRaw) : [];
                dlArr.push({
                  op,
                  error: err?.message ?? err,
                  timestamp: new Date().toISOString(),
                });
                localStorage.setItem(dlKey, JSON.stringify(dlArr));
              } catch (e) {
                console.warn("failed to write dead-letter", e);
              }

              // continue processing next op (don't break)
              continue;
            }

            // If recoverable, but retry count exceeded threshold -> move to dead-letter and continue
            const RETRY_LIMIT = 4;
            if (op.__retryCount >= RETRY_LIMIT) {
              prefix("op exceeded retry limit -> moving to dead-letter", {
                op,
                retryCount: op.__retryCount,
              });
              queue.shift();
              try {
                const dlKey = "cf_op_queue_v1_dead";
                const dlRaw = localStorage.getItem(dlKey);
                const dlArr = dlRaw ? JSON.parse(dlRaw) : [];
                dlArr.push({
                  op,
                  error: err?.message ?? err,
                  retryCount: op.__retryCount,
                  timestamp: new Date().toISOString(),
                });
                localStorage.setItem(dlKey, JSON.stringify(dlArr));
              } catch (e) {
                console.warn("failed to write dead-letter", e);
              }
              localStorage.setItem("cf_op_queue_v1", JSON.stringify(queue));
              continue;
            }

            // If recoverable and under retry limit, persist the incremented retryCount and break to retry later.
            prefix(
              "op recoverable -> persisting retryCount and will retry later",
              {
                op,
                retryCount: op.__retryCount,
              }
            );
            // persist current queue (with updated op.__retryCount)
            localStorage.setItem("cf_op_queue_v1", JSON.stringify(queue));
            // break out so we don't hammer API this run; next run will attempt again
            break;
          }
        } // end while

        // finished processing up to MAX_PER_RUN items
        prefix("syncing finish", {
          processed,
          remaining: queue.length,
        });

        // ensure remote cache invalidation if needed
        if (activeProjectId) {
          prefix("invalidateQueries tasks for activeProjectId", {
            activeProjectId,
          });
          qcRef.current.invalidateQueries(["tasks", activeProjectId]);
        } else {
          prefix("invalidateQueries tasks (all)");
          qcRef.current.invalidateQueries(["tasks"], { exact: false });
        }

        if (activeWorkspaceId) {
          prefix("invalidateQueries projects/team for activeWorkspaceId", {
            activeWorkspaceId,
          });
          qcRef.current.invalidateQueries(["projects", activeWorkspaceId]);
          qcRef.current.invalidateQueries(["team", activeWorkspaceId]);
        } else {
          prefix("invalidateQueries projects/team (all)");
          qcRef.current.invalidateQueries(["projects"], { exact: false });
          qcRef.current.invalidateQueries(["team"], { exact: false });
        }
      } catch (e) {
        console.error("attemptFlush top-level error", e);
        prefix("attemptFlush top-level error", e);
      } finally {
        isFlushing = false;
        prefix("isFlushing set false");
        // keep a short delay so UI shows the syncing state visibly (optional)
        setTimeout(() => {
          setSyncing(false);
          prefix("setSyncing(false)");
        }, 2000);
      }
    };

    const intervalId: number | undefined = window.setInterval(
      attemptFlush,
      7000
    );
    window.addEventListener("online", attemptFlush);

    prefix("attemptFlush scheduled and initial call", { intervalMs: 7000 });
    attemptFlush().catch((err) => {
      console.error("initial attemptFlush failed", err);
      prefix("initial attemptFlush catch", err);
    });

    return () => {
      prefix("useEffect cleanup start");
      try {
        wsHandle?.close();
        prefix("wsHandle closed");
      } catch (e) {
        console.warn("wsHandle close error", e);
        prefix("wsHandle close error", e);
      }
      if (intervalId) {
        clearInterval(intervalId);
        prefix("cleared interval", { intervalId });
      }
      window.removeEventListener("online", attemptFlush);
      prefix("removed online listener");
      prefix("useEffect cleanup done");
    };
  }, [activeProjectId, activeWorkspaceId, isRequestSync]);

  useEffect(() => {
    try {
      const root = document.documentElement;
      if (dark) root.classList.add("dark");
      else root.classList.remove("dark");
      localStorage.setItem("commitflow_theme", dark ? "dark" : "light");
    } catch (e) {
      // ignore
    }
  }, [dark]);

  useEffect(() => {
    if (tasksQuery.data && Array.isArray(tasksQuery.data)) {
      setTasks((localTasks) => {
        const serverTasks = tasksQuery.data as Task[];
        const tmp = localTasks.filter((t) => nid(t.id).startsWith("tmp_"));
        const others = localTasks.filter(
          (t) =>
            !nid(t.id).startsWith("tmp_") && t.projectId !== activeProjectId
        );
        const merged = [
          ...others,
          ...serverTasks,
          ...tmp.filter((t) => t.projectId === activeProjectId),
        ];
        const map = new Map<string, Task>();
        for (const t of merged) map.set(nid(t.id), t);
        return Array.from(map.values());
      });
    }
  }, [tasksQuery.data, activeProjectId]);

  async function handleAddTask(title: string) {
    if (!activeProjectId) {
      toast.dark("Select a project first");
      return;
    }
    if (creatingTask) return;
    setCreatingTask(true);
    playSound("/sounds/incoming.mp3", isPlaySound);
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
      const { id: _tmp, ...payload } = { ...optimistic, title } as any;
      const created = await createTaskMutation.mutateAsync({
        ...payload,
        clientId: optimistic.id,
      });

      setTasks((s) => {
        const replaced = s.map((t) =>
          nid(t.id) === nid(optimistic.id) ? created : t
        );
        const map = new Map<string, Task>();
        for (const t of replaced) map.set(nid(t.id), t);
        return Array.from(map.values());
      });

      setSelectedTask((cur) =>
        cur && nid(cur.id) === nid(optimistic.id) ? created : cur
      );

      qcRef.current.invalidateQueries(["tasks", activeProjectId]);
    } catch (err) {
      console.error(
        "[handleAddTask] create failed:",
        err,
        "optimistic:",
        optimistic
      );
      try {
        enqueueOp({
          op: "create_task",
          payload: { ...optimistic, clientId: optimistic.id },
          createdAt: new Date().toISOString(),
        });
      } catch (e) {
        console.log(e);
      }
    } finally {
      setCreatingTask(false);
    }
  }

  async function handleUpdateTask(updated: Task) {
    setTasks((s) =>
      s.map((t) => (nid(t.id) === nid(updated.id) ? updated : t))
    );

    if (nid(updated.id).startsWith("tmp_")) {
      try {
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
      return;
    }

    try {
      const patch: any = {};
      patch.title = updated.title;
      patch.description = (updated as any).description ?? undefined;
      patch.projectId = updated.projectId ?? undefined;
      patch.status = updated.status ?? undefined;
      patch.priority = (updated as any).priority ?? undefined;
      patch.assigneeId = updated.assigneeId ?? undefined;

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
    }
  }

  async function handleDeleteTask(id: string) {
    const prev = tasks;
    setTasks((s) => s.filter((t) => nid(t.id) !== nid(id)));

    try {
      await deleteTaskMutation.mutateAsync(id);
      try {
        qcRef.current.invalidateQueries(["tasks", activeProjectId]);
      } catch (e) {
        console.log(e);
      }
    } catch (err) {
      setTasks(prev);
      try {
        enqueueOp({
          op: "delete_task",
          payload: { id },
          createdAt: new Date().toISOString(),
        });
      } catch (_) {
        console.log("handle delete task failed");
      }
    } finally {
      setSelectedTask((cur) => (cur && nid(cur.id) === nid(id) ? null : cur));
    }
  }

  async function addTeamMember(newMember: TeamMember) {
    const m = {
      ...newMember,
      id: newMember.id || `tmp_${Math.random().toString(36).slice(2, 9)}`,
      workspaceId: activeWorkspaceId,
    };

    // optimistic add so UI updates immediately
    setTeam((s) => [...s, m]);

    try {
      const created = await api.createTeamMember({ ...m, clientId: m.id });
      console.log("createTeamMember returned:", created);

      // Merge created response with optimistic item so we don't lose fields
      const merged = { ...m, ...created };
      setTeam((prev) => prev.map((t) => (t.id === m.id ? merged : t)));

      // ensure canonical server state: re-fetch team for current workspace
      try {
        const serverTeam = await api.getTeam(activeWorkspaceId);
        setTeam(normalizeTeamInput(serverTeam || []));
      } catch (err) {
        // if fetch fails, at least keep optimistic merged state
        console.warn("Failed to refresh team after create", err);
      }
    } catch (err) {
      console.error("createTeamMember failed, enqueueing", err);
      try {
        enqueueOp({
          op: "create_team",
          payload: { ...m, clientId: m.id },
          createdAt: new Date().toISOString(),
        });
        // leave optimistic item in list — it will be reconciled by queue flush later
      } catch (_) {
        console.log("add team failed");
      }
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
      }
    });
  }

  const removeProject = (id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  async function handleImport(payload: {
    projects?: Project[];
    tasks?: Task[];
    team?: string[] | any[];
  }) {
    // helper
    const genTmpId = () => `tmp_${Math.random().toString(36).slice(2, 9)}`;

    // Normalize incoming team
    const incomingTeam: TeamMember[] = (payload.team || []).map((r: any) => {
      if (typeof r === "string") {
        return {
          id: "",
          clientId: undefined,
          userId: "",
          workspaceId: activeWorkspaceId || "",
          name: r,
          role: null,
          email: null,
          photo: null,
          phone: null,
          isTrash: false,
          createdAt: undefined,
          updatedAt: undefined,
        } as any;
      }
      return {
        id: r.id ?? r.ID ?? r.Id ?? "",
        clientId: r.clientId ?? r.clientid ?? undefined,
        userId: r.userId ?? r.userid ?? r.user ?? "",
        workspaceId:
          (activeWorkspaceId || r.workspaceId) ??
          r.workspaceid ??
          r.workspace ??
          "",
        name: r.name ?? r.Name ?? r.username ?? "",
        role: r.role ?? r.Role ?? null,
        email: r.email ?? r.Email ?? null,
        photo: r.photo ?? r.Photo ?? null,
        phone: r.phone ?? r.Phone ?? null,
        isTrash: typeof r.isTrash !== "undefined" ? Boolean(r.isTrash) : false,
        createdAt: r.createdAt ?? r.CreatedAt ?? undefined,
        updatedAt: r.updatedAt ?? r.UpdatedAt ?? undefined,
      } as TeamMember;
    });

    // Merge helper (prefer incoming fields, preserve prev ids if possible)
    const mergeTeam = (prev: TeamMember[], incoming: TeamMember[]) => {
      const byId = new Map(prev.filter((p) => !!p.id).map((p) => [p.id, p]));
      const byNameLower = new Map(prev.map((p) => [p.name.toLowerCase(), p]));
      for (const n of incoming) {
        if (!n.id) n.id = genTmpId();
        n.workspaceId = activeWorkspaceId; // force to active workspace
        const nameLower = (n.name ?? "").toLowerCase();
        if (n.id && byId.has(n.id)) {
          const ex = byId.get(n.id)!;
          byId.set(n.id, { ...ex, ...n });
        } else if (n.name && byNameLower.has(nameLower)) {
          const ex = byNameLower.get(nameLower)!;
          const idToUse = ex.id || n.id || genTmpId();
          const merged = { ...ex, ...n, id: idToUse };
          byId.set(idToUse, merged);
        } else {
          if (n.id) byId.set(n.id, n);
          else if (n.name) byNameLower.set(nameLower, n);
        }
      }
      const result: TeamMember[] = [];
      for (const v of byId.values()) result.push(v);
      for (const v of byNameLower.values()) {
        if (!result.some((r) => r.name.toLowerCase() === v.name.toLowerCase()))
          result.push(v);
      }
      return result;
    };

    // Merge incoming team with existing `team` state
    const mergedTeam = mergeTeam(team, incomingTeam);
    if ((incomingTeam || []).length > 0) {
      // optimistic show
      setTeam(mergedTeam);
    }

    // START parallel member creation (create all tmp members in parallel)
    // Collect members that need creation (id starts with tmp_ or blank)
    const membersToCreate = mergedTeam.filter(
      (m) => !m.id || nid(m.id).startsWith("tmp_")
    );
    // Build payloads
    const memberCreatePromises = membersToCreate.map((m) => {
      const clientId = nid(m.id).startsWith("tmp_") ? m.id : genTmpId();
      const payload = { ...m, clientId, workspaceId: activeWorkspaceId };
      // Return promise that resolves to { status, result, tmpId }
      return api
        .createTeamMember(payload)
        .then((created: any) => ({
          status: "fulfilled" as const,
          created,
          tmpId: clientId,
        }))
        .catch((err: any) => ({
          status: "rejected" as const,
          err,
          tmpId: clientId,
          payload,
        }));
    });

    // Wait parallel (non-blocking for tasks) but we need results to map assignees
    const memberResults = await Promise.allSettled(memberCreatePromises);
    // tmp -> server id map
    const tmpToServer = new Map<string, string>();
    // Apply successes: update team state replacing tmp entries with created ones
    const createdMembers: any[] = [];
    for (const r of memberResults) {
      if (r.status === "fulfilled") {
        const res = r.value;
        if (res.status === "fulfilled") {
          tmpToServer.set(res.tmpId, res.created.id);
          createdMembers.push(res.created);
        } else {
          // rejected during underlying createTeamMember call (promise resolved to object)
          const maybe = res as any;
          if (maybe.tmpId && maybe.payload) {
            // enqueue create_team for offline
            try {
              enqueueOp({
                op: "create_team",
                payload: maybe.payload,
                createdAt: new Date().toISOString(),
              });
            } catch (e) {
              console.warn("enqueue create_team failed", e);
            }
          }
        }
      } else {
        // promise itself failed unexpectedly; ignore but log
        console.warn("member creation promise failed unexpectedly", r);
      }
    }

    // If we have actual createdMembers, merge them into team state preferring server objects
    if (createdMembers.length > 0) {
      setTeam((prev) => {
        // replace tmp ids with server objects
        const map = new Map(prev.map((p) => [p.id, p]));
        for (const created of createdMembers) {
          // find any tmp entry matching clientId (we used clientId equal to tmpId)
          // Some servers return clientId in response; if so prefer lookup
          const foundKey = Array.from(map.keys()).find(
            (k) =>
              k === created.id ||
              map.get(k)?.id === created.id ||
              map.get(k)?.clientId === created.clientId
          );
          if (foundKey) {
            map.delete(foundKey);
          }
          map.set(created.id, created);
        }
        return Array.from(map.values());
      });
    }

    // Prepare name->id map from newest team (use tmp->server mapping for resolution)
    const liveTeamSnapshot = (mergedTeam || []).map((m) => ({ ...m }));
    for (const [tmp, real] of tmpToServer.entries()) {
      const idx = liveTeamSnapshot.findIndex((x) => nid(x.id) === nid(tmp));
      if (idx !== -1) liveTeamSnapshot[idx].id = real;
    }
    const nameToId = new Map(
      liveTeamSnapshot.map((m) => [m.name.toLowerCase(), m.id])
    );

    // Normalize incoming tasks and parse comments
    const parseComments = (raw: any) => {
      if (!raw) return [];
      if (Array.isArray(raw)) return raw;
      if (typeof raw === "string") {
        try {
          const p = JSON.parse(raw);
          return Array.isArray(p) ? p : [];
        } catch {
          return [];
        }
      }
      return [];
    };

    const incomingTasks: Task[] = (payload.tasks || []).map((r: any) => {
      const baseId = r.id ?? r.ID ?? r.Id ?? "";
      const id = baseId ? String(baseId) : genTmpId();
      return {
        id,
        clientId: undefined,
        projectId: (activeProjectId || r.projectId) ?? r.project ?? null,
        title: r.title ?? r.Title ?? "",
        description: r.description ?? r.Description ?? null,
        status: r.status ?? r.Status ?? "todo",
        assigneeId: r.assigneeId ?? r.assigneeid ?? r.assignee ?? null,
        assigneeName: r.assigneeName ?? r.assignee ?? null,
        priority: r.priority ?? r.Priority ?? null,
        startDate: r.startDate ?? r.StartDate ?? null,
        dueDate: r.dueDate ?? r.DueDate ?? null,
        comments: parseComments(r.comments ?? r.Comments ?? r.COMMENT ?? ""),
        createdAt: r.createdAt ?? r.CreatedAt ?? undefined,
        updatedAt: r.updatedAt ?? r.UpdatedAt ?? undefined,
      } as Task;
    });

    // Dedupe incoming tasks by signature and against existing tasks
    const makeSig = (t: {
      title?: string;
      projectId?: any;
      startDate?: any;
      dueDate?: any;
    }) =>
      `${(t.title || "").trim().toLowerCase()}|${nid(t.projectId)}|${nid(
        t.startDate
      )}|${nid(t.dueDate)}`;

    const existingSignatures = new Set(tasks.map((t) => makeSig(t)));

    const uniqueIncoming = incomingTasks.filter((t) => {
      const s = makeSig(t);
      if (!s || existingSignatures.has(s)) return false;
      existingSignatures.add(s); // avoid duplicates in incoming set itself
      return true;
    });

    if (uniqueIncoming.length === 0 && (incomingTeam || []).length === 0) {
      toast.dark("No new tasks or members to import.");
      return;
    }

    // Ensure all incoming tasks have tmp_ ids and map assignee to any real ids if available
    const preparedTasks = uniqueIncoming.map((t) => {
      const tmpId = nid(t.id).startsWith("tmp_") ? t.id : genTmpId();
      // resolve assigneeId by tmpToServer or name map
      let assigneeId = t.assigneeId ?? null;
      if (assigneeId && tmpToServer.has(assigneeId))
        assigneeId = tmpToServer.get(assigneeId)!;
      if ((!assigneeId || assigneeId === "") && t.assigneeName) {
        const found = nameToId.get(String(t.assigneeName).toLowerCase());
        if (found) assigneeId = found;
      }
      return {
        ...t,
        id: tmpId,
        projectId: activeProjectId,
        assigneeId,
      } as Task;
    });

    // Optimistic: insert prepared tasks to UI (avoid duplicates by signature)
    setTasks((prev) => {
      const prevSig = new Set(prev.map((p) => makeSig(p)));
      const toAdd = preparedTasks.filter((t) => {
        const s = makeSig(t);
        return !prevSig.has(s);
      });
      // Put new imported tasks at top
      return [...toAdd, ...prev];
    });

    // Create tasks in parallel (each with clientId = tmpId). Collect results.
    const taskCreatePromises = preparedTasks.map((t) => {
      const clientId = t.id;
      const payloadForServer: any = {
        ...t,
        clientId,
        id: undefined,
        // do not send comments array; will create comments separately
        comments: undefined,
        projectId: activeProjectId,
      };
      return api
        .createTask(payloadForServer)
        .then((created: any) => ({
          status: "fulfilled" as const,
          created,
          tmpId: clientId,
          comments: t.comments || [],
        }))
        .catch((err: any) => ({
          status: "rejected" as const,
          err,
          tmpId: clientId,
          payload: payloadForServer,
          comments: t.comments || [],
        }));
    });

    const taskResults = await Promise.allSettled(taskCreatePromises);

    // Collect successful creations and failures; record tmp->server mapping
    const createdTasks: any[] = [];
    const failedTasksForEnqueue: any[] = [];
    for (const r of taskResults) {
      if (r.status === "fulfilled") {
        const res = r.value;
        if (res.status === "fulfilled") {
          tmpToServer.set(res.tmpId, res.created.id);
          createdTasks.push(res);
        } else {
          // underlying promise returned rejected object
          const maybe = res as any;
          if (maybe.status === "rejected") {
            failedTasksForEnqueue.push(maybe);
          }
        }
      } else {
        console.warn("task creation promise failed unexpectedly", r);
      }
    }

    // Replace tmp tasks in state with created server tasks, and dedupe by signature/server id
    if (createdTasks.length > 0) {
      setTasks((prev) => {
        // build signature->task mapping but prefer server-created tasks
        const sigToTask = new Map<string, Task>();
        const idToTask = new Map<string, Task>();
        // first put previous tasks (we will overwrite tmp ones)
        for (const p of prev) {
          const pId = nid(p.id);
          const pSig = makeSig(p);
          if (!idToTask.has(pId)) idToTask.set(pId, p);
          if (!sigToTask.has(pSig)) sigToTask.set(pSig, p);
        }
        // replace tmp entries with created ones and remove signature duplicates
        for (const ct of createdTasks) {
          const created = ct.created;
          const tmpId = ct.tmpId;
          const sig = `${(created.title || "").trim().toLowerCase()}|${nid(
            created.projectId
          )}|${nid(created.startDate)}|${nid(created.dueDate)}`;
          // delete any existing entries that share signature but are not the created one
          if (sigToTask.has(sig)) {
            const collision = sigToTask.get(sig)!;
            if (nid(collision.id) !== nid(created.id)) {
              idToTask.delete(nid(collision.id));
            }
          }
          // delete tmp slot
          idToTask.delete(nid(tmpId));
          // set created
          idToTask.set(nid(created.id), created);
          sigToTask.set(sig, created);
        }
        // return array with created tasks first, then others (preserve previous order for others)
        const result: Task[] = [];
        // push created tasks (in same order as createdTasks)
        for (const ct of createdTasks) result.push(ct.created);
        for (const p of idToTask.values()) {
          if (!createdTasks.some((ct) => nid(ct.created.id) === nid(p.id)))
            result.push(p);
        }
        return result;
      });
    }

    // For created tasks, create comments in parallel per task
    const commentCreatePromises: Promise<any>[] = [];
    for (const ct of createdTasks) {
      const createdTask = ct.created;
      const commentsForTask = ct.comments || [];
      for (const c of commentsForTask) {
        const payload = {
          author: c.author ?? c.Author ?? "Imported",
          // eslint-disable-next-line no-constant-binary-expression
          body: c.body ?? c.Body ?? String(c) ?? "",
          attachments: c.attachments ?? c.Attachments ?? [],
        };
        const p = api
          .createComment(createdTask.id, payload)
          .then((createdComment: any) => ({
            status: "fulfilled" as const,
            createdComment,
            taskId: createdTask.id,
          }))
          .catch((err: any) => ({
            status: "rejected" as const,
            err,
            taskId: createdTask.id,
            payload,
          }));
        commentCreatePromises.push(p);
      }
    }

    const commentResults = await Promise.allSettled(commentCreatePromises);

    // Apply created comments to tasks state; enqueue failed ones
    const commentsGroupedByTask = new Map<string, any[]>();
    for (const r of commentResults) {
      if (r.status === "fulfilled") {
        const v = r.value;
        if (v.status === "fulfilled") {
          const arr = commentsGroupedByTask.get(v.taskId) ?? [];
          arr.push(v.createdComment);
          commentsGroupedByTask.set(v.taskId, arr);
        } else if (v.status === "rejected") {
          // enqueue
          try {
            enqueueOp({
              op: "create_comment",
              payload: { taskId: v.taskId, ...v.payload },
              createdAt: new Date().toISOString(),
            });
          } catch (e) {
            console.warn("enqueue create_comment failed", e);
          }
        }
      } else {
        console.warn("comment promise failed unexpectedly", r);
      }
    }

    // Merge created comments into tasks state
    if (commentsGroupedByTask.size > 0) {
      setTasks((prev) =>
        prev.map((t) => {
          const id = nid(t.id);
          if (commentsGroupedByTask.has(id)) {
            return {
              ...t,
              comments: [
                ...(t.comments || []),
                ...(commentsGroupedByTask.get(id) || []),
              ],
            };
          }
          return t;
        })
      );
    }

    // Enqueue failed task creates along with their comments (for tasks that failed creation)
    for (const f of failedTasksForEnqueue) {
      try {
        enqueueOp({
          op: "create_task",
          payload: f.payload,
          createdAt: new Date().toISOString(),
        });
        for (const c of f.comments || []) {
          enqueueOp({
            op: "create_comment",
            payload: {
              taskId: f.tmpId,
              author: c.author ?? "Imported",
              // eslint-disable-next-line no-constant-binary-expression
              body: c.body ?? String(c) ?? "",
              attachments: c.attachments ?? [],
            },
            createdAt: new Date().toISOString(),
          });
        }
      } catch (e) {
        console.warn("enqueue failed for task/comments", e);
      }
    }

    toast.dark(
      "Imported tasks & members applied (parallellized; syncing in background)"
    );
  }

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

  return (
    <QueryClientProvider client={qcRef.current}>
      <div className="fixed z-20 inset-0 flex bg-slate-100 dark:bg-gray-900 text-slate-900 dark:text-slate-100">
        <Sidebar
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          setActiveWorkspaceId={setActiveWorkspaceId}
          projects={projects}
          activeProjectId={activeProjectId}
          setActiveProjectId={setActiveProjectId}
          addProject={(payload: any) => {
            if (!activeWorkspaceId) {
              toast.dark("Select a workspace first");
              return;
            }
            const p: Project = {
              id: `tmp_${Math.random().toString(36).slice(2, 9)}`,
              name: payload.name,
              description: payload.description,
              workspaceId: activeWorkspaceId,
            };

            setProjects((s) => [...s, p]);
            setActiveProjectId(p.id);

            api
              .createProject({
                ...p,
                clientId: p.id,
                workspaceId: activeWorkspaceId,
              })
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
              })
              .catch(() => {
                try {
                  enqueueOp({
                    op: "create_project",
                    payload: {
                      ...p,
                      clientId: p.id,
                      workspaceId: activeWorkspaceId,
                    },
                    createdAt: new Date().toISOString(),
                  });
                } catch (err) {
                  console.log(err);
                }
              });
          }}
          team={team}
          removeTeamMember={(id) => removeTeamMember(id)}
          addTeamMember={(m) => addTeamMember(m)}
          removeProject={(id) => removeProject(id)}
          isPlaySound={isPlaySound}
        />

        <main className="flex-1 h-full overflow-auto">
          <div className="cf-main-container p-8 min-h-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-3xl font-extrabold bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400 bg-clip-text text-transparent">
                {projects.find((x) => x.id === activeProjectId)?.name || "—"}
              </h2>

              <div className="flex items-center gap-5">
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className={`
    relative inline-flex items-center gap-2 px-5 py-2.5
    rounded-2xl text-sm font-semibold backdrop-blur-md
    transition-all duration-300 
    ${
      syncing
        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
        : "bg-white/10 dark:bg-white/5 hover:bg-white/20 dark:hover:bg-white/10 border border-white/20 dark:border-white/10"
    }
    shadow-[0_4px_12px_rgba(0,0,0,0.1)]
    hover:shadow-[0_6px_16px_rgba(0,0,0,0.15)]
    active:scale-95
  `}
                >
                  {/* spinning icon */}
                  <RefreshCw
                    size={18}
                    className={`transition-transform ${
                      syncing
                        ? "animate-spin text-emerald-400"
                        : "group-hover:rotate-180 text-white/80"
                    }`}
                  />

                  {/* label */}
                  <span className={syncing ? "text-emerald-400" : "text-white"}>
                    {syncing ? "Syncing…" : "Sync"}
                  </span>

                  {/* glow indicator */}
                  {!syncing && (
                    <span className="absolute inset-0 rounded-2xl bg-emerald-500/20 opacity-0 group-hover:opacity-20 transition-opacity"></span>
                  )}

                  {/* small dot indicator when syncing */}
                  {syncing && (
                    <span className="absolute -top-1.5 -right-1.5 h-3 w-3 rounded-full bg-emerald-400 animate-ping"></span>
                  )}
                </button>
                <button
                  onClick={() => handleAddTask("New Task")}
                  disabled={creatingTask}
                  className="group inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
             bg-gradient-to-r from-sky-500 to-sky-600 text-white
             hover:from-sky-600 hover:to-sky-700
             active:scale-95 transition-all duration-300
             dark:from-sky-600 dark:to-sky-700 dark:hover:from-sky-700 dark:hover:to-sky-800"
                >
                  <PlusCircle
                    size={18}
                    className="transition-transform duration-300 group-hover:rotate-90"
                  />
                  <span>{creatingTask ? "Adding..." : "New Task"}</span>
                </button>

                <ExportImportControls
                  projects={projects}
                  tasks={tasks}
                  team={team}
                  onImport={(payload: any) => handleImport(payload)}
                />

                <button
                  onClick={() => setDark(!dark)}
                  className="p-2 rounded-full border border-gray-300 dark:border-gray-700 bg-slate-100 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200"
                >
                  {dark ? (
                    <Moon className="w-4 h-4 text-sky-400" />
                  ) : (
                    <Sun className="w-4 h-4 text-amber-500" />
                  )}
                </button>
                <button
                  onClick={onOffSound}
                  className="py-1 px-2 rounded-sm ml-2 hover:bg-[#334155] transition"
                >
                  {!isPlaySound ? (
                    <VolumeX className="w-5 h-5 text-gray-300" />
                  ) : (
                    <Volume2 className="w-5 h-5 text-cyan-400" />
                  )}
                </button>
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
                    <div className="absolute right-0 mt-2 w-40 rounded-lg bg-slate-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-lg py-1 z-50">
                      <button
                        onClick={() => {
                          openEditProfile();
                        }}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-blue-400 hover:text-white text-slate-900 dark:text-slate-100 dark:hover:bg-gray-800 transition"
                      >
                        Edit Profile
                      </button>
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-blue-400 hover:text-white text-slate-900 dark:text-slate-100 dark:hover:bg-gray-800 transition"
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
              onDropTo={(status, draggedId) => {
                const idToUse = draggedId ?? dragTaskId;
                if (!idToUse) {
                  console.warn("drop ignored — no dragged id");
                  return;
                }

                // lakukan update lokal + API menggunakan idToUse
                setTasks((s) =>
                  s.map((t) =>
                    nid(t.id) === nid(idToUse) ? { ...t, status } : t
                  )
                );

                updateTaskMutation.mutate(
                  { id: idToUse, patch: { status } },
                  {
                    onError: () => {
                      try {
                        enqueueOp({
                          op: "update_task",
                          payload: { id: idToUse, patch: { status } },
                          createdAt: new Date().toISOString(),
                        });
                      } catch (_) {
                        console.log("update task failed");
                      }
                    },
                    onSettled: () =>
                      qcRef.current.invalidateQueries([
                        "tasks",
                        activeProjectId,
                      ]),
                  }
                );

                // reset drag state
                setDragTaskId(null);
              }}
              onDragStart={handleDragStart}
              onDrag={handleDrag}
              onDragEnd={handleDragEnd}
              dragPos={dragPos}
              dragTaskId={dragTaskId}
              onSelectTask={(t) => setSelectedTask(t)}
              team={team}
              startPointerDrag={startPointerDrag}
            />

            {selectedTask && (
              <TaskModal
                projects={projects}
                activeProjectId={activeProjectId}
                currentMemberId={authTeamMemberId}
                task={selectedTask}
                onClose={() => {
                  playSound("/sounds/close.mp3", isPlaySound);
                  setSelectedTask(null);
                }}
                onSave={async (u) => {
                  await handleUpdateTask(u);
                  setSelectedTask(null);
                }}
                onAddComment={async (author, body, attachments) => {
                  const tmpComment = {
                    id: `c_tmp_${Math.random().toString(36).slice(2, 9)}`,
                    author,
                    body,
                    createdAt: new Date().toISOString(),
                    attachments,
                  };

                  setTasks((s) =>
                    s.map((t) =>
                      nid(t.id) === nid(selectedTask!.id)
                        ? {
                            ...t,
                            comments: [...(t.comments || []), tmpComment],
                          }
                        : t
                    )
                  );

                  playSound("/sounds/send.mp3", isPlaySound);

                  const latest =
                    tasks.find((t) => nid(t.id) === nid(selectedTask!.id)) ||
                    selectedTask!;

                  try {
                    const created = await api.createComment(latest.id, {
                      author,
                      body,
                      attachments,
                    });
                    setTasks((s) =>
                      s.map((t) => {
                        if (nid(t.id) !== nid(latest.id)) return t;
                        const cs = (t.comments || []).map((c) =>
                          c.id === tmpComment.id ? created : c
                        );
                        const has = cs.some((c) => c.id === created.id);
                        return { ...t, comments: has ? cs : [...cs, created] };
                      })
                    );
                  } catch (err) {
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
                  } finally {
                    qcRef.current.invalidateQueries(["tasks", activeProjectId]);
                  }
                }}
                team={team}
                dark={dark}
                onDelete={async (id: string) => {
                  await handleDeleteTask(id);
                }}
              />
            )}
          </div>
        </main>
      </div>

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
