/* eslint-disable no-constant-binary-expression */
/* eslint-disable no-empty */
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
import { useAuthStore, useStoreWorkspace } from "../utils/store";
import EditProfileModal from "./EditProfileModal";
import { playSound } from "../utils/playSound";
import { getState, saveState } from "../utils/local";
import EditMemberModal from "./EditMemberModal";
import InviteLinkModal from "./InviteLinkModal";

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
  const [showEditMember, setShowEditMember] = useState(false);
  const [showInviteLink, setShowInviteLink] = useState(false);
  const [editMember, setEditMember] = useState<TeamMember | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [inviteLink, setInviteLink] = useState<string>("");

  const { workspaceId, setWorkspaceId, projectId, setProjectId } =
    useStoreWorkspace();

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

  const token = useAuthStore((s) => s.token);
  const userId = useAuthStore((s) => s.userId);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const userWorkspace = team.filter(
    (item: any) =>
      item.workspaceId === activeWorkspaceId && item.userId === userId
  );

  const userWorkspaceActive =
    userWorkspace.length > 0 ? userWorkspace[0] : user ? user : {};

  // alert(userWorkspaceActive.isAdmin);
  const isAdmin = userWorkspaceActive?.isAdmin ?? false;
  if (!userWorkspaceActive?.photo) {
    userWorkspaceActive.photo = user?.photo ?? null;
  }
  // ambil huruf pertama sebagai icon
  const userInitial = user?.name?.slice(0, 1) || "U".toUpperCase();
  const userPhoto = user?.photo
    ? user?.photo
    : userWorkspaceActive.photo || null;

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
    setWorkspaceId(activeWorkspaceId);
  }, [activeWorkspaceId]);

  useEffect(() => {
    if (activeWorkspaceId === lastActiveWorkspaceId && isLoaded) {
      playSound("/sounds/close.mp3", isPlaySound);
    } else {
      setLastActiveWorkspaceId(activeWorkspaceId);
    }
    saveState("projectId", activeProjectId);
    setProjectId(activeProjectId);
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

  const openEditProfileTeam = async (member: any) => {
    setShowProfileMenu(false);
    setEditMember(member ?? null);

    setShowEditMember(true);
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

      setAuth({
        token: token ?? "",
        userId: userId ?? "",
        user: saved.user,
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

  const handleSaveMember = async (updated: TeamMember) => {
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
        isAdmin: updated.isAdmin ?? false,
      };
      const saved = await api.updateTeamMember(updated.id, payload);

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
  // pastikan rafRef & pendingPosRef di top-level
  // const rafRef = useRef<number | null>(null);
  // const pendingPosRef = useRef<{x:number;y:number;width:number}|null>(null);

  function findTransformAncestors(el: HTMLElement | null) {
    const bad: Array<{
      el: HTMLElement;
      style: string;
      computed: CSSStyleDeclaration;
    }> = [];
    let cur: HTMLElement | null = el;
    while (cur && cur !== document.documentElement) {
      try {
        const style = getComputedStyle(cur);
        if (
          (style.transform && style.transform !== "none") ||
          (style.filter && style.filter !== "none") ||
          (style.perspective && style.perspective !== "none") ||
          (style.willChange &&
            /\b(transform|top|left|right|bottom)\b/.test(style.willChange)) ||
          (style.zoom && style.zoom !== "1")
        ) {
          bad.push({
            el: cur,
            style:
              style.transform ||
              style.filter ||
              style.perspective ||
              style.zoom,
            computed: style,
          });
        }
      } catch (err) {
        // ignore cross-origin or weird nodes
      }
      cur = cur.parentElement;
    }
    return bad;
  }

  // helper: find drop column key and insertion index (0..n) based on client coords
  function findDropTargetAndIndex(clientX: number, clientY: number) {
    // list of elements from point (topmost first)
    const els = document.elementsFromPoint(clientX, clientY);

    // 1) try to find a card element under pointer
    const cardEl = els.find(
      (el) =>
        (el as HTMLElement).closest &&
        (el as HTMLElement).closest("[data-task-id]")
    );
    let dropKeyEl: HTMLElement | null = null;
    let insertBeforeTaskId: string | null = null;
    let insertIndex: number | null = null;
    let columnEl: HTMLElement | null = null;

    if (cardEl) {
      // get the actual card container (closest with data-task-id)
      const cardContainer = (cardEl as HTMLElement).closest(
        "[data-task-id]"
      ) as HTMLElement | null;
      if (cardContainer) {
        const targetTaskId =
          cardContainer.dataset.taskId ??
          (cardContainer.id
            ? cardContainer.id.replace(/^taskcard-/, "")
            : undefined);

        // find column that contains this card
        columnEl = cardContainer.closest(
          "[data-drop-key]"
        ) as HTMLElement | null;
        dropKeyEl = columnEl;

        // measure card rect to decide above/below
        const rect = cardContainer.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;

        if (clientY <= midY) {
          // insert before this card
          insertBeforeTaskId = targetTaskId ?? null;
        } else {
          // insert after: we will compute index as (indexOf(target)+1)
          insertBeforeTaskId = null;
          // we'll find insertIndex by locating the position after target
          // but to keep simple API, we'll compute insertIndex by scanning column children below
        }
      }
    }

    // 2) if no card directly under pointer, find column element (empty area, end of column)
    if (!dropKeyEl) {
      const col = els.find(
        (el) =>
          (el as HTMLElement).closest &&
          (el as HTMLElement).closest("[data-drop-key]")
      );
      columnEl = (col as HTMLElement)?.closest?.(
        "[data-drop-key]"
      ) as HTMLElement | null;
      dropKeyEl = columnEl;
    }

    // If we found a column element, compute insertIndex by scanning its children (cards order)
    if (dropKeyEl) {
      const dropKey = (dropKeyEl as HTMLElement).dataset.dropKey;
      // get array of card elements inside column in DOM order
      const cardsInColumn = Array.from(
        (dropKeyEl as HTMLElement).querySelectorAll("[data-task-id]")
      ) as HTMLElement[];
      if (cardsInColumn.length === 0) {
        insertIndex = 0;
      } else if (cardEl && insertBeforeTaskId) {
        // find index of that task
        insertIndex = cardsInColumn.findIndex(
          (c) =>
            (c.dataset.taskId ?? c.id.replace(/^taskcard-/, "")) ===
            insertBeforeTaskId
        );
        if (insertIndex === -1) insertIndex = cardsInColumn.length; // fallback to end
      } else if (cardEl) {
        // pointer was on lower half of a card -> insert after that card
        const targetCardEl = (cardEl as HTMLElement).closest(
          "[data-task-id]"
        ) as HTMLElement | null;
        const idx = cardsInColumn.findIndex((c) => c === targetCardEl);
        insertIndex = idx === -1 ? cardsInColumn.length : idx + 1;
      } else {
        // pointer on empty column area -> append at end
        // find first card whose top is > clientY to insert before, otherwise end
        let found = false;
        for (let i = 0; i < cardsInColumn.length; i++) {
          const r = cardsInColumn[i].getBoundingClientRect();
          if (clientY < r.top + r.height / 2) {
            insertIndex = i;
            found = true;
            break;
          }
        }
        if (!found) insertIndex = cardsInColumn.length;
      }

      return { dropKey: dropKey as string | undefined, insertIndex };
    }

    return { dropKey: undefined, insertIndex: null };
  }

  function startPointerDrag(
    id: string,
    clientX: number,
    clientY: number,
    el: HTMLElement | null,
    opts: { captureImmediately?: boolean } = {}
  ) {
    // set dragging id asap
    setDragTaskId(id);

    // try to use the provided element's rect first
    let rect = el?.getBoundingClientRect() ?? null;

    // If pointer is outside rect, try to find the topmost element under pointer
    const pointerOutside =
      !rect ||
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom;

    if (pointerOutside) {
      try {
        const hit = document.elementFromPoint(
          clientX,
          clientY
        ) as HTMLElement | null;
        if (hit) {
          // Prefer the closest ancestor that looks like a task card (data-task-id or id starting with taskcard-)
          const candidate =
            (hit.closest && (hit.closest("[data-task-id]") as HTMLElement)) ||
            (hit.closest &&
              (hit.closest("[id^='taskcard-']") as HTMLElement)) ||
            hit;
          const candRect = candidate?.getBoundingClientRect();
          if (candRect && isFinite(candRect.left)) {
            rect = candRect;
          }
        }
      } catch (e) {
        // ignore; keep original rect if any
      }
    }

    // If still no rect, fallback to a safe default size/position relative to pointer
    const width = rect?.width ?? 300;
    const height = rect?.height ?? 56;

    // compute offset (cursor -> element) and clamp into bounds
    let offsetX = rect ? clientX - rect.left : Math.round(width / 2);
    let offsetY = rect ? clientY - rect.top : Math.round(height / 2);

    // clamp values (prevent weird big offsets)
    offsetX = Math.max(0, Math.min(offsetX, width));
    offsetY = Math.max(0, Math.min(offsetY, height));

    offsetRef.current = { x: offsetX, y: offsetY, width };

    // Set initial drag position so preview appears under the pointer immediately
    const initial = {
      x: clientX - offsetRef.current.x,
      y: clientY - offsetRef.current.y,
      width,
    };

    // cancel pending RAF if any
    pendingPosRef.current = null;
    if (rafRef.current != null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    // set initial preview position immediately (no jump)
    setDragPos(initial);

    let lastScrollX = window.scrollX;
    let lastScrollY = window.scrollY;

    const onScroll = () => {
      // compute how much page scrolled since drag started
      const dx = window.scrollX - lastScrollX;
      const dy = window.scrollY - lastScrollY;
      if (dx === 0 && dy === 0) return;

      // Adjust dragPos by scroll delta so preview stays under pointer
      setDragPos((prev) => ({
        x: prev.x - dx,
        y: prev.y - dy,
        width: prev.width,
      }));

      // update last known scroll (in case of continuous scroll)
      lastScrollX = window.scrollX;
      lastScrollY = window.scrollY;
    };

    // pointer tracking: batch updates via RAF
    const onMove = (ev: PointerEvent) => {
      // guard: ignore invalid coords
      if (typeof ev.clientX !== "number" || typeof ev.clientY !== "number")
        return;

      pendingPosRef.current = {
        x: ev.clientX - offsetRef.current.x,
        y: ev.clientY - offsetRef.current.y,
        width: offsetRef.current.width,
      };

      if (rafRef.current == null) {
        rafRef.current = window.requestAnimationFrame(() => {
          const p = pendingPosRef.current;
          if (p) {
            setDragPos(p);
            pendingPosRef.current = null;
          }
          rafRef.current = null;
        });
      }
    };

    const onUp = (ev: PointerEvent) => {
      // cancel raf
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        pendingPosRef.current = null;
      }

      try {
        const { dropKey, insertIndex } = findDropTargetAndIndex(
          ev.clientX,
          ev.clientY
        );

        if (dropKey != null && typeof insertIndex === "number") {
          const idToUse = id;

          // Optimistic local update: remove item from old place and insert at new column/index
          setTasks((s) => {
            // create deep copy groups: your tasks likely flat; adjust if you store by columns
            const items = [...s];
            const idxFrom = items.findIndex((t) => nid(t.id) === nid(idToUse));
            if (idxFrom === -1) return s;

            const item = items.splice(idxFrom, 1)[0];

            // find insertion position within items by counting tasks currently in that column
            // assume each task has .status field; compute targetInsertionIndex among same-status tasks
            const sameStatus = items.filter((t) => t.status === dropKey);
            // map global insertion index into position in `items` array:
            // compute index of first occurrence of dropKey column in items to figure absolute index
            // Simpler: build new array: all before column, then insert, then rest
            const before = items.filter((t) => t.status !== dropKey);
            // But easier: we'll compute a new ordering by:
            const newList: typeof s = [];
            // push tasks, inserting item when reaching the desired position among dropKey group
            let inserted = false;
            let countInDrop = 0;
            for (let i = 0; i < items.length; i++) {
              const t = items[i];
              if (t.status === dropKey) {
                if (countInDrop === insertIndex && !inserted) {
                  newList.push({ ...item, status: dropKey });
                  inserted = true;
                }
                newList.push(t);
                countInDrop++;
              } else {
                newList.push(t);
              }
            }
            if (!inserted) {
              // either column empty or insert at end
              newList.push({ ...item, status: dropKey });
            }
            return newList;
          });

          // send mutation to update status (and position if server supports ordering)
          updateTaskMutation.mutate(
            {
              id: idToUse,
              patch: {
                status: dropKey /*, order: insertIndex or relative key*/,
              },
            },
            {
              onError: () => {
                // on error fallback: enqueue op or re-fetch
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
        } else {
          // no valid drop target -> simply reset drag
        }
      } catch (err) {
        console.log("drop hit-test failed", err);
      }

      // cleanup
      setDragTaskId(null);
      setDragPos({ x: 0, y: 0, width: 300 });
      offsetRef.current = { x: 0, y: 0, width: 300 };

      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    // attach listeners AFTER initial pos set
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });

    // attach scroll listener on capture so we get notified quickly
    window.addEventListener("scroll", onScroll, {
      passive: true,
      capture: true,
    });

    // and in your cleanup (inside onUp) remove it:
    window.removeEventListener("scroll", onScroll, { capture: true });
  }

  // dipassing ke KanbanBoard via TaskView
  function handleDragStart(e: React.DragEvent, id: string) {
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
    // some browsers emit clientX/Y = 0 when drag leaves window; ignore those
    if (e.clientX === 0 && e.clientY === 0) return;

    pendingPosRef.current = {
      x: e.clientX - offsetRef.current.x,
      y: e.clientY - offsetRef.current.y,
      width: offsetRef.current.width,
    };

    if (rafRef.current == null) {
      rafRef.current = window.requestAnimationFrame(() => {
        const p = pendingPosRef.current;
        if (p) {
          setDragPos(p);
          pendingPosRef.current = null;
        }
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
    if (!tasksQuery.data || !Array.isArray(tasksQuery.data)) return;

    // Snapshot localTasks to compute merge (we'll still call setTasks with final array)
    setTasks((localTasks) => {
      const serverTasks = tasksQuery.data as Task[];

      const tmp = localTasks.filter((t) => nid(t.id).startsWith("tmp_"));
      const others = localTasks.filter(
        (t) => !nid(t.id).startsWith("tmp_") && t.projectId !== activeProjectId
      );

      const localById = new Map(localTasks.map((t) => [nid(t.id), t]));
      const serverById = new Map(serverTasks.map((t) => [nid(t.id), t]));

      const mergedServerTasks: Task[] = serverTasks.map((st) => {
        const id = nid(st.id);
        const lt = localById.get(id);

        const serverComments: any[] = Array.isArray((st as any).comments)
          ? (st as any).comments
          : [];
        const localComments: any[] =
          lt && Array.isArray((lt as any).comments) ? (lt as any).comments : [];

        const maxCreatedAt = (arr: any[]) => {
          if (!arr || arr.length === 0) return null;
          try {
            return arr
              .map((c) => c?.createdAt ?? c?.created_at ?? null)
              .filter(Boolean)
              .sort()
              .slice(-1)[0];
          } catch {
            return null;
          }
        };

        const latestServer = maxCreatedAt(serverComments);
        const latestLocal = maxCreatedAt(localComments);

        const tmpLocalOnly = localComments.filter(
          (c: any) =>
            String(c.id).startsWith("c_tmp_") &&
            !serverComments.some((sc: any) => nid(sc.id) === nid(c.id))
        );

        let chosenComments: any[] = serverComments;

        if (
          localComments.length > 0 &&
          (!latestServer || (latestLocal && latestLocal > latestServer))
        ) {
          chosenComments = localComments;
        } else if (serverComments.length > 0) {
          chosenComments = serverComments;
        } else if (localComments.length > 0) {
          chosenComments = localComments;
        } else {
          chosenComments = [];
        }

        if (tmpLocalOnly.length > 0) {
          const existingIds = new Set(
            chosenComments.map((c: any) => nid(c.id))
          );
          const toAppend = tmpLocalOnly.filter(
            (c: any) => !existingIds.has(nid(c.id))
          );
          if (toAppend.length > 0)
            chosenComments = [...chosenComments, ...toAppend];
        }

        return { ...st, comments: chosenComments };
      });

      const merged = [
        ...others,
        ...mergedServerTasks,
        ...tmp.filter((t) => t.projectId === activeProjectId),
      ];

      // build map for quick lookup
      const mergedMap = new Map<string, Task>();
      for (const t of merged) mergedMap.set(nid(t.id), t);

      // update selectedTask to the merged object if currently selected
      setSelectedTask((cur) => {
        if (!cur) return cur;
        const found = mergedMap.get(nid(cur.id));
        // if found, return merged object (fresh ref) so modal sees up-to-date comments
        return found ?? cur;
      });

      // finally return canonical merged array (deduped by id)
      const map = new Map<string, Task>();
      for (const t of merged) map.set(nid(t.id), t);
      return Array.from(map.values());
    });
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
    // apply local update and ensure selectedTask updated as well
    setTasks((s) => {
      const next = s.map((t) => (nid(t.id) === nid(updated.id) ? updated : t));
      // also update selectedTask to the same reference so modal sees latest immediately
      setSelectedTask((cur) =>
        cur && nid(cur.id) === nid(updated.id) ? updated : cur
      );
      return next;
    });

    // handle tmp id case by enqueueing
    if (nid(updated.id).startsWith("tmp_")) {
      try {
        const patchToQueue: any = {
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

        // include comments if present on updated (may be [] or array)
        if (
          Object.prototype.hasOwnProperty.call(updated || {}, "comments") ||
          "comments" in (updated || {})
        ) {
          patchToQueue.patch.comments = (updated as any).comments ?? null;
        } else {
          console.log("[handleUpdateTask/tmp] no comments in updated");
        }

        enqueueOp({
          op: "update_task",
          payload: patchToQueue,
          createdAt: new Date().toISOString(),
        });
      } catch (e) {
        console.log("handle update task enqueue failed", e);
      }
      return;
    }

    // normal branch: build patch and call mutation
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

      // include comments when provided (array|null)
      if (
        Object.prototype.hasOwnProperty.call(updated || {}, "comments") ||
        "comments" in (updated || {})
      ) {
        patch.comments = (updated as any).comments ?? null;
      } else {
        console.log("[handleUpdateTask] no comments property on updated");
      }

      const result = await updateTaskMutation.mutateAsync({
        id: updated.id,
        patch,
      });

      // Merge updated into react-query cache so a near-immediate refetch won't clobber optimistic comments
      try {
        // Prefer server result; but preserve existing comments if server omitted them
        qcRef.current.setQueryData(["tasks", activeProjectId], (old: any) => {
          if (!Array.isArray(old)) return old;
          return (old as Task[]).map((t) => {
            if (nid(t.id) === nid(updated.id)) {
              const merged = {
                ...t, // baseline local
                ...result, // server authoritative fields
                // ensure comments fallback: prefer server.comments, else local t.comments
                comments:
                  result && typeof result.comments !== "undefined"
                    ? result.comments
                    : t.comments,
              };
              return merged;
            }
            return t;
          });
        });
      } catch (e) {
        console.warn("[handleUpdateTask] merge to tasks cache failed", e);
      }

      // Update any single-task/detail cache key too (if used)
      try {
        qcRef.current.setQueryData(["task", updated.id], (old: any) => {
          if (!old) return result;
          return {
            ...old,
            ...result,
            comments:
              result && typeof result.comments !== "undefined"
                ? result.comments
                : old.comments,
          };
        });
        console.log(
          "[handleUpdateTask] merged server result into single-task cache"
        );
      } catch (e) {
        // ignore
      }

      // ensure selectedTask references updated object
      console.log("[handleUpdateTask] updating selectedTask to updated");
      // update selectedTask to server result (prefer result so comments kept)
      setSelectedTask((cur) =>
        cur && nid(cur.id) === nid(updated.id)
          ? {
              ...cur,
              ...result,
              comments:
                result && typeof result.comments !== "undefined"
                  ? result.comments
                  : cur.comments,
            }
          : cur
      );
    } catch (err) {
      console.error(
        "handleUpdateTask: updateTaskMutation failed, enqueueing fallback",
        err
      );
      try {
        enqueueOp({
          op: "update_task",
          payload: { id: updated.id, patch: updated },
          createdAt: new Date().toISOString(),
        });
      } catch (e) {
        console.log("handle update task failed", e);
      }
    } finally {
      // Delay invalidation a little so our cache merge has effect before refetch
      try {
        setTimeout(() => {
          try {
            qcRef.current.invalidateQueries(["tasks", activeProjectId]);
            console.log("[handleUpdateTask] invalidateQueries fired (delayed)");
          } catch (e) {
            console.warn("invalidateQueries failed", e);
          }
        }, 300);
      } catch (e) {
        console.warn("invalidate scheduling failed", e);
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

  useEffect(() => {
    if (inviteLink) {
      setShowInviteLink(true);
    } else {
      setShowInviteLink(false);
    }
  }, [inviteLink]);

  async function addTeamMember(newMember: any) {
    const m = {
      ...newMember,
      workspaceId: activeWorkspaceId,
    };

    try {
      const created = await api.inviteTeamMember({ ...m, clientId: m.id });

      if (!created.success) {
        Swal.fire({
          title: "Member Exists",
          text: `Member already exists!`,
          icon: "error",
          showConfirmButton: true,
          background: "#111827",
          color: "#e5e7eb",
        });
      }
      setInviteLink(created.id);
    } catch (err) {
      console.error("createTeamMember failed, enqueueing", err);
      try {
        enqueueOp({
          op: "invite_team",
          payload: { ...m, clientId: m.id },
          createdAt: new Date().toISOString(),
        });
        // leave optimistic item in list — it will be reconciled by queue flush later
      } catch (_) {
        console.log("add team failed");
      }
    }
  }

  async function removeTeamMember(idOrName: string) {
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
  }

  const removeProject = (id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  async function handleImport(payload: {
    projects?: Project[];
    tasks?: Task[];
    team?: string[] | any[];
  }) {
    const genTmpId = () => `tmp_${Math.random().toString(36).slice(2, 9)}`;

    // snapshot of current global team state (use the team variable from your component scope)
    const existingTeamById = new Map<string, TeamMember>(
      (team || []).map((m) => [nid(m.id), m])
    );
    const existingTeamIds = new Set(Array.from(existingTeamById.keys()));

    // Normalize incoming team rows
    const incomingTeam: TeamMember[] = (payload.team || []).map((r: any) => {
      if (typeof r === "string") {
        return {
          id: "",
          clientId: undefined,
          userId: "",
          workspaceId: workspaceId || "",
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
        workspaceId: workspaceId ?? "",
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

    // Merge incoming with existing team (prefer existing entries when ids match)
    const mergeTeam = (prev: TeamMember[], incoming: TeamMember[]) => {
      const byId = new Map(
        prev.filter((p) => !!p.id).map((p) => [nid(p.id), p])
      );
      const byNameLower = new Map(
        prev.map((p) => [p?.name ? p?.name.toLowerCase() : "", p])
      );
      for (const n of incoming) {
        // normalize incoming id (keep original string as-is but use nid() as key)
        if (!n.id) n.id = genTmpId();
        n.workspaceId = workspaceId;
        const nidIncoming = nid(n.id);
        const nameLower = (n.name ?? "").toLowerCase();
        if (nidIncoming && byId.has(nidIncoming)) {
          const ex = byId.get(nidIncoming)!;
          byId.set(nidIncoming, { ...ex, ...n });
        } else if (n.name && byNameLower.has(nameLower)) {
          const ex = byNameLower.get(nameLower)!;
          const idToUse = ex.id || n.id || genTmpId();
          const merged = { ...ex, ...n, id: idToUse };
          byId.set(nid(idToUse), merged);
        } else {
          if (n.id) byId.set(nidIncoming, n);
          else if (n.name) byNameLower.set(nameLower, n);
        }
      }
      const result: TeamMember[] = [];
      for (const v of byId.values()) result.push(v);
      for (const v of byNameLower.values()) {
        if (
          !result.some((r) =>
            r?.name ? r?.name.toLowerCase() : "" === v.name.toLowerCase()
          )
        )
          result.push(v);
      }
      return result;
    };

    const mergedTeam = mergeTeam(team, incomingTeam);

    if ((incomingTeam || []).length > 0) {
      // optimistic show
      setTeam(mergedTeam);
    }

    // Build list of members to create:
    // Create only if:
    //  - id missing
    //  - id is tmp
    //  - OR id provided but not present in existingTeamIds (global state)
    const membersToCreate = mergedTeam.filter((m) => {
      const mId = nid(m.id);
      if (!m.id) return true;
      if (mId.startsWith("tmp_")) return true;
      if (!existingTeamIds.has(mId)) return true; // file id not known locally -> create
      return false; // id exists in global team -> don't create
    });

    // Prepare mapping containers
    const tmpToServer = new Map<string, string>();
    const originalIdToServer = new Map<string, string>();
    const createdMembers: any[] = [];

    if (membersToCreate.length > 0) {
      const memberPromises = membersToCreate.map((m) => {
        const tmpId = nid(m.id).startsWith("tmp_") ? m.id : genTmpId();
        const payload = { ...m, clientId: tmpId, workspaceId: workspaceId };
        console.debug("createTeamMember payload:", payload);
        return api
          .createTeamMember(payload)
          .then((created: any) => ({ ok: true, created, tmpId, payload }))
          .catch((err: any) => ({ ok: false, err, tmpId, payload }));
      });

      const memberResults = await Promise.allSettled(memberPromises);

      for (const r of memberResults) {
        if (r.status === "fulfilled") {
          const val: any = r.value;
          if (val.ok) {
            const created = val.created;
            const tmpId = val.tmpId;
            const payload = val.payload ?? {};
            if (tmpId && created.id) tmpToServer.set(tmpId, created.id);
            if (payload.id && created.id)
              originalIdToServer.set(String(payload.id), created.id);
            const returnedClientId =
              created.clientId ?? created.client_id ?? null;
            if (returnedClientId && created.id) {
              tmpToServer.set(returnedClientId, created.id);
              originalIdToServer.set(returnedClientId, created.id);
            }
            createdMembers.push(created);
          } else {
            // enqueue if needed
            try {
              enqueueOp({
                op: "create_team",
                payload: (val as any).payload,
                createdAt: new Date().toISOString(),
              });
            } catch (e) {
              console.warn("enqueue create_team failed", e);
            }
          }
        } else {
          console.warn("member creation promise failed unexpectedly", r);
        }
      }

      // Merge server-created members into UI state (replace tmp entries)
      if (createdMembers.length > 0) {
        setTeam((prev) => {
          const map = new Map<string, any>();
          for (const p of prev) map.set(nid(p.id), { ...p });
          for (const created of createdMembers) {
            const clientId = created.clientId ?? created.client_id ?? null;
            let foundKey: string | undefined;
            if (clientId) {
              foundKey = Array.from(map.keys()).find(
                (k) => k === clientId || map.get(k)?.clientId === clientId
              );
            }
            if (!foundKey) {
              foundKey = Array.from(map.keys()).find((k) => {
                const v = map.get(k);
                if (!v) return false;
                if (v.name && created.name && v.name === created.name)
                  return true;
                if (v.email && created.email && v.email === created.email)
                  return true;
                return false;
              });
            }
            if (foundKey) map.delete(foundKey);
            map.set(nid(created.id), created);
          }
          return Array.from(map.values());
        });
      }
    }

    // Rebuild liveTeamSnapshot & nameToId for resolving tasks' assignees
    const liveTeamSnapshot = (mergedTeam || []).map((m) => ({ ...m }));
    for (const [tmp, real] of tmpToServer.entries()) {
      const idx = liveTeamSnapshot.findIndex((x) => nid(x.id) === nid(tmp));
      if (idx !== -1) liveTeamSnapshot[idx].id = real;
    }
    for (const cm of createdMembers) {
      const idx = liveTeamSnapshot.findIndex(
        (x) =>
          (x.clientId && x.clientId === cm.clientId) ||
          (x.email && cm.email && x.email === cm.email) ||
          (x.name && cm.name && x.name === cm.name)
      );
      if (idx !== -1) liveTeamSnapshot[idx] = { ...cm };
      else liveTeamSnapshot.push({ ...cm });
    }

    // Also include original existing team (global state) into snapshot to ensure matching works
    for (const existing of team || []) {
      if (!liveTeamSnapshot.some((s) => nid(s.id) === nid(existing.id))) {
        liveTeamSnapshot.push({ ...existing });
      }
    }

    const nameToId = new Map(
      liveTeamSnapshot
        .filter((m) => m && m.name)
        .map((m) => [String(m.name).toLowerCase(), m.id || ""])
    );

    // Helper to parse comments
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
        projectId: projectId ?? null,
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
      existingSignatures.add(s);
      return true;
    });

    if (uniqueIncoming.length === 0 && (incomingTeam || []).length === 0) {
      toast.dark("No new tasks or members to import.");
      return;
    }

    // Prepare tasks: resolve assigneeId with safe priority:
    // 1) if assigneeId matches existingTeamIds -> use as-is (no create)
    // 2) if assigneeId maps from tmpToServer -> use mapped server id
    // 3) if assigneeId maps from originalIdToServer -> use mapped server id
    // 4) fallback: match by assigneeName -> nameToId
    // 5) else null
    const preparedTasks = uniqueIncoming.map((t) => {
      const tmpId = nid(t.id).startsWith("tmp_") ? t.id : genTmpId();
      let assigneeId = t.assigneeId ?? null;

      if (assigneeId && existingTeamIds.has(nid(assigneeId))) {
        // assigneeId already exists in global team -> keep it
        // eslint-disable-next-line no-self-assign
        assigneeId = assigneeId;
      } else if (assigneeId && tmpToServer.has(assigneeId)) {
        assigneeId = tmpToServer.get(assigneeId)!;
      } else if (assigneeId && originalIdToServer.has(assigneeId)) {
        assigneeId = originalIdToServer.get(assigneeId)!;
      } else if ((!assigneeId || assigneeId === "") && t.assigneeName) {
        const found = nameToId.get(String(t.assigneeName).toLowerCase());
        if (found) assigneeId = found;
      } else {
        // final fallback: null (don't send invalid ids to backend)
        assigneeId = null;
      }

      return {
        ...t,
        id: tmpId,
        projectId: projectId,
        assigneeId,
      } as Task;
    });

    // optimistic insert tasks
    setTasks((prev) => {
      const prevSig = new Set(prev.map((p) => makeSig(p)));
      const toAdd = preparedTasks.filter((t) => {
        const s = makeSig(t);
        return !prevSig.has(s);
      });
      return [...toAdd, ...prev];
    });

    // create tasks on server
    const taskCreatePromises = preparedTasks.map((t) => {
      const clientId = t.id;
      const payloadForServer: any = {
        ...t,
        clientId,
        id: undefined,
        comments: undefined,
        projectId: projectId,
      };
      console.debug("createTask payload:", payloadForServer);
      return api
        .createTask(payloadForServer)
        .then((created: any) => ({
          ok: true as const,
          created,
          tmpId: clientId,
          comments: t.comments || [],
        }))
        .catch((err: any) => ({
          ok: false as const,
          err,
          tmpId: clientId,
          payload: payloadForServer,
          comments: t.comments || [],
        }));
    });

    const taskResultsSettled = await Promise.allSettled(taskCreatePromises);

    const createdTasks: any[] = [];
    const failedTasksForEnqueue: any[] = [];
    for (const r of taskResultsSettled) {
      if (r.status === "fulfilled") {
        const res = r.value;
        if (res.ok) {
          tmpToServer.set(res.tmpId, res.created.id);
          createdTasks.push(res);
        } else {
          failedTasksForEnqueue.push(res);
        }
      } else {
        console.warn("task creation promise failed unexpectedly", r);
      }
    }

    // replace tmp tasks with server ones
    if (createdTasks.length > 0) {
      setTasks((prev) => {
        const sigToTask = new Map<string, Task>();
        const idToTask = new Map<string, Task>();
        for (const p of prev) {
          const pId = nid(p.id);
          const pSig = makeSig(p);
          if (!idToTask.has(pId)) idToTask.set(pId, p);
          if (!sigToTask.has(pSig)) sigToTask.set(pSig, p);
        }
        for (const ct of createdTasks) {
          const created = ct.created;
          const tmpId = ct.tmpId;
          const sig = `${(created.title || "").trim().toLowerCase()}|${nid(
            created.projectId
          )}|${nid(created.startDate)}|${nid(created.dueDate)}`;
          if (sigToTask.has(sig)) {
            const collision = sigToTask.get(sig)!;
            if (nid(collision.id) !== nid(created.id)) {
              idToTask.delete(nid(collision.id));
            }
          }
          idToTask.delete(nid(tmpId));
          idToTask.set(nid(created.id), created);
          sigToTask.set(sig, created);
        }
        const result: Task[] = [];
        for (const ct of createdTasks) result.push(ct.created);
        for (const p of idToTask.values()) {
          if (!createdTasks.some((ct) => nid(ct.created.id) === nid(p.id)))
            result.push(p);
        }
        return result;
      });
    }

    // comments creation (same flow as before)
    const commentCreatePromises: Promise<any>[] = [];
    for (const ct of createdTasks) {
      const createdTask = ct.created;
      const commentsForTask = ct.comments || [];
      for (const c of commentsForTask) {
        const payload = {
          author: c.author ?? c.Author ?? "Imported",
          body: c.body ?? c.Body ?? String(c) ?? "",
          attachments: c.attachments ?? c.Attachments ?? [],
        };
        const p = api
          .createComment(createdTask.id, payload)
          .then((createdComment: any) => ({
            ok: true as const,
            createdComment,
            taskId: createdTask.id,
          }))
          .catch((err: any) => ({
            ok: false as const,
            err,
            taskId: createdTask.id,
            payload,
          }));
        commentCreatePromises.push(p);
      }
    }

    const commentResults = await Promise.allSettled(commentCreatePromises);

    const commentsGroupedByTask = new Map<string, any[]>();
    for (const r of commentResults) {
      if (r.status === "fulfilled") {
        const v = r.value;
        if (v.ok) {
          const arr = commentsGroupedByTask.get(v.taskId) ?? [];
          arr.push(v.createdComment);
          commentsGroupedByTask.set(v.taskId, arr);
        } else {
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

    // debugging aids
    console.debug("existingTeamIds:", Array.from(existingTeamIds));
    console.debug("tmpToServer:", Array.from(tmpToServer.entries()));
    console.debug(
      "originalIdToServer:",
      Array.from(originalIdToServer.entries())
    );
    console.debug("nameToId:", Array.from(nameToId.entries()));

    toast.dark(
      "Imported tasks & members applied (parallellized; syncing in background)"
    );
  }

  const projectTasks = tasks.filter((t) => nid(t.projectId) === nid(projectId));
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
          openEditProfileTeam={openEditProfileTeam}
          isAdmin={isAdmin}
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
    group relative inline-flex items-center gap-2 px-5 py-2.5
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
                        : "group-hover:rotate-180 text-gray-700 dark:text-white/80"
                    }`}
                  />

                  {/* label */}
                  <span
                    className={
                      syncing
                        ? "text-emerald-400"
                        : "text-gray-900 dark:text-white"
                    }
                  >
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
                {isAdmin && (
                  <ExportImportControls
                    projects={projects}
                    tasks={tasks}
                    team={team}
                    onImport={(payload: any) => handleImport(payload)}
                  />
                )}

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
                          {userInitial.toUpperCase()}
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
              onDropTo={(
                status?: string,
                draggedId?: string,
                insertIndex?: number
              ) => {
                if (!draggedId) return;

                // optimistic reorder on client (flat tasks array, each task has .status)
                setTasks((s) => {
                  const clone = [...s];
                  const fromIdx = clone.findIndex(
                    (t) => nid(t.id) === nid(draggedId)
                  );
                  if (fromIdx === -1) return s;

                  const [moved] = clone.splice(fromIdx, 1);

                  // collect current tasks in the destination column (in DOM/state order)
                  const dest = clone.filter((t) => t.status === status);

                  // compute insertion index among dest; default append
                  const idx =
                    typeof insertIndex === "number" && insertIndex >= 0
                      ? insertIndex
                      : dest.length;

                  // build new list: insert moved task (with updated status) at proper position among dest
                  const result: typeof s = [];
                  let inserted = false;
                  let seenInDest = 0;
                  for (const t of clone) {
                    if (t.status === status) {
                      if (seenInDest === idx && !inserted) {
                        result.push({ ...moved, status });
                        inserted = true;
                      }
                      result.push(t);
                      seenInDest++;
                    } else {
                      result.push(t);
                    }
                  }
                  if (!inserted) {
                    // column empty or insert at end
                    result.push({ ...moved, status });
                  }
                  return result;
                });

                // call server to persist status (and optionally order/position if backend supports it)
                updateTaskMutation.mutate(
                  {
                    id: draggedId,
                    patch: {
                      status /* optionally include order/index if supported */,
                    },
                  },
                  {
                    onError: (err) => {
                      console.error("update task failed", err);
                      // fallback: enqueue op for eventual sync
                      try {
                        enqueueOp({
                          op: "update_task",
                          payload: { id: draggedId, patch: { status } },
                          createdAt: new Date().toISOString(),
                        });
                      } catch (e) {
                        console.log("enqueue failed", e);
                      }
                    },
                    onSettled: () => {
                      qcRef.current.invalidateQueries([
                        "tasks",
                        activeProjectId,
                      ]);
                    },
                  }
                );
              }}
              onDragStart={handleDragStart}
              onDrag={handleDrag}
              onDragEnd={handleDragEnd}
              dragPos={dragPos}
              dragTaskId={dragTaskId}
              startPointerDrag={startPointerDrag}
              onSelectTask={(t) => setSelectedTask(t)}
              team={team}
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
                  const taskId = selectedTask?.id;
                  if (!taskId) {
                    console.warn("onAddComment: no selectedTask available");
                    return;
                  }

                  const tmpId = `c_tmp_${Math.random()
                    .toString(36)
                    .slice(2, 9)}`;
                  const tmpComment = {
                    id: tmpId,
                    author,
                    body,
                    createdAt: new Date().toISOString(),
                    attachments: attachments ?? [],
                  };

                  // optimistic update tasks + also update selectedTask so modal sees it
                  setTasks((prev) => {
                    const next = prev.map((t) =>
                      nid(t.id) === nid(taskId)
                        ? {
                            ...t,
                            comments: [tmpComment, ...(t.comments || [])],
                          }
                        : t
                    );

                    // update selectedTask to the new object reference (so modal receives new prop)
                    const updated =
                      next.find((t) => nid(t.id) === nid(taskId)) ?? null;
                    setSelectedTask(updated);

                    // persist snapshot so close->open reads the updated tasks immediately
                    try {
                      const snapshotRaw = localStorage.getItem(
                        "commitflow_local_snapshot"
                      );
                      const snap = snapshotRaw ? JSON.parse(snapshotRaw) : {};
                      snap.tasks = next;
                      localStorage.setItem(
                        "commitflow_local_snapshot",
                        JSON.stringify(snap)
                      );
                    } catch (e) {
                      console.warn("persist snapshot failed", e);
                    }

                    return next;
                  });

                  playSound("/sounds/send.mp3", isPlaySound);

                  try {
                    // call API
                    const created = await api.createComment(taskId, {
                      author,
                      body,
                      attachments,
                    });

                    // replace tmp comment with server-created comment, update selectedTask too
                    setTasks((prev) => {
                      const next = prev.map((t) => {
                        if (nid(t.id) !== nid(taskId)) return t;
                        const cs = (t.comments || []).map((c: any) =>
                          c.id === tmpId ? created : c
                        );
                        const has = cs.some(
                          (c: any) => nid(c.id) === nid(created.id)
                        );
                        return { ...t, comments: has ? cs : [...cs, created] };
                      });

                      const updated =
                        next.find((t) => nid(t.id) === nid(taskId)) ?? null;
                      setSelectedTask(updated);

                      // persist updated snapshot
                      try {
                        const snapRaw = localStorage.getItem(
                          "commitflow_local_snapshot"
                        );
                        const snap = snapRaw ? JSON.parse(snapRaw) : {};
                        snap.tasks = next;
                        localStorage.setItem(
                          "commitflow_local_snapshot",
                          JSON.stringify(snap)
                        );
                      } catch (e) {
                        console.warn("persist updated snapshot failed", e);
                      }

                      return next;
                    });
                  } catch (err) {
                    console.error("create comment failed, enqueueing", err);
                    try {
                      enqueueOp({
                        op: "create_comment",
                        payload: { taskId, author, body, attachments },
                        createdAt: new Date().toISOString(),
                      });
                    } catch (e) {
                      console.warn("enqueue create_comment failed", e);
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

      <EditMemberModal
        open={showEditMember}
        onClose={() => setShowEditMember(false)}
        member={editMember}
        onSave={handleSaveMember}
        dark={dark}
      />

      <InviteLinkModal
        open={showInviteLink}
        onClose={() => setShowInviteLink(false)}
        id={inviteLink}
        dark={dark}
      />
    </QueryClientProvider>
  );
}
