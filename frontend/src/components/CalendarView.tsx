import React, { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
} from "lucide-react";
import type { Task, TeamMember } from "../types";

type Props = {
  tasks: Task[];
  team: TeamMember[];
  onSelectTask?: (task: Task) => void;
};

const STATUS_COLORS: Record<string, string> = {
  todo: "#6b7280",
  inprogress: "#3b82f6",
  qa: "#a855f7",
  deploy: "#f59e0b",
  done: "#10b981",
  blocked: "#ef4444",
};

const PRIORITY_RING: Record<string, string> = {
  urgent: "ring-2 ring-red-400",
  medium: "ring-2 ring-amber-400",
  low: "ring-2 ring-emerald-400",
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export default function CalendarView({ tasks, team, onSelectTask }: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Build calendar grid
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = firstDay.getDay();
  const totalDays = lastDay.getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  // Map dates to tasks
  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      if (task.isTrash) continue;
      const dates: Date[] = [];
      const sd = parseDate(task.startDate);
      const dd = parseDate(task.dueDate);
      if (dd) dates.push(dd);
      else if (sd) dates.push(sd);
      for (const d of dates) {
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(task);
      }
    }
    return map;
  }, [tasks]);

  const getTasksForDate = (d: Date) => {
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    return tasksByDate.get(key) ?? [];
  };

  const prev = () => {
    if (month === 0) {
      setMonth(11);
      setYear(year - 1);
    } else setMonth(month - 1);
  };
  const next = () => {
    if (month === 11) {
      setMonth(0);
      setYear(year + 1);
    } else setMonth(month + 1);
  };
  const goToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
    setSelectedDate(today);
  };

  const selectedTasks = selectedDate ? getTasksForDate(selectedDate) : [];

  return (
    <div className="flex flex-col lg:flex-row gap-6 p-6 max-w-full overflow-auto">
      {/* Calendar Grid */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <CalendarIcon size={22} className="text-sky-500" />
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
              {MONTHS[month]} {year}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={goToday}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-sky-50 text-sky-600 hover:bg-sky-100 dark:bg-sky-900/30 dark:text-sky-300 dark:hover:bg-sky-900/50 transition-colors"
            >
              Today
            </button>
            <button
              onClick={prev}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <ChevronLeft size={18} className="text-gray-500" />
            </button>
            <button
              onClick={next}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <ChevronRight size={18} className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAYS.map((d) => (
            <div
              key={d}
              className="text-center text-xs font-semibold text-gray-400 dark:text-gray-500 py-2"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Date cells */}
        <div className="grid grid-cols-7 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          {cells.map((cell, i) => {
            if (!cell) {
              return (
                <div
                  key={`empty-${i}`}
                  className="min-h-[90px] bg-gray-50/50 dark:bg-gray-900/30 border-b border-r border-gray-100 dark:border-gray-800"
                />
              );
            }
            const dayTasks = getTasksForDate(cell);
            const isToday = isSameDay(cell, today);
            const isSelected = selectedDate && isSameDay(cell, selectedDate);
            return (
              <div
                key={i}
                onClick={() => setSelectedDate(cell)}
                className={`min-h-[90px] p-1.5 border-b border-r border-gray-100 dark:border-gray-800 cursor-pointer transition-colors
                  ${isSelected ? "bg-sky-50 dark:bg-sky-900/20" : "hover:bg-gray-50 dark:hover:bg-gray-800/50"}
                `}
              >
                <div
                  className={`text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full
                  ${isToday ? "bg-sky-500 text-white" : "text-gray-600 dark:text-gray-400"}
                `}
                >
                  {cell.getDate()}
                </div>
                <div className="space-y-0.5">
                  {dayTasks.slice(0, 3).map((t) => (
                    <div
                      key={t.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectTask?.(t);
                      }}
                      className="text-[10px] leading-tight truncate px-1.5 py-0.5 rounded-md font-medium text-white cursor-pointer hover:opacity-80 transition-opacity"
                      style={{ background: STATUS_COLORS[t.status ?? "todo"] }}
                      title={t.title}
                    >
                      {t.title}
                    </div>
                  ))}
                  {dayTasks.length > 3 && (
                    <div className="text-[10px] text-gray-400 dark:text-gray-500 pl-1">
                      +{dayTasks.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Side panel - selected date details */}
      <div className="w-full lg:w-80 shrink-0">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-4">
          <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-3">
            {selectedDate
              ? `${MONTHS[selectedDate.getMonth()]} ${selectedDate.getDate()}, ${selectedDate.getFullYear()}`
              : "Select a date"}
          </h3>
          {!selectedDate && (
            <p className="text-xs text-gray-400">
              Click on a date to see tasks
            </p>
          )}
          {selectedDate && selectedTasks.length === 0 && (
            <p className="text-xs text-gray-400">No tasks on this date</p>
          )}
          <div className="space-y-2 mt-2 max-h-[60vh] overflow-y-auto">
            {selectedTasks.map((task) => {
              const assignees = (task.taskAssignees ?? [])
                .map((a: any) =>
                  team.find((m) => m.id === (a.memberId ?? a.id)),
                )
                .filter(Boolean);
              return (
                <div
                  key={task.id}
                  onClick={() => onSelectTask?.(task)}
                  className={`p-3 rounded-xl border border-gray-100 dark:border-gray-700 cursor-pointer
                    hover:shadow-md transition-all ${PRIORITY_RING[task.priority ?? "low"] ?? ""}`}
                >
                  <div className="flex items-start gap-2">
                    <div
                      className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                      style={{
                        background: STATUS_COLORS[task.status ?? "todo"],
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
                        {task.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full text-white font-semibold"
                          style={{
                            background: STATUS_COLORS[task.status ?? "todo"],
                          }}
                        >
                          {task.status}
                        </span>
                        {task.priority && (
                          <span className="text-[10px] text-gray-400 capitalize">
                            {task.priority}
                          </span>
                        )}
                      </div>
                      {(
                        task.labels as
                          | { name: string; color: string }[]
                          | undefined
                      )?.length ? (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {(
                            task.labels as { name: string; color: string }[]
                          ).map((lb, i) => (
                            <span
                              key={i}
                              className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold text-white"
                              style={{ background: lb.color }}
                            >
                              {lb.name}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {assignees.length > 0 && (
                        <div className="flex items-center gap-1 mt-2">
                          {assignees.slice(0, 3).map((m: any) => (
                            <div
                              key={m.id}
                              className="w-5 h-5 rounded-full bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center text-[9px] text-white font-bold"
                              title={m.name}
                            >
                              {m.name?.[0]?.toUpperCase() ?? "?"}
                            </div>
                          ))}
                          {assignees.length > 3 && (
                            <span className="text-[10px] text-gray-400">
                              +{assignees.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
