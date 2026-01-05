// frontend/src/components/ListView.tsx
import React, { useMemo, useState } from "react";
import parse from "html-react-parser";
import type { Task, TeamMember } from "../types";
import { getTaskAssignees } from "../utils/getTaskAssignees";

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

export default function ListView({
  columns,
  onSelectTask,
  team,
  currentMemberId, // pass from parent (useAuthStore().teamMemberId)
}: {
  columns: { key: Task["status"]; title: string; items: Task[] }[];
  onSelectTask: (t: Task) => void;
  team: TeamMember[];
  currentMemberId?: string | null;
}) {
  const [onlyMine, setOnlyMine] = useState(false);

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

  // find current member (for name fallback)
  const currentMember = useMemo(
    () => team.find((m) => String(m.id) === String(currentMemberId)),
    [team, currentMemberId]
  );

  // helper: check if a task is assigned to current member
  const isAssignedToCurrent = (t: Task) => {
    if (!currentMemberId) return false

    const assignees = getTaskAssignees(t, team)
    return assignees.some(
      m => String(m.id) === String(currentMemberId)
    )
  }


  // count assigned-to-me on all tasks
  const assignedCount = useMemo(
    () =>
      allTasks.reduce((acc, t) => (isAssignedToCurrent(t) ? acc + 1 : acc), 0),
    [allTasks, currentMemberId, team]
  );

  // apply "Assigned to me" filtering
  const visibleTasks = useMemo(() => {
    if (!onlyMine) return allTasks;
    return allTasks.filter(isAssignedToCurrent);
  }, [allTasks, onlyMine, currentMemberId, team]);

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

  // -------------------------
  // Date helpers (robust)
  // -------------------------
  // parse YYYY-MM-DD as local date (avoid timezone shifts), fallback to Date parse
  function parseDateOnlySafe(v?: string | null) {
    if (!v) return null;
    const s = String(v);
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const y = Number(m[1]);
      const mo = Number(m[2]) - 1;
      const d = Number(m[3]);
      return new Date(y, mo, d); // local midnight
    }
    const dt = new Date(s);
    if (Number.isNaN(dt.getTime())) return null;
    return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  }

  function formatDateShort(v?: string | null) {
    const dt = parseDateOnlySafe(v);
    if (!dt) return v ?? "—";
    return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  return (
    <div className="rounded-lg border border-gray-100 dark:border-gray-800 bg-slate-100 dark:bg-gray-900 overflow-auto">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-200">
            Tasks
          </div>
          <div className="text-xs text-gray-400">· {allTasks.length} total</div>
        </div>

        <div className="flex items-center gap-2">
          {/* Assigned to me button */}
          <button
            type="button"
            onClick={() => setOnlyMine((v) => !v)}
            aria-pressed={onlyMine}
            title="Show only tasks assigned to you"
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-md text-sm font-medium transition-colors focus:outline-none ${onlyMine
              ? "bg-sky-600 text-white border border-sky-600 shadow-sm"
              : "bg-white text-slate-700 dark:bg-gray-800 dark:text-slate-100 border border-gray-200 dark:border-gray-700"
              }`}
          >
            {/* icon */}{" "}
            <span
              className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs ${onlyMine ? "bg-white/20" : "bg-sky-100 dark:bg-white/5"
                }`}
              aria-hidden
            >
              👤
            </span>
            <span className="whitespace-nowrap">Assigned to me</span>
            <span
              className={`inline-flex items-center justify-center ml-1 px-2 py-0.5 rounded-full text-xs font-semibold ${onlyMine ? "bg-white/20" : "bg-gray-100 dark:bg-white/5"
                }`}
            >
              {assignedCount}
            </span>
          </button>

          {/* helper text */}
          <div className="text-xs text-gray-400 hidden sm:block">
            {onlyMine ? "Showing tasks assigned to you" : "Showing all tasks"}
          </div>
        </div>
      </div>

      <table className="w-full min-w-[800px]">
        <thead>
          <tr className="text-left text-sm text-gray-500 dark:text-gray-400">
            <th className="px-4 py-3">Title</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 md:min-w-40">Priority</th>
            <th className="px-4 py-3 md:min-w-40">Assignee</th>
            <th className="px-4 py-3 md:min-w-30">Start</th>
            <th className="px-4 py-3 md:min-w-30">Due</th>
          </tr>
        </thead>
        <tbody>
          {visibleTasks.map((t) => {
            const pill = priorityPill(t.priority);



            // start/due formatting & states
            const startShort = formatDateShort(t.startDate);
            const dueShort = formatDateShort(t.dueDate);
            const dueDateObj = parseDateOnlySafe(t.dueDate);
            const today = new Date();
            const todayMid = new Date(
              today.getFullYear(),
              today.getMonth(),
              today.getDate()
            );
            const isDueOverdue = dueDateObj
              ? dueDateObj.getTime() < todayMid.getTime()
              : false;
            const isDueToday = dueDateObj
              ? dueDateObj.getTime() === todayMid.getTime()
              : false;

            return (
              <tr
                key={t.id}
                className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                onClick={() => onSelectTask(t)}
              >
                <td className="px-4 py-3">
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {t.title}
                  </div>
                  {t.description && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                      {parse(t.description)}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                  {t.status}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-semibold tracking-wide ${pill.classes}`}
                  >
                    {pill.label}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {(() => {
                    const assignees = getTaskAssignees(t, team)

                    if (assignees.length === 0) {
                      return (
                        <div className="text-sm text-gray-400">Unassigned</div>
                      )
                    }

                    return (
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-2">
                          {assignees.slice(0, 4).map((m) => {
                            const hue = hashStr(m.name) % 360
                            const bg = m.photo
                              ? undefined
                              : typeof window !== "undefined" &&
                                document.documentElement.classList.contains("dark")
                                ? hslaStr(hue, 65, 50, 0.16)
                                : hslaStr(hue, 75, 85, 0.95)

                            const color = m.photo
                              ? undefined
                              : typeof window !== "undefined" &&
                                document.documentElement.classList.contains("dark")
                                ? hslStr(hue, 65, 80)
                                : hslStr(hue, 75, 25)

                            return (
                              <div
                                key={m.id}
                                className="w-8 h-8 rounded-full ring-2 ring-white dark:ring-gray-900 flex items-center justify-center text-xs font-semibold overflow-hidden"
                                style={{ background: bg, color }}
                                title={m.name}
                              >
                                {m.photo ? (
                                  <img
                                    src={m.photo}
                                    alt={m.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  m.name
                                    .split(" ")
                                    .map(n => n[0])
                                    .slice(0, 2)
                                    .join("")
                                    .toUpperCase()
                                )}
                              </div>
                            )
                          })}
                        </div>

                        <div className="text-sm text-slate-900 dark:text-slate-100 truncate max-w-[160px]">
                          {assignees.map(a => a.name).join(", ")}
                        </div>
                      </div>
                    )
                  })()}
                </td>


                {/* Start */}
                <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                  {t.startDate ? startShort : "-"}
                </td>

                {/* Due: render pill + warning */}
                <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                  {t.dueDate ? (
                    <div className="inline-flex items-center">
                      {/* pill */}
                      <div
                        className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${isDueOverdue
                          ? "bg-red-700/10 dark:bg-red-600/20 text-red-500 dark:text-red-300"
                          : isDueToday
                            ? "bg-amber-700/10 dark:bg-amber-600/20 text-amber-500 dark:text-amber-300"
                            : "bg-emerald-700/10 dark:bg-emerald-600/20 text-emerald-500 dark:text-emerald-300"
                          }`}
                        title={
                          isDueOverdue
                            ? `overdue • ${t.dueDate}`
                            : isDueToday
                              ? `due today • ${t.dueDate}`
                              : `Due: ${t.dueDate}`
                        }
                        aria-live="polite"
                      >
                        {/* icon */}
                        {isDueOverdue || isDueToday ? (
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
                            {dueShort}
                          </span>
                          {(isDueOverdue || isDueToday) && (
                            <span
                              className={`text-[11px] ${isDueOverdue ? "text-red-300" : "text-amber-300"
                                }`}
                            >
                              {isDueOverdue ? "overdue" : "due today"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            );
          })}
          {visibleTasks.length === 0 && (
            <tr>
              <td
                className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400"
                colSpan={7}
              >
                No tasks
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
