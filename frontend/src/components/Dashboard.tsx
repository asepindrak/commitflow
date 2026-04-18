import React, { useEffect, useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Users,
  FolderKanban,
  TrendingUp,
  RefreshCw,
  Zap,
  CalendarClock,
  ListChecks,
} from "lucide-react";
import { getDashboardStats } from "../api/projectApi";

type DashboardData = {
  totalTasks: number;
  totalProjects: number;
  totalMembers: number;
  statusCounts: Record<string, number>;
  priorityCounts: Record<string, number>;
  overdue: number;
  dueToday: number;
  dueSoon: number;
  createdThisWeek: number;
  completedThisWeek: number;
  projectStats: { id: string; name: string; taskCount: number }[];
  memberWorkload: {
    id: string;
    name: string;
    photo?: string;
    role?: string;
    taskCount: number;
  }[];
};

const STATUS_LABELS: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  todo: {
    label: "To Do",
    color: "text-gray-600 dark:text-gray-300",
    bg: "bg-gray-100 dark:bg-gray-700",
  },
  inprogress: {
    label: "In Progress",
    color: "text-blue-600 dark:text-blue-300",
    bg: "bg-blue-100 dark:bg-blue-900/40",
  },
  qa: {
    label: "QA",
    color: "text-amber-600 dark:text-amber-300",
    bg: "bg-amber-100 dark:bg-amber-900/40",
  },
  deploy: {
    label: "Deploy",
    color: "text-purple-600 dark:text-purple-300",
    bg: "bg-purple-100 dark:bg-purple-900/40",
  },
  done: {
    label: "Done",
    color: "text-emerald-600 dark:text-emerald-300",
    bg: "bg-emerald-100 dark:bg-emerald-900/40",
  },
  blocked: {
    label: "Blocked",
    color: "text-red-600 dark:text-red-300",
    bg: "bg-red-100 dark:bg-red-900/40",
  },
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-blue-400",
  none: "bg-gray-300 dark:bg-gray-600",
};

function nameToHue(name = "") {
  return name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
}

export default function Dashboard({ workspaceId }: { workspaceId: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    setLoading(true);
    try {
      const d = await getDashboardStats(workspaceId);
      setData(d);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (workspaceId) fetch();
  }, [workspaceId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <RefreshCw size={28} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-24 text-gray-500">
        Failed to load dashboard
      </div>
    );
  }

  const completionRate =
    data.totalTasks > 0
      ? Math.round(((data.statusCounts.done || 0) / data.totalTasks) * 100)
      : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<ListChecks size={20} />}
          label="Total Tasks"
          value={data.totalTasks}
          color="from-blue-500 to-cyan-500"
        />
        <StatCard
          icon={<FolderKanban size={20} />}
          label="Projects"
          value={data.totalProjects}
          color="from-violet-500 to-purple-500"
        />
        <StatCard
          icon={<Users size={20} />}
          label="Team Members"
          value={data.totalMembers}
          color="from-emerald-500 to-teal-500"
        />
        <StatCard
          icon={<CheckCircle2 size={20} />}
          label="Completion"
          value={`${completionRate}%`}
          color="from-amber-500 to-orange-500"
        />
      </div>

      {/* Alerts Row */}
      {(data.overdue > 0 || data.dueToday > 0 || data.dueSoon > 0) && (
        <div className="flex flex-wrap gap-3">
          {data.overdue > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40">
              <AlertTriangle size={16} className="text-red-500" />
              <span className="text-sm font-semibold text-red-700 dark:text-red-300">
                {data.overdue} overdue
              </span>
            </div>
          )}
          {data.dueToday > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40">
              <Clock size={16} className="text-amber-500" />
              <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                {data.dueToday} due today
              </span>
            </div>
          )}
          {data.dueSoon > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40">
              <CalendarClock size={16} className="text-blue-500" />
              <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                {data.dueSoon} due soon
              </span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Breakdown */}
        <div className="bg-white dark:bg-gray-800/60 rounded-2xl border border-gray-100 dark:border-gray-700/50 p-5">
          <h4 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <BarChart3 size={18} className="text-blue-500" />
            Task Status
          </h4>
          <div className="space-y-3">
            {Object.entries(STATUS_LABELS).map(([key, cfg]) => {
              const count = data.statusCounts[key] || 0;
              const pct =
                data.totalTasks > 0
                  ? Math.round((count / data.totalTasks) * 100)
                  : 0;
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-semibold ${cfg.color}`}>
                      {cfg.label}
                    </span>
                    <span className="text-xs text-gray-500">
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${cfg.bg} transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Priority Distribution */}
        <div className="bg-white dark:bg-gray-800/60 rounded-2xl border border-gray-100 dark:border-gray-700/50 p-5">
          <h4 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Zap size={18} className="text-amber-500" />
            Priority Distribution
          </h4>
          <div className="flex items-end justify-center gap-6 h-40">
            {["urgent", "medium", "low", "none"].map((pri) => {
              const count = data.priorityCounts[pri] || 0;
              const maxCount = Math.max(
                ...Object.values(data.priorityCounts),
                1,
              );
              const height = Math.max((count / maxCount) * 100, 8);
              return (
                <div key={pri} className="flex flex-col items-center gap-2">
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                    {count}
                  </span>
                  <div
                    className={`w-10 rounded-t-lg ${PRIORITY_COLORS[pri]} transition-all duration-500`}
                    style={{ height: `${height}%` }}
                  />
                  <span className="text-[10px] text-gray-500 capitalize">
                    {pri === "none" ? "No Priority" : pri}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Weekly Velocity */}
        <div className="bg-white dark:bg-gray-800/60 rounded-2xl border border-gray-100 dark:border-gray-700/50 p-5">
          <h4 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-emerald-500" />
            This Week
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center py-4 rounded-xl bg-blue-50 dark:bg-blue-900/20">
              <div className="text-3xl font-extrabold text-blue-600 dark:text-blue-400">
                {data.createdThisWeek}
              </div>
              <div className="text-xs text-gray-500 mt-1">Tasks Created</div>
            </div>
            <div className="text-center py-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20">
              <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                {data.completedThisWeek}
              </div>
              <div className="text-xs text-gray-500 mt-1">Tasks Completed</div>
            </div>
          </div>
        </div>

        {/* Member Workload */}
        <div className="bg-white dark:bg-gray-800/60 rounded-2xl border border-gray-100 dark:border-gray-700/50 p-5">
          <h4 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Users size={18} className="text-violet-500" />
            Member Workload
          </h4>
          <div className="space-y-2.5 max-h-48 overflow-y-auto">
            {data.memberWorkload
              .sort((a, b) => b.taskCount - a.taskCount)
              .map((m) => {
                const hue = nameToHue(m.name);
                const maxTasks = Math.max(
                  ...data.memberWorkload.map((x) => x.taskCount),
                  1,
                );
                const pct = Math.round((m.taskCount / maxTasks) * 100);
                return (
                  <div key={m.id} className="flex items-center gap-3">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 overflow-hidden"
                      style={{
                        background: `hsl(${hue}, 70%, 90%)`,
                        color: `hsl(${hue}, 60%, 30%)`,
                      }}
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
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-medium truncate text-gray-700 dark:text-gray-300">
                          {m.name}
                        </span>
                        <span className="text-[10px] text-gray-400 ml-2">
                          {m.taskCount} tasks
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Projects Overview */}
      {data.projectStats.length > 0 && (
        <div className="bg-white dark:bg-gray-800/60 rounded-2xl border border-gray-100 dark:border-gray-700/50 p-5">
          <h4 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <FolderKanban size={18} className="text-cyan-500" />
            Projects Overview
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {data.projectStats.map((p) => {
              const hue = nameToHue(p.name);
              return (
                <div
                  key={p.id}
                  className="rounded-xl border border-gray-100 dark:border-gray-700/50 p-4 hover:shadow-md transition-shadow"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm mb-2"
                    style={{
                      background: `linear-gradient(135deg, hsl(${hue},70%,55%), hsl(${hue + 30},70%,50%))`,
                    }}
                  >
                    {p.name[0]?.toUpperCase()}
                  </div>
                  <div className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
                    {p.name}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {p.taskCount} tasks
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700/50 p-5">
      <div
        className={`absolute -top-4 -right-4 w-16 h-16 rounded-full bg-gradient-to-br ${color} opacity-10`}
      />
      <div
        className={`inline-flex p-2 rounded-xl bg-gradient-to-br ${color} text-white mb-3`}
      >
        {icon}
      </div>
      <div className="text-2xl font-extrabold text-gray-900 dark:text-white">
        {value}
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
        {label}
      </div>
    </div>
  );
}
