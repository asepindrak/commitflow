// frontend/src/components/ListView.tsx
import React, { useMemo, useState } from "react";
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
    const aid = (t as any).assigneeId ?? null;
    const aname = (t as any).assigneeName ?? null;

    if (aid && currentMemberId && String(aid) === String(currentMemberId))
      return true;
    if (
      currentMember?.name &&
      aname &&
      String(aname).toLowerCase() === String(currentMember.name).toLowerCase()
    )
      return true;
    return false;
  };

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

  return (
    <div className="rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-auto">
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
            <th className="px-4 py-3">Priority</th>
            <th className="px-4 py-3">Assignee</th>
            <th className="px-4 py-3">Start</th>
            <th className="px-4 py-3">Due</th>
          </tr>
        </thead>
        <tbody>
          {visibleTasks.map((t) => {
            const pill = priorityPill(t.priority);

            // derive assignee robustly: prefer assigneeId, fallback to assigneeName
            const assigneeId = (t as any).assigneeId ?? null;
            const assigneeNameFromTask = t.assigneeName ?? "";
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
                  <div className="flex items-center gap-3">
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
                </td>
                <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                  {t.startDate || "-"}
                </td>
                <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                  {t.dueDate || "-"}
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
