import React, { useRef, useEffect, useState } from "react";
import type { Task, TeamMember } from "../types";
import parse from "html-react-parser";
import { getAssigneeIds } from "../utils/getAssigneeIds";
import { getTaskAssignees } from "../utils/getTaskAssignees";

function hashStr(s?: string) {
  if (!s) return 0;
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

function formatDateShort(d: any) {
  if (!d) return null;
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function toMidnightDate(d?: string | Date | null) {
  if (!d) return null;
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return null;
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

function parseDateOnlySafe(v?: string | null) {
  if (!v) return null;
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    return new Date(y, mo, d);
  }
  const dt = new Date(v);
  if (Number.isNaN(dt.getTime())) return null;
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

function relativeInfo(d: any) {
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

export const TaskCard = React.memo(
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

    const assignees = getTaskAssignees(task, team);

    // measure height to create a placeholder when dragging so layout doesn't jump
    const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);
    const elRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
      const measure = () => {
        try {
          const el = document.getElementById(
            `taskcard-${task.id}`,
          ) as HTMLElement | null;
          if (el) {
            const h = el.getBoundingClientRect().height;
            setMeasuredHeight(h);
          }
        } catch (e) {
          // ignore
        }
      };

      // measure on mount and when content changes
      measure();

      // simple resize observer to keep measurement up to date when not dragging
      let ro: ResizeObserver | undefined;
      try {
        ro = new ResizeObserver(() => {
          // only update measurement when not dragging (we want placeholder size from original flow)
          if (!isBeingDragged) measure();
        });
        if (elRef.current) ro.observe(elRef.current);
        else {
          const el = document.getElementById(`taskcard-${task.id}`);
          if (el) ro.observe(el);
        }
      } catch (e) {
        // ResizeObserver not available -> ignore
      }

      return () => ro?.disconnect();
      // include comments in deps so measurement updates when comments are added/removed
    }, [
      task.id,
      task.title,
      (task as any).description,
      JSON.stringify((task as any).comments || []),
    ]);

    const origRectRef = useRef<{ left: number; top: number } | null>(null);
    useEffect(() => {
      if (isBeingDragged) {
        try {
          const el = document.getElementById(
            `taskcard-${task.id}`,
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
        pointerDownRef.current = null;
        pointerIdRef.current = null;
      };
    }, []);

    const onPointerDownLocal = (e: React.PointerEvent) => {
      if (e.button && e.button !== 0) return;
      // prevent the browser from moving focus/scrolling when pointerdown occurs
      // this avoids an immediate scroll that would make our initial dragPos stale.
      e.preventDefault();

      const el = e.currentTarget as HTMLElement;
      try {
        // prevent default focus behavior; also capture pointer
        // setPointerCapture may still throw in some browsers so we wrap
        el.setPointerCapture?.(e.pointerId);
      } catch (err) {
        // ignore
      }

      // temporarily disable native touch/gesture scrolling on this element
      // (this helps on touch devices where touch may start scroll even though pointer starts drag)
      const prevTouchAction = el.style.touchAction;
      el.style.touchAction = "none";

      pointerDownRef.current = { x: e.clientX, y: e.clientY };
      pointerIdRef.current = e.pointerId;

      const onMove = (ev: PointerEvent) => {
        if (!pointerDownRef.current) return;
        const dx = ev.clientX - pointerDownRef.current.x;
        const dy = ev.clientY - pointerDownRef.current.y;
        const dist2 = dx * dx + dy * dy;
        if (dist2 > 25) {
          suppressClickRef.current = true;
          // capture measured height BEFORE starting pointer drag so placeholder size is accurate
          try {
            const elNow = document.getElementById(
              `taskcard-${task.id}`,
            ) as HTMLElement | null;
            if (elNow) {
              // trigger measurement in TaskCard effect (or set via ref)
              // we'll still call parent's startPointerDrag so it can set drag state
            }
          } catch (err) {
            console.log(err);
          }

          // call parent's pointer-based drag start once
          startPointerDrag(task.id, ev.clientX, ev.clientY, el);

          // remove move listener (parent will handle pointer moves)
          window.removeEventListener("pointermove", onMove);
        }
      };

      const onUp = (ev: PointerEvent) => {
        try {
          el.releasePointerCapture?.(pointerIdRef.current ?? 0);
        } catch (e) {
          // ignore
        }
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);

        // restore touch-action after pointer up
        try {
          el.style.touchAction = prevTouchAction || "";
        } catch (e) {
          console.log(e);
        }

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
          boxSizing: "border-box",
          zIndex: 9999,
          pointerEvents: "none" as const,
          willChange: "transform" as const,
          transition: "none",
        }
      : {};

    return (
      <>
        {/* placeholder keeps layout stable while the real card is fixed and follows pointer */}
        {isBeingDragged && (
          <div
            aria-hidden
            style={{
              height: measuredHeight ? `${measuredHeight}px` : undefined,
              minHeight: measuredHeight ? undefined : 56,
              marginBottom: 8,
              width: dragPos?.width ? `${dragPos.width}px` : undefined,
              boxSizing: "border-box",
              pointerEvents: "none",
            }}
          />
        )}

        <div
          ref={elRef}
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
          onPointerDown={onPointerDownLocal}
          onClick={handleClick}
          className={
            "relative flex flex-col gap-3 p-3 rounded-xl cursor-pointer bg-white dark:bg-gray-800/80 shadow-sm border border-gray-100 dark:border-gray-700/40 hover:shadow-md hover:border-sky-200/60 dark:hover:border-sky-700/40 hover:scale-[1.01] " +
            (isBeingDragged ? "" : "transform transition-all duration-150")
          }
          style={{
            ...(draggedStyles as any),
          }}
        >
          <div
            className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${priorityAccent(
              task.priority,
            )}`}
          />

          <div className="flex flex-col gap-2 pl-2">
            <div className="font-medium text-base text-slate-900 dark:text-slate-100 truncate">
              {task.title}
            </div>

            {task.description && (
              <div className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                {parse(task.description)}
              </div>
            )}

            <div className="mt-2 flex flex-wrap gap-1.5 items-center">
              <span
                className={`inline-block px-3 py-1 rounded-full text-xs font-semibold tracking-wide ${pill.classes}`}
              >
                {pill.label}
              </span>
              {(
                task.labels as { name: string; color: string }[] | undefined
              )?.map((lb, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded-full text-[10px] font-semibold text-white"
                  style={{ background: lb.color }}
                >
                  {lb.name}
                </span>
              ))}
            </div>

            <div className="flex gap-2 flex-wrap mt-1">
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

              {task.dueDate
                ? (() => {
                    const due = parseDateOnlySafe(task.dueDate);
                    if (!due) return null;

                    const now = new Date();
                    const today = new Date(
                      now.getFullYear(),
                      now.getMonth(),
                      now.getDate(),
                    );

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
            {assignees.length === 0 ? (
              <div className="text-sm text-slate-400">Unassigned</div>
            ) : (
              <>
                <div className="flex -space-x-2">
                  {assignees.slice(0, 3).map((m: any) => {
                    const hue = hashStr(m.name) % 360;
                    const avatarBg = m.photo
                      ? undefined
                      : typeof window !== "undefined" &&
                          document.documentElement.classList.contains("dark")
                        ? hslaStr(hue, 65, 50, 0.16)
                        : hslaStr(hue, 75, 85, 0.95);
                    const avatarText = m.photo
                      ? undefined
                      : typeof window !== "undefined" &&
                          document.documentElement.classList.contains("dark")
                        ? hslStr(hue, 65, 80)
                        : hslStr(hue, 75, 25);

                    return (
                      <div
                        key={m.id}
                        className="w-8 h-8 rounded-full border border-white flex items-center justify-center text-xs font-semibold overflow-hidden"
                        style={{ background: avatarBg, color: avatarText }}
                        title={m.name}
                      >
                        {m.photo ? (
                          <img
                            src={m.photo}
                            alt={m.name}
                            className="w-full h-full object-cover rounded-full"
                          />
                        ) : (
                          m.name
                            .split(" ")
                            .map((n: string) => n[0])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase()
                        )}
                      </div>
                    );
                  })}

                  {assignees.length > 3 && (
                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 text-xs flex items-center justify-center border border-white">
                      +{assignees.length - 3}
                    </div>
                  )}
                </div>

                <div className="text-sm text-slate-900 dark:text-slate-100 truncate max-w-[140px]">
                  {assignees.map((m: any) => m.name).join(", ")}
                </div>
              </>
            )}
          </div>
        </div>
      </>
    );
  },
  (prev, next) => {
    // identity
    if (prev.task.id !== next.task.id) return false;

    // primitive fields
    if (prev.task.title !== next.task.title) return false;
    if ((prev.task as any).description !== (next.task as any).description)
      return false;
    if (prev.task.priority !== next.task.priority) return false;
    if (prev.task.startDate !== next.task.startDate) return false;
    if (prev.task.dueDate !== next.task.dueDate) return false;
    if (prev.task.status !== next.task.status) return false;
    if (
      JSON.stringify(prev.task.taskAssignees) !==
      JSON.stringify(next.task.taskAssignees)
    )
      return false;
    // ✅ MULTI-ASSIGNEE SAFE COMPARISON
    const prevAssignees = getAssigneeIds(prev.task);
    const nextAssignees = getAssigneeIds(next.task);

    if (prevAssignees.length !== nextAssignees.length) return false;
    for (let i = 0; i < prevAssignees.length; i++) {
      if (prevAssignees[i] !== nextAssignees[i]) return false;
    }

    // --- comments comparison (cheap & robust) ---
    const prevComments: any[] = Array.isArray((prev.task as any).comments)
      ? (prev.task as any).comments
      : [];
    const nextComments: any[] = Array.isArray((next.task as any).comments)
      ? (next.task as any).comments
      : [];

    if (prevComments.length !== nextComments.length) return false;

    const getLastCreatedAt = (arr: any[]) =>
      arr.length === 0
        ? null
        : arr
            .map((c: any) => c?.createdAt ?? c?.created_at ?? null)
            .filter(Boolean)
            .sort()
            .slice(-1)[0];

    if (
      String(getLastCreatedAt(prevComments)) !==
      String(getLastCreatedAt(nextComments))
    )
      return false;

    // dragging state
    if (prev.isBeingDragged !== next.isBeingDragged) return false;

    if (prev.isBeingDragged) {
      return (
        prev.dragPos.x === next.dragPos.x &&
        prev.dragPos.y === next.dragPos.y &&
        prev.dragPos.width === next.dragPos.width
      );
    }

    return true;
  },
);
