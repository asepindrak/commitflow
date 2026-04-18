import React, { useEffect, useState } from "react";
import {
  Activity,
  PlusCircle,
  Trash2,
  ArrowRightLeft,
  Edit3,
  UserPlus,
  FolderPlus,
  FolderMinus,
  MessageSquarePlus,
  RefreshCw,
} from "lucide-react";
import { getActivityLog } from "../api/projectApi";

type ActivityEntry = {
  id: string;
  workspaceId: string;
  memberId?: string;
  memberName?: string;
  action: string;
  entity?: string;
  entityId?: string;
  entityName?: string;
  meta?: Record<string, any>;
  createdAt: string;
};

const ACTION_CONFIG: Record<
  string,
  { icon: React.ReactNode; label: string; color: string }
> = {
  "task.created": {
    icon: <PlusCircle size={16} />,
    label: "created task",
    color: "text-emerald-500",
  },
  "task.updated": {
    icon: <Edit3 size={16} />,
    label: "updated task",
    color: "text-blue-500",
  },
  "task.status_changed": {
    icon: <ArrowRightLeft size={16} />,
    label: "changed status",
    color: "text-amber-500",
  },
  "task.deleted": {
    icon: <Trash2 size={16} />,
    label: "deleted task",
    color: "text-red-500",
  },
  "project.created": {
    icon: <FolderPlus size={16} />,
    label: "created project",
    color: "text-violet-500",
  },
  "project.deleted": {
    icon: <FolderMinus size={16} />,
    label: "deleted project",
    color: "text-red-500",
  },
  "member.added": {
    icon: <UserPlus size={16} />,
    label: "added member",
    color: "text-cyan-500",
  },
  "comment.added": {
    icon: <MessageSquarePlus size={16} />,
    label: "added comment",
    color: "text-pink-500",
  },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function groupByDate(
  entries: ActivityEntry[],
): { date: string; items: ActivityEntry[] }[] {
  const map = new Map<string, ActivityEntry[]>();
  for (const e of entries) {
    const key = new Date(e.createdAt).toDateString();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  return Array.from(map.entries()).map(([, items]) => ({
    date: formatDate(items[0].createdAt),
    items,
  }));
}

export default function ActivityLog({ workspaceId }: { workspaceId: string }) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLogs = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await getActivityLog(workspaceId, 200);
      setEntries(Array.isArray(data) ? data : []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (workspaceId) fetchLogs();
  }, [workspaceId]);

  const groups = groupByDate(entries);

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-200/50 dark:shadow-indigo-900/30">
            <Activity size={22} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Activity Log
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {entries.length} activities recorded
            </p>
          </div>
        </div>
        <button
          onClick={() => fetchLogs(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium
            bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
            hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw size={24} className="animate-spin text-gray-400" />
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-20">
          <Activity
            size={48}
            className="mx-auto text-gray-300 dark:text-gray-600 mb-3"
          />
          <p className="text-gray-500 dark:text-gray-400 font-medium">
            No activity yet
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Activities will appear here as your team works
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.date}>
              {/* Date header */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {group.date}
                </span>
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700/60" />
              </div>

              {/* Timeline */}
              <div className="relative pl-8">
                {/* vertical line */}
                <div className="absolute left-[13px] top-2 bottom-2 w-px bg-gradient-to-b from-gray-200 via-gray-200 to-transparent dark:from-gray-700 dark:via-gray-700" />

                <div className="space-y-1">
                  {group.items.map((entry) => {
                    const cfg = ACTION_CONFIG[entry.action] ?? {
                      icon: <Activity size={16} />,
                      label: entry.action,
                      color: "text-gray-500",
                    };

                    return (
                      <div
                        key={entry.id}
                        className="relative flex items-start gap-3 py-2 group"
                      >
                        {/* dot */}
                        <div
                          className={`absolute -left-8 top-2.5 w-[26px] h-[26px] rounded-full flex items-center justify-center
                            bg-white dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700
                            group-hover:border-indigo-300 dark:group-hover:border-indigo-600
                            transition-colors ${cfg.color}`}
                        >
                          {cfg.icon}
                        </div>

                        {/* content */}
                        <div className="flex-1 min-w-0 bg-white dark:bg-gray-800/60 rounded-xl px-4 py-3 border border-gray-100 dark:border-gray-700/50 group-hover:border-indigo-200 dark:group-hover:border-indigo-800/40 transition-colors">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm text-gray-800 dark:text-gray-200">
                              {entry.memberName && (
                                <span className="font-semibold">
                                  {entry.memberName}
                                </span>
                              )}{" "}
                              <span className="text-gray-500 dark:text-gray-400">
                                {cfg.label}
                              </span>{" "}
                              {entry.entityName && (
                                <span className="font-medium text-gray-700 dark:text-gray-300">
                                  "{entry.entityName}"
                                </span>
                              )}
                            </p>
                            <span className="text-[11px] text-gray-400 dark:text-gray-500 whitespace-nowrap shrink-0">
                              {timeAgo(entry.createdAt)}
                            </span>
                          </div>

                          {/* Meta details (e.g. status change) */}
                          {entry.meta &&
                            entry.action === "task.status_changed" && (
                              <div className="mt-1.5 flex items-center gap-2 text-xs">
                                <StatusBadge status={entry.meta.from} />
                                <ArrowRightLeft
                                  size={12}
                                  className="text-gray-400"
                                />
                                <StatusBadge status={entry.meta.to} />
                              </div>
                            )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  const colors: Record<string, string> = {
    todo: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
    inprogress:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    qa: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    deploy:
      "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
    done: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    blocked: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${colors[status] ?? colors.todo}`}
    >
      {status}
    </span>
  );
}
