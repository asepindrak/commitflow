import {
  Bell,
  Check,
  MessageSquare,
  RefreshCw,
  PlusCircle,
  X,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useTaskNotifications } from "../utils/useTaskNotifications";
import { useTaskReadStore } from "../utils/useTaskReadStore";
import { useChatNotifStore, type ChatNotif } from "../utils/useChatNotifStore";

type Tab = "all" | "tasks" | "chat";

export default function NotificationBell({
  tasks,
  memberId,
  onOpenTask,
}: {
  tasks: any[];
  memberId: string;
  onOpenTask: (taskId: string, projectId: string) => void;
}) {
  const notifs = useTaskNotifications(tasks, memberId);
  const chatNotifs = useChatNotifStore((s) => s.notifs);
  const dismissChat = useChatNotifStore((s) => s.dismiss);
  const clearChat = useChatNotifStore((s) => s.clear);
  const totalCount = notifs.length + chatNotifs.length;

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("all");
  const ref = useRef<HTMLDivElement>(null);

  const markBellSeen = useTaskReadStore((s) => s.markBellSeen);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredNotifs = tab === "chat" ? [] : notifs;
  const filteredChat = tab === "tasks" ? [] : chatNotifs;

  const tabCount = (t: Tab) => {
    if (t === "all") return totalCount;
    if (t === "tasks") return notifs.length;
    return chatNotifs.length;
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
      >
        <Bell className="w-5 h-5" />
        {totalCount > 0 && (
          <span className="absolute -top-1 -right-1 text-[10px] bg-red-500 text-white rounded-full px-1.5 min-w-[18px] text-center font-bold animate-pulse">
            {totalCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 max-h-[500px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">
              Notifications
            </h3>
            <div className="flex items-center gap-2">
              {totalCount > 0 && (
                <button
                  onClick={() => {
                    clearChat();
                    markBellSeen();
                  }}
                  className="text-[10px] text-sky-500 hover:text-sky-600 font-semibold flex items-center gap-1"
                >
                  <Check size={10} />
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X size={14} className="text-gray-400" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-100 dark:border-gray-800 px-3">
            {(["all", "tasks", "chat"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-2 text-xs font-semibold capitalize transition-colors border-b-2 ${
                  tab === t
                    ? "border-sky-500 text-sky-600 dark:text-sky-400"
                    : "border-transparent text-gray-400 hover:text-gray-600"
                }`}
              >
                {t}
                {tabCount(t) > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-[10px]">
                    {tabCount(t)}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {filteredNotifs.length === 0 && filteredChat.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <Bell size={28} className="opacity-30 mb-2" />
                <p className="text-xs">No notifications</p>
              </div>
            )}

            {/* Chat notifications */}
            {filteredChat.map((cn: ChatNotif) => (
              <div
                key={cn.id}
                className="flex items-start gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 border-b border-gray-50 dark:border-gray-800/30 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0 mt-0.5">
                  <MessageSquare size={14} className="text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-100">
                    {cn.type === "mention" ? "Mentioned you" : "New message"}
                  </p>
                  <p className="text-[11px] text-gray-500 truncate mt-0.5">
                    <span className="font-semibold">{cn.senderName}</span>
                    {cn.content
                      ? `: ${cn.content.slice(0, 60)}${cn.content.length > 60 ? "…" : ""}`
                      : " sent an attachment"}
                  </p>
                  {cn.workspaceName && (
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      #{cn.workspaceName}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => dismissChat(cn.id)}
                  className="text-gray-300 hover:text-red-400 shrink-0 mt-1 transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            ))}

            {/* Task notifications */}
            {filteredNotifs.map((n) => (
              <button
                key={`${n.taskId}-${n.type}`}
                onClick={() => {
                  setOpen(false);
                  markBellSeen();
                  onOpenTask(n.taskId, n.projectId);
                }}
                className="w-full flex items-start gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 border-b border-gray-50 dark:border-gray-800/30 transition-colors text-left"
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                    n.type === "comment"
                      ? "bg-amber-100 dark:bg-amber-900/30"
                      : n.type === "status"
                        ? "bg-purple-100 dark:bg-purple-900/30"
                        : "bg-emerald-100 dark:bg-emerald-900/30"
                  }`}
                >
                  {n.type === "comment" ? (
                    <MessageSquare size={14} className="text-amber-500" />
                  ) : n.type === "status" ? (
                    <RefreshCw size={14} className="text-purple-500" />
                  ) : (
                    <PlusCircle size={14} className="text-emerald-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-100">
                    {n.type === "comment"
                      ? "New comment"
                      : n.type === "status"
                        ? "Task updated"
                        : "New task"}
                  </p>
                  <p className="text-[11px] text-gray-500 truncate mt-0.5">
                    {n.taskName}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {n.projectName}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
