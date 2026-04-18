import React, { useEffect, useMemo, useState } from "react";
import { Grid, List, Clock, Search, X, ChevronDown } from "lucide-react";
import KanbanBoard from "./KanbanBoard";
import ListView from "./ListView";
import TimelineView from "./TimelineView";
import type { Task, TeamMember } from "../types";

const STATUS_OPTIONS: { key: Task["status"]; label: string; color: string }[] =
  [
    { key: "todo", label: "Todo", color: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200" },
    { key: "inprogress", label: "In Progress", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
    { key: "qa", label: "QA", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
    { key: "deploy", label: "Deploy", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
    { key: "done", label: "Done", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
    { key: "blocked", label: "Blocked", color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  ];

const PRIORITY_OPTIONS: { key: string; label: string; color: string }[] = [
  { key: "urgent", label: "🔥 Urgent", color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  { key: "medium", label: "⚡ Medium", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  { key: "low", label: "🌿 Low", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
];

export default function TaskView({
  currentMemberId,
  columns,
  onDropTo,
  onDragStart,
  onDrag,
  onDragEnd,
  dragPos,
  dragTaskId,
  onSelectTask,
  team,
  startPointerDrag,
}: {
  currentMemberId: any;
  columns: { key: Task["status"]; title: string; items: Task[] }[];
  onDropTo: (
    s: Task["status"],
    draggedId?: string,
    insertIndex?: number
  ) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDrag: (e: React.DragEvent) => void;
  onDragEnd: (e: React.DragEvent) => void;
  dragPos: { x: number; y: number; width: number };
  dragTaskId: string | null;
  onSelectTask: (t: Task) => void;
  team: TeamMember[];
  startPointerDrag: (id: string, x: number, y: number, target: any) => void;
}) {
  const STORAGE_KEY = "taskview_mode_v1";
  const [view, setView] = useState<"kanban" | "list" | "timeline">(() => {
    try {
      return (localStorage.getItem(STORAGE_KEY) as any) || "kanban";
    } catch {
      return "kanban";
    }
  });

  // ─── Filter state ───
  const [filterKeyword, setFilterKeyword] = useState("");
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
  const [filterPriorities, setFilterPriorities] = useState<string[]>([]);
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [showStatusFilter, setShowStatusFilter] = useState(false);
  const [showPriorityFilter, setShowPriorityFilter] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, view);
    } catch {
      console.log("local storage error");
    }
  }, [view]);

  const hasActiveFilter =
    filterKeyword.trim() !== "" ||
    filterStatuses.length > 0 ||
    filterPriorities.length > 0 ||
    filterDateFrom !== "" ||
    filterDateTo !== "";

  const clearAll = () => {
    setFilterKeyword("");
    setFilterStatuses([]);
    setFilterPriorities([]);
    setFilterDateFrom("");
    setFilterDateTo("");
  };

  const toggleStatus = (key: string) => {
    setFilterStatuses((prev) =>
      prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]
    );
  };

  const togglePriority = (key: string) => {
    setFilterPriorities((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  };

  // ─── Apply filters ───
  const filteredColumns = useMemo(() => {
    const kw = filterKeyword.trim().toLowerCase();
    return columns.map((col) => {
      let items = col.items;

      // keyword filter
      if (kw) {
        items = items.filter(
          (t) =>
            t.title?.toLowerCase().includes(kw) ||
            (t.description ?? "").toLowerCase().includes(kw)
        );
      }

      // status filter (filter which columns show items)
      if (filterStatuses.length > 0) {
        if (!filterStatuses.includes(col.key as string)) {
          items = [];
        }
      }

      // priority filter
      if (filterPriorities.length > 0) {
        items = items.filter((t) =>
          filterPriorities.includes(t.priority ?? "low")
        );
      }

      // date filter (matches start OR due date)
      if (filterDateFrom || filterDateTo) {
        items = items.filter((t) => {
          const dates = [t.startDate, t.dueDate].filter(Boolean) as string[];
          if (dates.length === 0) return false;
          return dates.some((d) => {
            const dt = new Date(d).getTime();
            const from = filterDateFrom ? new Date(filterDateFrom).getTime() : -Infinity;
            const to = filterDateTo ? new Date(filterDateTo).getTime() : Infinity;
            return dt >= from && dt <= to;
          });
        });
      }

      return { ...col, items };
    });
  }, [columns, filterKeyword, filterStatuses, filterPriorities, filterDateFrom, filterDateTo]);

  const totalFiltered = filteredColumns.reduce((s, c) => s + c.items.length, 0);
  const totalAll = columns.reduce((s, c) => s + c.items.length, 0);

  return (
    <div className="space-y-0">
      {/* ─── Header ─── */}
      <div className="flex items-center gap-3 flex-wrap mb-4">
        {/* Title */}
        <div className="shrink-0 mr-1">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 leading-tight">Tasks</h3>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {hasActiveFilter
              ? `${totalFiltered} of ${totalAll} tasks`
              : `${totalAll} tasks`}
          </p>
        </div>

        {/* ── Search ── */}
        <div className="flex items-center gap-1.5 flex-1 min-w-[180px] max-w-xs relative">
          <Search size={14} className="absolute left-3 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={filterKeyword}
            onChange={(e) => setFilterKeyword(e.target.value)}
            placeholder="Search tasks…"
            className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 text-sm outline-none focus:border-sky-400 dark:focus:border-sky-500 transition-colors placeholder-gray-300 dark:placeholder-gray-600"
          />
          {filterKeyword && (
            <button
              onClick={() => setFilterKeyword("")}
              className="absolute right-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* ── Status filter ── */}
        <div className="relative">
          <button
            onClick={() => { setShowStatusFilter((v) => !v); setShowPriorityFilter(false); setShowDateFilter(false); }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-medium transition-all ${
              filterStatuses.length > 0
                ? "border-sky-400 bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300 dark:border-sky-500"
                : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
            }`}
          >
            <span>Status</span>
            {filterStatuses.length > 0 && (
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-sky-500 text-white text-[10px] font-bold">
                {filterStatuses.length}
              </span>
            )}
            <ChevronDown size={13} className={`transition-transform ${showStatusFilter ? "rotate-180" : ""}`} />
          </button>

          {showStatusFilter && (
            <div className="absolute top-full left-0 mt-1.5 z-30 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-xl shadow-gray-200/60 dark:shadow-black/40 p-3 min-w-[200px]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 px-1">Filter by status</p>
              <div className="flex flex-col gap-1">
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => toggleStatus(opt.key as string)}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm font-medium text-left transition-colors ${
                      filterStatuses.includes(opt.key as string)
                        ? opt.color + " ring-1 ring-inset ring-current/20"
                        : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${filterStatuses.includes(opt.key as string) ? "opacity-100" : "opacity-30"} ${opt.color.split(" ")[0].replace("bg-", "bg-")}`} />
                    {opt.label}
                    {filterStatuses.includes(opt.key as string) && <X size={11} className="ml-auto opacity-60" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Priority filter ── */}
        <div className="relative">
          <button
            onClick={() => { setShowPriorityFilter((v) => !v); setShowStatusFilter(false); setShowDateFilter(false); }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-medium transition-all ${
              filterPriorities.length > 0
                ? "border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-500"
                : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
            }`}
          >
            <span>Priority</span>
            {filterPriorities.length > 0 && (
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                {filterPriorities.length}
              </span>
            )}
            <ChevronDown size={13} className={`transition-transform ${showPriorityFilter ? "rotate-180" : ""}`} />
          </button>

          {showPriorityFilter && (
            <div className="absolute top-full left-0 mt-1.5 z-30 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-xl shadow-gray-200/60 dark:shadow-black/40 p-3 min-w-[180px]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 px-1">Filter by priority</p>
              <div className="flex flex-col gap-1">
                {PRIORITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => togglePriority(opt.key)}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm font-medium text-left transition-colors ${
                      filterPriorities.includes(opt.key)
                        ? opt.color + " ring-1 ring-inset ring-current/20"
                        : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                    }`}
                  >
                    {opt.label}
                    {filterPriorities.includes(opt.key) && <X size={11} className="ml-auto opacity-60" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Date filter ── */}
        <div className="relative">
          <button
            onClick={() => { setShowDateFilter((v) => !v); setShowStatusFilter(false); setShowPriorityFilter(false); }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-medium transition-all ${
              filterDateFrom || filterDateTo
                ? "border-violet-400 bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-300 dark:border-violet-500"
                : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
            }`}
          >
            <span>Date</span>
            {(filterDateFrom || filterDateTo) && (
              <span className="w-2 h-2 rounded-full bg-violet-500 shrink-0" />
            )}
            <ChevronDown size={13} className={`transition-transform ${showDateFilter ? "rotate-180" : ""}`} />
          </button>

          {showDateFilter && (
            <div className="absolute top-full left-0 mt-1.5 z-30 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-xl shadow-gray-200/60 dark:shadow-black/40 p-4 min-w-[240px]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Filter by date</p>
              <div className="space-y-2.5">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">From</label>
                  <input
                    type="date"
                    value={filterDateFrom}
                    onChange={(e) => setFilterDateFrom(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm outline-none focus:border-violet-400"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">To</label>
                  <input
                    type="date"
                    value={filterDateTo}
                    onChange={(e) => setFilterDateTo(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm outline-none focus:border-violet-400"
                  />
                </div>
                {(filterDateFrom || filterDateTo) && (
                  <button
                    onClick={() => { setFilterDateFrom(""); setFilterDateTo(""); }}
                    className="w-full text-center text-xs text-gray-400 hover:text-red-500 transition-colors py-1"
                  >
                    Clear dates
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Active filter chips ── */}
        {hasActiveFilter && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {filterStatuses.map((s) => {
              const opt = STATUS_OPTIONS.find((o) => o.key === s);
              return (
                <span key={s} className={`inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-xs font-medium ${opt?.color ?? ""}`}>
                  {opt?.label}
                  <button onClick={() => toggleStatus(s)} className="hover:opacity-70"><X size={11} /></button>
                </span>
              );
            })}
            {filterPriorities.map((p) => {
              const opt = PRIORITY_OPTIONS.find((o) => o.key === p);
              return (
                <span key={p} className={`inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-xs font-medium ${opt?.color ?? ""}`}>
                  {opt?.label}
                  <button onClick={() => togglePriority(p)} className="hover:opacity-70"><X size={11} /></button>
                </span>
              );
            })}
            <button
              onClick={clearAll}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 hover:border-red-300 transition-colors"
            >
              <X size={11} /> Clear all
            </button>
          </div>
        )}

        {/* ── View switcher (pushed to the right) ── */}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <div className="rounded-xl bg-gray-100 dark:bg-gray-800/80 p-1 flex items-center gap-0.5 border border-gray-200/60 dark:border-gray-700/40">
            <button
              onClick={() => setView("kanban")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                view === "kanban"
                  ? "bg-white dark:bg-gray-900 shadow-sm text-slate-900 dark:text-slate-100"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              <Grid size={15} />
              <span>Kanban</span>
            </button>
            <button
              onClick={() => setView("list")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                view === "list"
                  ? "bg-white dark:bg-gray-900 shadow-sm text-slate-900 dark:text-slate-100"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              <List size={15} />
              <span>List</span>
            </button>
            <button
              onClick={() => setView("timeline")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                view === "timeline"
                  ? "bg-white dark:bg-gray-900 shadow-sm text-slate-900 dark:text-slate-100"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              <Clock size={15} />
              <span>Timeline</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── No results notice ─── */}
      {hasActiveFilter && totalFiltered === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-600 gap-3">
          <Search size={32} className="opacity-40" />
          <p className="text-sm font-medium">No tasks match the current filters</p>
          <button
            onClick={clearAll}
            className="text-xs text-sky-500 hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* ─── Content ─── */}
      {view === "kanban" && (
        <KanbanBoard
          currentMemberId={currentMemberId}
          columns={filteredColumns}
          dragTaskId={dragTaskId}
          onDropTo={onDropTo}
          onDragStart={onDragStart}
          onDrag={onDrag}
          onDragEnd={onDragEnd}
          onSelectTask={onSelectTask}
          team={team}
          dragPos={dragPos}
          startPointerDrag={startPointerDrag}
        />
      )}

      {view === "list" && (
        <ListView
          currentMemberId={currentMemberId}
          columns={filteredColumns}
          onSelectTask={onSelectTask}
          team={team}
        />
      )}

      {view === "timeline" && (
        <TimelineView
          currentMemberId={currentMemberId}
          columns={filteredColumns}
          onSelectTask={onSelectTask}
        />
      )}
    </div>
  );
}
