import React, { useEffect, useState } from "react";
import {
  PlusCircle,
  Trash2,
  Play,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  Target,
} from "lucide-react";
import type { Sprint, Task, TeamMember } from "../types";
import * as api from "../api/projectApi";
import { toast } from "react-toastify";
import Swal from "sweetalert2";

type Props = {
  workspaceId: string;
  tasks: Task[];
  team: TeamMember[];
  onSelectTask?: (task: Task) => void;
  onRefreshTasks?: () => void;
};

const STATUS_CFG: Record<
  string,
  { label: string; color: string; icon: React.ReactNode; bg: string }
> = {
  planning: {
    label: "Planning",
    color: "text-gray-600 dark:text-gray-300",
    icon: <Clock size={14} />,
    bg: "bg-gray-100 dark:bg-gray-800",
  },
  active: {
    label: "Active",
    color: "text-blue-600 dark:text-blue-300",
    icon: <Play size={14} />,
    bg: "bg-blue-50 dark:bg-blue-900/30",
  },
  completed: {
    label: "Completed",
    color: "text-emerald-600 dark:text-emerald-300",
    icon: <CheckCircle2 size={14} />,
    bg: "bg-emerald-50 dark:bg-emerald-900/30",
  },
};

const TASK_STATUS_COLORS: Record<string, string> = {
  todo: "#6b7280",
  inprogress: "#3b82f6",
  qa: "#a855f7",
  deploy: "#f59e0b",
  done: "#10b981",
  blocked: "#ef4444",
};

export default function SprintBoard({
  workspaceId,
  tasks,
  team,
  onSelectTask,
  onRefreshTasks,
}: Props) {
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    startDate: "",
    endDate: "",
  });

  const fetchSprints = async () => {
    try {
      const data = await api.getSprints(workspaceId);
      setSprints(data);
      // Auto-expand active sprints
      const exp: Record<string, boolean> = {};
      for (const s of data) {
        exp[s.id] = s.status === "active" || s.status === "planning";
      }
      setExpanded((prev) => ({ ...exp, ...prev }));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSprints();
  }, [workspaceId]);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    try {
      const sprint = await api.createSprint({ workspaceId, ...form });
      setSprints((prev) => [sprint, ...prev]);
      setExpanded((prev) => ({ ...prev, [sprint.id]: true }));
      setForm({ name: "", description: "", startDate: "", endDate: "" });
      setShowCreate(false);
      toast.success("Sprint created");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleStatusChange = async (sprint: Sprint, status: string) => {
    try {
      const updated = await api.updateSprint(sprint.id, { status });
      setSprints((prev) => prev.map((s) => (s.id === sprint.id ? updated : s)));
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async (sprint: Sprint) => {
    const result = await Swal.fire({
      title: "Delete Sprint?",
      text: `"${sprint.name}" will be deleted. Tasks will be unlinked.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      confirmButtonText: "Delete",
    });
    if (!result.isConfirmed) return;
    try {
      await api.deleteSprint(sprint.id);
      setSprints((prev) => prev.filter((s) => s.id !== sprint.id));
      onRefreshTasks?.();
      toast.success("Sprint deleted");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleAssignTask = async (sprintId: string, taskId: string) => {
    try {
      await api.assignTaskToSprint(sprintId, taskId);
      onRefreshTasks?.();
      toast.success("Task assigned to sprint");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const getSprintTasks = (sprintId: string) =>
    tasks.filter((t) => t.sprintId === sprintId && !t.isTrash);

  const unassignedTasks = tasks.filter((t) => !t.sprintId && !t.isTrash);

  const progress = (sprintId: string) => {
    const st = getSprintTasks(sprintId);
    if (st.length === 0) return 0;
    return Math.round(
      (st.filter((t) => t.status === "done").length / st.length) * 100,
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Target size={22} className="text-violet-500" />
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
            Sprints & Milestones
          </h2>
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-violet-500 text-white hover:bg-violet-600 transition-colors"
        >
          <PlusCircle size={16} />
          New Sprint
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 space-y-3 shadow-sm">
          <input
            type="text"
            placeholder="Sprint name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm outline-none focus:ring-2 focus:ring-violet-300 text-gray-800 dark:text-gray-100"
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm outline-none focus:ring-2 focus:ring-violet-300 text-gray-800 dark:text-gray-100"
          />
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">
                Start Date
              </label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) =>
                  setForm({ ...form, startDate: e.target.value })
                }
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm outline-none text-gray-800 dark:text-gray-100"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">
                End Date
              </label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm outline-none text-gray-800 dark:text-gray-100"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-1.5 rounded-lg text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold bg-violet-500 text-white hover:bg-violet-600 transition-colors"
            >
              Create
            </button>
          </div>
        </div>
      )}

      {/* Sprint list */}
      {sprints.length === 0 && !showCreate && (
        <div className="text-center py-16 text-gray-400">
          <Target size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No sprints yet. Create one to get started.</p>
        </div>
      )}

      {sprints.map((sprint) => {
        const cfg = STATUS_CFG[sprint.status] ?? STATUS_CFG.planning;
        const st = getSprintTasks(sprint.id);
        const pct = progress(sprint.id);
        const isExpanded = expanded[sprint.id] ?? false;

        return (
          <div
            key={sprint.id}
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden"
          >
            {/* Sprint header */}
            <div
              className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              onClick={() =>
                setExpanded((prev) => ({ ...prev, [sprint.id]: !isExpanded }))
              }
            >
              {isExpanded ? (
                <ChevronUp size={16} className="text-gray-400" />
              ) : (
                <ChevronDown size={16} className="text-gray-400" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-gray-800 dark:text-gray-100 truncate">
                    {sprint.name}
                  </h3>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg.color} ${cfg.bg}`}
                  >
                    {cfg.icon}
                    {cfg.label}
                  </span>
                </div>
                {sprint.description && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    {sprint.description}
                  </p>
                )}
                <div className="flex items-center gap-4 mt-1 text-[11px] text-gray-400">
                  {sprint.startDate && <span>Start: {sprint.startDate}</span>}
                  {sprint.endDate && <span>End: {sprint.endDate}</span>}
                  <span>{st.length} tasks</span>
                  <span>{pct}% done</span>
                </div>
              </div>
              <div
                className="flex items-center gap-1"
                onClick={(e) => e.stopPropagation()}
              >
                {sprint.status === "planning" && (
                  <button
                    onClick={() => handleStatusChange(sprint, "active")}
                    className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-500 transition-colors"
                    title="Start Sprint"
                  >
                    <Play size={14} />
                  </button>
                )}
                {sprint.status === "active" && (
                  <button
                    onClick={() => handleStatusChange(sprint, "completed")}
                    className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-emerald-500 transition-colors"
                    title="Complete Sprint"
                  >
                    <CheckCircle2 size={14} />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(sprint)}
                  className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-red-400 transition-colors"
                  title="Delete Sprint"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Progress bar */}
            <div className="px-5 pb-1">
              <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet-500 to-sky-400 rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            {/* Expanded content */}
            {isExpanded && (
              <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800">
                {st.length === 0 ? (
                  <p className="text-xs text-gray-400 py-3 text-center">
                    No tasks in this sprint. Drag or assign tasks below.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {st.map((task) => (
                      <div
                        key={task.id}
                        onClick={() => onSelectTask?.(task)}
                        className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                      >
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{
                            background:
                              TASK_STATUS_COLORS[task.status ?? "todo"],
                          }}
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-200 truncate flex-1">
                          {task.title}
                        </span>
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full text-white font-semibold"
                          style={{
                            background:
                              TASK_STATUS_COLORS[task.status ?? "todo"],
                          }}
                        >
                          {task.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Assign unassigned tasks */}
                {unassignedTasks.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                    <p className="text-[11px] text-gray-400 mb-2 font-semibold">
                      Add tasks to this sprint:
                    </p>
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                      {unassignedTasks.slice(0, 20).map((task) => (
                        <button
                          key={task.id}
                          onClick={() => handleAssignTask(sprint.id, task.id)}
                          className="text-[11px] px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-violet-100 dark:hover:bg-violet-900/30 hover:text-violet-600 dark:hover:text-violet-300 transition-colors truncate max-w-[180px]"
                          title={task.title}
                        >
                          + {task.title}
                        </button>
                      ))}
                      {unassignedTasks.length > 20 && (
                        <span className="text-[11px] text-gray-400 px-2 py-1">
                          +{unassignedTasks.length - 20} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
