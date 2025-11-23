import React, { useMemo, useRef, useEffect, useState } from "react";
import parse from "html-react-parser";
import type { Task, TeamMember } from "../types";

function hashStr(s: string) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return Math.abs(h);
}
function hslStr(h: number, s = 75, l = 50) {
  return `hsl(${h} ${s}% ${l}%)`;
}
function hslaStr(h: number, s = 75, l = 50, a = 1) {
  return `hsla(${h} ${s}% ${l}% / ${a})`;
}

function formatDateShort(d) {
  if (!d) return null;
  // expect ISO-like YYYY-MM-DD or any Date-parsable string
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" }); // e.g. "Nov 23"
}

// helper: compare dates ignoring time (midnight-to-midnight)
function toMidnightDate(d?: string | Date | null) {
  if (!d) return null;
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return null;
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()); // midnight of that day
}

// safe parse YYYY-MM-DD or fallback to Date, then normalize to midnight local
function parseDateOnlySafe(v?: string | null) {
  if (!v) return null;
  // if exactly YYYY-MM-DD -> parse as local date (avoid timezone shift)
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    return new Date(y, mo, d); // local midnight of that date
  }
  // fallback: try Date
  const dt = new Date(v);
  if (Number.isNaN(dt.getTime())) return null;
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

function relativeInfo(d) {
  if (!d) return null;
  const dt = new Date(d);
  const now = new Date();
  const diffMs = dt.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "today";
  if (diffDays > 0) return diffDays === 1 ? "in 1 day" : `in ${diffDays} days`;
  const past = Math.abs(diffDays);
  return past === 1 ? "1 day ago" : `${past} days ago`;
}

// Small, memoized TaskCard to reduce rerenders while dragging
const TaskCard = React.memo(
  function TaskCard({
    task,
    isBeingDragged,
    dragPos,
    team,
    onDragStart,
    onDrag,
    onDragEnd,
    onSelectTask,
    startPointerDrag,
    priorityAccent,
    priorityPill,
  }: {
    task: Task;
    isBeingDragged: boolean;
    dragPos: { x: number; y: number; width: number };
    team: TeamMember[];
    onDragStart: (e: React.DragEvent, id: string) => void;
    onDrag: (e: React.DragEvent) => void;
    onDragEnd: (e: React.DragEvent) => void;
    onSelectTask: (t: Task) => void;
    startPointerDrag: (id: string, x: number, y: number, target: any) => void;
    priorityAccent: (p?: Task["priority"]) => string;
    priorityPill: (p?: Task["priority"]) => { label: string; classes: string };
  }) {
    const pill = priorityPill(task.priority);

    const assigneeId = (task as any).assigneeId ?? null;
    const assigneeNameFromTask = task.assigneeName ?? "";
    const member =
      (assigneeId && team.find((m) => m.id === assigneeId)) ??
      (assigneeNameFromTask &&
        team.find((m) => m.name === assigneeNameFromTask)) ??
      undefined;
    const assigneeLabel = member?.name ?? assigneeNameFromTask ?? "";

    const hue = assigneeLabel ? hashStr(assigneeLabel) % 360 : 200;
    const avatarBg = member?.photo
      ? undefined
      : typeof window !== "undefined" &&
        document.documentElement.classList.contains("dark")
      ? hslaStr(hue, 65, 50, 0.16)
      : hslaStr(hue, 75, 85, 0.95);
    const avatarText = member?.photo
      ? undefined
      : typeof window !== "undefined" &&
        document.documentElement.classList.contains("dark")
      ? hslStr(hue, 65, 80)
      : hslStr(hue, 75, 25);

    // capture original rect so switching to fixed doesn't jump
    const origRectRef = useRef<{ left: number; top: number } | null>(null);
    useEffect(() => {
      if (isBeingDragged) {
        try {
          const el = document.getElementById(
            `taskcard-${task.id}`
          ) as HTMLElement | null;
          const rect = el?.getBoundingClientRect();
          if (rect)
            origRectRef.current = {
              left: rect.left + window.scrollX,
              top: rect.top + window.scrollY,
            };
        } catch (e) {
          origRectRef.current = null;
        }
      } else {
        origRectRef.current = null;
      }
    }, [isBeingDragged, task.id]);

    const transformStyle = isBeingDragged
      ? {
          position: "fixed" as const,
          left: 0,
          top: 0,
          transform: `translate3d(${dragPos.x}px, ${dragPos.y}px, 0)`,
          width: `${dragPos.width}px`,
        }
      : {};

    // pointer-drag helpers to avoid opening modal on click and avoid jumps
    const suppressClickRef = useRef(false);
    const pointerDownRef = useRef<{ x: number; y: number } | null>(null);
    const pointerIdRef = useRef<number | null>(null);

    useEffect(() => {
      return () => {
        // cleanup in case component unmounts while pointers attached
        pointerDownRef.current = null;
        pointerIdRef.current = null;
      };
    }, []);

    const onPointerDownLocal = (e: React.PointerEvent) => {
      if (e.button && e.button !== 0) return;
      const el = e.currentTarget as HTMLElement;
      try {
        el.setPointerCapture?.(e.pointerId);
      } catch (e) {
        console.log(e);
      }
      pointerDownRef.current = { x: e.clientX, y: e.clientY };
      pointerIdRef.current = e.pointerId;

      const onMove = (ev: PointerEvent) => {
        if (!pointerDownRef.current) return;
        const dx = ev.clientX - pointerDownRef.current.x;
        const dy = ev.clientY - pointerDownRef.current.y;
        const dist2 = dx * dx + dy * dy;
        if (dist2 > 25) {
          // started dragging (threshold 5px)
          suppressClickRef.current = true;
          // call parent's pointer-based drag start once
          startPointerDrag(task.id, ev.clientX, ev.clientY, el);
          // after starting pointer drag, remove move listener (parent handles pointer moves)
          window.removeEventListener("pointermove", onMove);
        }
      };

      const onUp = (ev: PointerEvent) => {
        try {
          el.releasePointerCapture?.(pointerIdRef.current ?? 0);
        } catch (e) {
          console.log(e);
        }
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);

        // if we suppressed click because of tiny movement, clear shortly after
        if (suppressClickRef.current) {
          setTimeout(() => (suppressClickRef.current = false), 200);
        }

        pointerDownRef.current = null;
        pointerIdRef.current = null;
      };

      window.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("pointerup", onUp, { once: true });
    };

    const handleClick = (e: React.MouseEvent) => {
      if (suppressClickRef.current) {
        e.stopPropagation();
        e.preventDefault();
        return;
      }
      onSelectTask(task);
    };

    const draggedStyles = isBeingDragged
      ? {
          position: "fixed" as const,
          left: 0,
          top: 0,
          transform: `translate3d(${dragPos.x}px, ${dragPos.y}px, 0)`,
          width: `${dragPos.width}px`,
          zIndex: 9999,
          pointerEvents: "none" as const,
          willChange: "transform" as const,
          transition: "none",
        }
      : {
          // normal state: jangan set transform/position yang mempengaruhi layout
          position: undefined,
          transform: undefined,
          width: undefined,
          zIndex: undefined,
          pointerEvents: undefined,
          willChange: undefined,
          transition: undefined,
        };

    return (
      <div
        id={`taskcard-${task.id}`}
        data-task-id={task.id}
        draggable={true}
        onMouseDown={(e) => {
          try {
            (e.currentTarget as HTMLElement).draggable = true;
          } catch (e) {
            /* noop */
          }
        }}
        onDragStart={(e) => onDragStart(e, task.id)}
        onDrag={(e) => onDrag(e)}
        onDragEnd={(e) => onDragEnd(e)}
        onPointerDown={(e) => {
          if (e.button && e.button !== 0) return;
          const el = e.currentTarget as HTMLElement;

          // prevent default selection
          try {
            el.setPointerCapture?.(e.pointerId);
          } catch (e) {
            console.log(e);
          }

          // 1) set dragTaskId immediately so isBeingDragged updates
          //    (this is in parent via startPointerDrag which will call setDragTaskId)
          // 2) capture rect and start pointer handlers
          startPointerDrag(task.id, e.clientX, e.clientY, el);

          // mark we suppressed click until pointerup (parent can return a flag if needed)
        }}
        onClick={handleClick}
        className={
          "relative flex flex-col gap-3 p-2 rounded-xl cursor-pointer bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm hover:scale-[1.01] hover:shadow-lg " +
          (isBeingDragged ? "" : "transform transition-all duration-150")
        }
        style={{
          border: "1px solid rgba(15,23,42,0.04)",
          ...(draggedStyles as any),
        }}
      >
        <div
          className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${priorityAccent(
            task.priority
          )}`}
        />

        <div className="flex flex-col gap-2 pl-2">
          {/* Title */}
          <div className="font-medium text-base text-slate-900 dark:text-slate-100 truncate">
            {task.title}
          </div>

          {/* Description */}
          {task.description && (
            <div className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
              {parse(task.description)}
            </div>
          )}

          {/* Status pill */}
          <div className="mt-2">
            <span
              className={`inline-block px-3 py-1 rounded-full text-xs font-semibold tracking-wide ${pill.classes}`}
            >
              {pill.label}
            </span>
          </div>

          {/* Start & Due (elegant row) */}
          <div className="flex gap-2 flex-wrap mt-1">
            {/* Start Date */}
            {task.startDate
              ? (() => {
                  const sd = parseDateOnlySafe(task.startDate);
                  return sd ? (
                    <div
                      className="flex items-center gap-2 px-3 py-1 rounded-full bg-sky-700/10 dark:bg-sky-600/20 
                   text-xs font-medium text-sky-500 dark:text-sky-300"
                      title={`Start: ${task.startDate}`}
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden
                      >
                        <path
                          d="M8 7V3M16 7V3M3 11h18M5 21h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2z"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span>{formatDateShort(task.startDate)}</span>
                    </div>
                  ) : null;
                })()
              : null}

            {/* Due Date with robust parsing and warning if today >= due */}
            {task.dueDate
              ? (() => {
                  const due = parseDateOnlySafe(task.dueDate);
                  if (!due) return null; // invalid date — don't render

                  const now = new Date();
                  const today = new Date(
                    now.getFullYear(),
                    now.getMonth(),
                    now.getDate()
                  ); // midnight local

                  const isOverdue = due.getTime() < today.getTime();
                  const isToday = due.getTime() === today.getTime();
                  const baseClasses =
                    "flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium";
                  const overdueClasses =
                    "bg-red-700/10 dark:bg-red-600/20 text-red-500 dark:text-red-300";
                  const todayClasses =
                    "bg-amber-700/10 dark:bg-amber-600/20 text-amber-500 dark:text-amber-300";
                  const okClasses =
                    "bg-emerald-700/10 dark:bg-emerald-600/20 text-emerald-500 dark:text-emerald-300";

                  const pillClasses = isOverdue
                    ? overdueClasses
                    : isToday
                    ? todayClasses
                    : okClasses;
                  const statusLabel = isOverdue
                    ? "overdue"
                    : isToday
                    ? "due today"
                    : "";

                  return (
                    <div
                      className={`${baseClasses} ${pillClasses}`}
                      title={
                        statusLabel
                          ? `${statusLabel} • ${task.dueDate}`
                          : `Due: ${task.dueDate}`
                      }
                      aria-live="polite"
                    >
                      {/* icon: warning for overdue / today, calendar otherwise */}
                      {isOverdue || isToday ? (
                        <svg
                          className="w-3.5 h-3.5"
                          viewBox="0 0 24 24"
                          fill="none"
                          aria-hidden
                        >
                          <path
                            d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
                            stroke="currentColor"
                            strokeWidth="1.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M12 9v4"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M12 17h.01"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="w-3.5 h-3.5"
                          viewBox="0 0 24 24"
                          fill="none"
                          aria-hidden
                        >
                          <path
                            d="M8 7V3M16 7V3M3 11h18M5 21h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2z"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}

                      <div className="flex flex-col leading-tight">
                        <span className="text-xs text-slate-900 dark:text-slate-100">
                          {formatDateShort(task.dueDate)}
                        </span>
                        {(isOverdue || isToday) && (
                          <span
                            className={`text-[11px] ${
                              isOverdue ? "text-red-300" : "text-amber-300"
                            }`}
                          >
                            {isOverdue ? "overdue" : "due today"}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })()
              : null}
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3 pl-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold overflow-hidden"
            style={{ background: avatarBg, color: avatarText }}
            title={assigneeLabel || "Unassigned"}
          >
            {member?.photo ? (
              <img
                src={member.photo}
                alt={`${member.name} photo`}
                className="w-full h-full object-cover rounded-full"
              />
            ) : assigneeLabel ? (
              assigneeLabel
                .split(" ")
                .map((n: any) => n[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()
            ) : (
              "—"
            )}
          </div>
          <div className="text-sm text-slate-900 dark:text-slate-100">
            {assigneeLabel || "Unassigned"}
          </div>
        </div>
      </div>
    );
  },
  // custom comparator: shallow compare important task fields + drag state
  (prev, next) => {
    if (prev.task.id !== next.task.id) return false;
    if (prev.task.title !== next.task.title) return false;
    if ((prev.task as any).description !== (next.task as any).description)
      return false;
    if (prev.task.priority !== next.task.priority) return false;
    if (prev.task.startDate !== next.task.startDate) return false;
    if (prev.task.dueDate !== next.task.dueDate) return false;
    const prevAssignee =
      (prev.task as any).assigneeId ?? (prev.task as any).assigneeName ?? null;
    const nextAssignee =
      (next.task as any).assigneeId ?? (next.task as any).assigneeName ?? null;
    if (prevAssignee !== nextAssignee) return false;
    if (prev.isBeingDragged !== next.isBeingDragged) return false;
    if (prev.isBeingDragged) {
      // when dragging, only re-render if dragPos changed
      return (
        prev.dragPos.x === next.dragPos.x &&
        prev.dragPos.y === next.dragPos.y &&
        prev.dragPos.width === next.dragPos.width
      );
    }
    return true;
  }
);

export default function KanbanBoard({
  columns,
  onDropTo,
  onDragStart,
  onSelectTask,
  team,
  currentMemberId,
  onDrag,
  onDragEnd,
  dragTaskId,
  dragPos,
  startPointerDrag,
}: {
  columns: { key: Task["status"]; title: string; items: Task[] }[];
  onDropTo: (s: Task["status"], draggedId?: string) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onSelectTask: (t: Task) => void;
  team: TeamMember[];
  currentMemberId?: string | null;
  onDrag: (e: React.DragEvent) => void;
  onDragEnd: (e: React.DragEvent) => void;
  dragTaskId: string | null;
  dragPos: { x: number; y: number; width: number };
  startPointerDrag: (id: string, x: number, y: number, target: any) => void;
}) {
  const [onlyMine, setOnlyMine] = useState(false);
  const priorityAccent = (priority?: Task["priority"]) => {
    if (priority === "urgent") return "bg-red-500/80 dark:bg-red-500/80";
    if (priority === "medium") return "bg-amber-400/85 dark:bg-amber-400/70";
    return "bg-emerald-500/80 dark:bg-emerald-500/70";
  };

  const priorityPill = (priority?: Task["priority"]) => {
    if (priority === "urgent")
      return {
        label: "🔥 Urgent",
        classes:
          "bg-red-500/15 text-red-600 dark:bg-red-500/25 dark:text-red-300 border border-red-500/20",
      };
    if (priority === "medium")
      return {
        label: "⚡ Medium",
        classes:
          "bg-amber-400/15 text-amber-600 dark:bg-amber-400/25 dark:text-amber-300 border border-amber-400/20",
      };
    return {
      label: "🌿 Low",
      classes:
        "bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/25 dark:text-emerald-300 border border-emerald-500/20",
    };
  };

  const allTasks = useMemo(
    () =>
      columns.flatMap((c) =>
        c.items.map((it) => ({
          ...it,
          status: c.key,
        }))
      ),
    [columns]
  );

  const currentMember = useMemo(
    () => team.find((m) => String(m.id) === String(currentMemberId)),
    [team, currentMemberId]
  );
  const currentMemberName = currentMember?.name ?? null;

  const isAssignedToCurrent = (task: Task) => {
    const aid = (task as any).assigneeId ?? null;
    const aname = (task as any).assigneeName ?? null;

    if (aid && currentMemberId && String(aid) === String(currentMemberId))
      return true;
    if (
      currentMemberName &&
      aname &&
      String(aname).toLowerCase() === String(currentMemberName).toLowerCase()
    )
      return true;
    return false;
  };

  const assignedCount = useMemo(
    () =>
      allTasks.reduce(
        (acc, t) => (isAssignedToCurrent(t as Task) ? acc + 1 : acc),
        0
      ),
    [allTasks, currentMemberId, team]
  );

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100"></h3>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-sm text-gray-600 dark:text-gray-300">
            {columns.reduce((sum, c) => sum + c.items.length, 0)} tasks
          </div>

          <button
            type="button"
            onClick={() => setOnlyMine((v) => !v)}
            aria-pressed={onlyMine}
            title="Show only tasks assigned to you"
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-md text-sm font-medium transition-colors focus:outline-none ${
              onlyMine
                ? "bg-sky-600 text-white border border-sky-600 shadow-sm"
                : "bg-white text-slate-700 dark:bg-gray-800 dark:text-slate-100 border border-gray-200 dark:border-gray-700"
            }`}
          >
            {/* icon */}
            <span
              className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs ${
                onlyMine ? "bg-white/20" : "bg-sky-100 dark:bg-white/5"
              }`}
              aria-hidden
            >
              {/* small person icon (emoji keeps it simple) */}
              👤
            </span>

            <span className="whitespace-nowrap">Assigned to me</span>

            <span
              className={`inline-flex items-center justify-center ml-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                onlyMine ? "bg-white/20" : "bg-gray-100 dark:bg-white/5"
              }`}
            >
              {assignedCount}
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {columns.map((col) => {
          const visibleItems = onlyMine
            ? col.items.filter((task) => isAssignedToCurrent(task))
            : col.items;

          return (
            <div key={col.key} className="rounded-lg min-h-[300px]">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-lg text-slate-900 dark:text-slate-100">
                  {col.title}
                </h4>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  total: {col.items.length}
                </span>
              </div>

              <div
                data-drop-key={col.key}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const dtId =
                    e.dataTransfer?.getData("text/plain") || undefined;
                  onDropTo(col.key, dtId);
                }}
                className="space-y-3 min-h-[200px] p-2 rounded-lg"
              >
                {visibleItems.map((task: Task) => {
                  const isBeingDragged =
                    dragTaskId !== null && task.id === dragTaskId;
                  return (
                    <TaskCard
                      key={task.id}
                      task={task}
                      isBeingDragged={isBeingDragged}
                      dragPos={dragPos}
                      team={team}
                      onDragStart={onDragStart}
                      onDrag={onDrag}
                      onDragEnd={onDragEnd}
                      onSelectTask={onSelectTask}
                      startPointerDrag={startPointerDrag}
                      priorityAccent={priorityAccent}
                      priorityPill={priorityPill}
                    />
                  );
                })}

                {visibleItems.length === 0 && (
                  <div className="text-sm text-gray-400 py-6 text-center">
                    No tasks
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
