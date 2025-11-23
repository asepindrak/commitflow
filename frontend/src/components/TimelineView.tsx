// frontend/src/components/TimelineView.tsx
import React, { useMemo, useState } from "react";
import parse from "html-react-parser";
import type { Task, TeamMember } from "../types";

/**
 * TimelineView
 * - horizontal calendar (day grid)
 * - lanes = tasks (one row per task)
 * - bars positioned by startDate / dueDate
 *
 * Notes:
 * - expects dates in "YYYY-MM-DD" or any format parseable by `new Date(...)`
 * - if a task doesn't have startDate, it uses dueDate or minDate
 * - if a task doesn't have dueDate, it uses startDate or minDate (and width = 1 day)
 */

function parseDate(d?: string | null) {
  if (!d) return null;
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  // clear time part
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}
function daysBetween(a: Date, b: Date) {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((b.getTime() - a.getTime()) / msPerDay);
}
function addDays(a: Date, days: number) {
  const r = new Date(a);
  r.setDate(r.getDate() + days);
  return r;
}

// color helpers (hue-per-assignee or priority colored)
function hashStr(s: string) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return Math.abs(h);
}
function hueFromName(name: string) {
  return hashStr(name) % 360;
}
function priorityColor(priority?: Task["priority"]) {
  if (priority === "urgent") return { bg: "bg-red-500", shade: "bg-red-600" };
  if (priority === "medium")
    return { bg: "bg-amber-400", shade: "bg-amber-500" };
  return { bg: "bg-emerald-400", shade: "bg-emerald-500" };
}

export default function TimelineView({
  columns,
  onSelectTask,
  team,
  currentMemberId, // optional: id of currently authenticated team member
}: {
  columns: { key: Task["status"]; title: string; items: Task[] }[];
  onSelectTask: (t: Task) => void;
  team?: TeamMember[];
  currentMemberId?: string | null;
}) {
  // flatten tasks
  const tasksAll = useMemo(
    () =>
      columns.flatMap((c) =>
        c.items.map(
          (it) =>
            ({ ...it, status: c.key } as Task & { status: Task["status"] })
        )
      ),
    [columns]
  );

  // local filter state: show only tasks assigned to me
  const [onlyMine, setOnlyMine] = useState(false);

  // helper to determine if task is assigned to current member
  const isAssignedToMe = (t: Task) => {
    if (!currentMemberId) return false;
    // direct id match
    if (
      (t as any).assigneeId &&
      String((t as any).assigneeId) === String(currentMemberId)
    )
      return true;
    // fallback: if assigneeName present, resolve my member name and compare
    if (t.assigneeName && Array.isArray(team)) {
      const myMember = team.find((m) => m.id === currentMemberId);
      if (myMember && myMember.name && myMember.name === t.assigneeName)
        return true;
      // also, if assigneeName equals current user's name (even if team not found)
      if (myMember && myMember.name && myMember.name === t.assigneeName)
        return true;
    }
    return false;
  };

  // tasks after applying "Assigned to me" filter
  const tasks = useMemo(() => {
    if (!onlyMine) return tasksAll;
    return tasksAll.filter(isAssignedToMe);
  }, [tasksAll, onlyMine, currentMemberId, team]);

  // collect date range
  const { startDate, endDate, days } = useMemo(() => {
    const allDates: Date[] = [];
    tasksAll.forEach((t) => {
      const s = parseDate(t.startDate) ?? parseDate(t.dueDate);
      const e = parseDate(t.dueDate) ?? parseDate(t.startDate);
      if (s) allDates.push(s);
      if (e) allDates.push(e);
    });
    // if nothing provided, use today as single-day range
    const fallback = new Date();
    const min = allDates.length
      ? new Date(Math.min(...allDates.map((d) => d.getTime())))
      : fallback;
    const max = allDates.length
      ? new Date(Math.max(...allDates.map((d) => d.getTime())))
      : fallback;

    // expand a little padding
    const paddedMin = addDays(min, -3);
    const paddedMax = addDays(max, 3);

    const totalDays = daysBetween(paddedMin, paddedMax) + 1;
    return { startDate: paddedMin, endDate: paddedMax, days: totalDays };
  }, [tasksAll]);

  // layout settings
  const DAY_WIDTH = 28; // px per day (adjust for density)
  const timelineWidth = Math.max(800, days * DAY_WIDTH);

  // group tasks into lanes (simple: one lane per task in order)
  const lanes = tasks; // can change grouping later

  // count assigned-to-me on all tasks (useful for toggle label)
  const assignedCount = tasksAll.reduce(
    (acc, t) => (isAssignedToMe(t) ? acc + 1 : acc),
    0
  );

  return (
    <div className="rounded-lg border border-gray-100 dark:border-gray-800 bg-slate-100 dark:bg-gray-900 p-3 overflow-auto">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Timeline
          </div>
          <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Project Timeline
          </div>
        </div>

        <div className="flex items-center gap-3">
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

          <div className="text-xs text-gray-500 dark:text-gray-400">
            Drag not implemented (read-only)
          </div>
        </div>
      </div>

      {/* header: months + day row */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: timelineWidth }} className="relative">
          {/* Month labels */}
          <div className="flex">
            {Array.from({ length: days }).map((_, i) => {
              const d = addDays(startDate, i);
              // month label at first of month
              const isFirstOfMonth = d.getDate() === 1;
              return (
                <div
                  key={`month-${i}`}
                  style={{ width: DAY_WIDTH }}
                  className={`text-xs h-8 flex items-center justify-center ${
                    isFirstOfMonth
                      ? "font-semibold text-gray-700 dark:text-gray-200"
                      : "text-gray-400 dark:text-gray-400"
                  }`}
                >
                  {isFirstOfMonth
                    ? d.toLocaleString(undefined, {
                        month: "short",
                        year: "numeric",
                      })
                    : ""}
                </div>
              );
            })}
          </div>

          {/* Day numbers */}
          <div className="flex border-b border-gray-200 dark:border-gray-800">
            {Array.from({ length: days }).map((_, i) => {
              const d = addDays(startDate, i);
              const weekday = d
                .toLocaleDateString(undefined, { weekday: "short" })
                .slice(0, 1); // first letter
              const day = d.getDate();
              const isWeekend = d.getDay() === 0 || d.getDay() === 6;
              return (
                <div
                  key={`day-${i}`}
                  style={{ width: DAY_WIDTH }}
                  className={`text-[11px] h-8 flex flex-col items-center justify-center ${
                    isWeekend ? "bg-gray-50 dark:bg-gray-800/60" : ""
                  }`}
                >
                  <div className="text-xs text-gray-400">{weekday}</div>
                  <div
                    className={`text-sm ${
                      isWeekend
                        ? "text-gray-500 dark:text-gray-300"
                        : "text-gray-600 dark:text-gray-200"
                    }`}
                  >
                    {day}
                  </div>
                </div>
              );
            })}
          </div>

          {/* lanes */}
          <div className="mt-3 space-y-3 pb-6">
            {lanes.map((task, idx) => {
              // compute start & end for positioning
              const s =
                parseDate(task.startDate) ??
                parseDate(task.dueDate) ??
                startDate;
              const e =
                parseDate(task.dueDate) ?? parseDate(task.startDate) ?? s;
              const clampedStart = s < startDate ? startDate : s;
              const clampedEnd = e > endDate ? endDate : e;
              const offsetDays = daysBetween(startDate, clampedStart);
              const spanDays = Math.max(
                1,
                daysBetween(clampedStart, clampedEnd) + 1
              );

              const leftPx = offsetDays * DAY_WIDTH;
              const widthPx = spanDays * DAY_WIDTH;

              const priority = priorityColor(task.priority);
              const assignee = task.assigneeName ?? "Unassigned";
              const hue = hueFromName(assignee);
              const avatarBg = `hsla(${hue} 65% 40% / 0.12)`;
              const avatarText = `hsl(${hue} 65% 35%)`;

              return (
                <div
                  key={task.id}
                  className="relative"
                  style={{ minWidth: timelineWidth }}
                >
                  {/* lane label (left) */}
                  <div className="absolute left-0 -translate-x-full mr-4 w-56 hidden md:block">
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">
                      {task.title}
                    </div>
                    <div className="text-xs text-gray-400 truncate">
                      {task.assigneeName ?? "Unassigned"}
                    </div>
                  </div>

                  {/* background row (grid) */}
                  <div
                    className="h-14 rounded-md border border-transparent hover:border-gray-200 dark:hover:border-gray-800 relative"
                    style={{ marginLeft: 0 }}
                  >
                    {/* grid on the row: (render subtle vertical separators) */}
                    <div className="absolute inset-0 flex">
                      {Array.from({ length: days }).map((_, i) => (
                        <div
                          key={i}
                          style={{ width: DAY_WIDTH }}
                          className={`h-full ${
                            i % 7 === 0
                              ? "border-r border-gray-100 dark:border-gray-800/60"
                              : "border-r border-transparent"
                          }`}
                        />
                      ))}
                    </div>

                    {/* task bar */}
                    <div
                      className={`absolute top-2 left-0 h-10 rounded-lg shadow`}
                      style={{
                        transform: `translateX(${leftPx}px)`,
                        width: `${Math.max(16, widthPx - 4)}px`,
                        background:
                          task.priority === "urgent"
                            ? "linear-gradient(90deg,#fb7185,#ef4444)"
                            : task.priority === "medium"
                            ? "linear-gradient(90deg,#fbbf24,#f59e0b)"
                            : "linear-gradient(90deg,#34d399,#10b981)",
                        color: "white",
                        padding: "6px 10px",
                        cursor: "pointer",
                      }}
                      title={`${task.title} — ${
                        task.assigneeName ?? "Unassigned"
                      } — ${task.startDate ?? ""} → ${task.dueDate ?? ""}`}
                      onClick={() => onSelectTask(task)}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 9999,
                            background: avatarBg,
                            boxShadow: "none",
                          }}
                        />
                        <div
                          className="text-sm font-semibold truncate"
                          style={{ maxWidth: Math.max(60, widthPx - 80) }}
                        >
                          {task.title}
                        </div>
                        <div className="text-xs opacity-90 ml-2">
                          {task.priority ?? "low"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {lanes.length === 0 && (
              <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                No tasks to show
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
