// frontend/src/components/KanbanBoard.tsx
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

export default function KanbanBoard({
  columns,
  onDropTo,
  onDragStart,
  onSelectTask,
  team,
  currentMemberId,
}: {
  columns: { key: Task["status"]; title: string; items: Task[] }[];
  onDropTo: (s: Task["status"]) => void;
  onDragStart: (id: string) => void;
  onSelectTask: (t: Task) => void;
  team: TeamMember[];
  currentMemberId?: string | null;
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

  // flatten all tasks for counting/filtering purpose
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

  // quick lookup for current member name (fallback when tasks only store assigneeName)
  const currentMember = useMemo(
    () => team.find((m) => String(m.id) === String(currentMemberId)),
    [team, currentMemberId]
  );
  const currentMemberName = currentMember?.name ?? null;

  // helper to determine if task belongs to current member
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
      allTasks.reduce((acc, t) => (isAssignedToCurrent(t) ? acc + 1 : acc), 0),
    [allTasks, currentMemberId, team]
  );

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Board
          </h3>
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
            <span
              className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs ${
                onlyMine ? "bg-white/20" : "bg-sky-100 dark:bg-white/5"
              }`}
              aria-hidden
            >
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
          // apply "Assigned to me" filter on this column's items
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
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDropTo(col.key)}
                className="space-y-3 min-h-[200px] p-2 rounded-lg"
              >
                {visibleItems.map((task) => {
                  const pill = priorityPill(task.priority);

                  // --- derive assignee info robustly ---
                  const assigneeId = (task as any).assigneeId ?? null;
                  const assigneeNameFromTask = task.assigneeName ?? "";
                  const member =
                    (assigneeId && team.find((m) => m.id === assigneeId)) ??
                    (assigneeNameFromTask &&
                      team.find((m) => m.name === assigneeNameFromTask)) ??
                    undefined;
                  const assigneeLabel =
                    member?.name ?? assigneeNameFromTask ?? "";

                  const hue = assigneeLabel
                    ? hashStr(assigneeLabel) % 360
                    : 200;
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
                    <div
                      key={task.id}
                      draggable
                      onDragStart={() => onDragStart(task.id)}
                      onClick={() => onSelectTask(task)}
                      className="relative flex flex-col gap-3 p-2 rounded-xl cursor-pointer transform transition-all duration-150 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm hover:scale-[1.01] hover:shadow-lg"
                      style={{ border: "1px solid rgba(15,23,42,0.04)" }}
                    >
                      <div
                        className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${priorityAccent(
                          task.priority
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

                        <div className="flex justify-between items-center mt-2">
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-xs font-semibold tracking-wide ${pill.classes}`}
                          >
                            {pill.label}
                          </span>

                          <div className="flex items-center gap-3">
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                              {task.startDate ? `Start: ${task.startDate}` : ""}
                            </span>
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                              {task.dueDate ? `Due: ${task.dueDate}` : ""}
                            </span>
                          </div>
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
