import React, { useEffect, useState } from "react";
import { Grid, List, Clock } from "lucide-react";
import KanbanBoard from "./KanbanBoard";
import ListView from "./ListView";
import TimelineView from "./TimelineView";
import type { Task, TeamMember } from "../types";

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
  onDropTo: (s: Task["status"], draggedId?: string) => void;
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

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, view);
    } catch {
      console.log("local storage error");
    }
  }, [view]);

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">Tasks</h3>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Choose a view
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-gray-100 dark:bg-gray-800 p-1 flex items-center gap-1">
            <button
              onClick={() => setView("kanban")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                view === "kanban"
                  ? "bg-slate-100 dark:bg-gray-900 shadow-sm text-slate-900 dark:text-slate-100"
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              <Grid size={16} />
              <span>Kanban</span>
            </button>

            <button
              onClick={() => setView("list")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                view === "list"
                  ? "bg-slate-100 dark:bg-gray-900 shadow-sm text-slate-900 dark:text-slate-100"
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              <List size={16} />
              <span>List</span>
            </button>

            <button
              onClick={() => setView("timeline")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                view === "timeline"
                  ? "bg-slate-100 dark:bg-gray-900 shadow-sm text-slate-900 dark:text-slate-100"
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              <Clock size={16} />
              <span>Timeline</span>
            </button>
          </div>
        </div>
      </div>

      {/* content */}
      {view === "kanban" && (
        <KanbanBoard
          currentMemberId={currentMemberId}
          columns={columns}
          dragTaskId={dragTaskId}
          onDropTo={onDropTo}
          onDragStart={onDragStart} // sekarang expects (e,id)
          onDrag={onDrag} // new prop
          onDragEnd={onDragEnd} // new prop
          onSelectTask={onSelectTask}
          team={team}
          dragPos={dragPos}
          startPointerDrag={startPointerDrag}
        />
      )}

      {view === "list" && (
        <ListView
          currentMemberId={currentMemberId}
          columns={columns}
          onSelectTask={onSelectTask}
          team={team}
        />
      )}

      {view === "timeline" && (
        <TimelineView
          currentMemberId={currentMemberId}
          columns={columns}
          onSelectTask={onSelectTask}
        />
      )}
    </div>
  );
}
