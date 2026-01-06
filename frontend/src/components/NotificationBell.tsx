import { Bell } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { useTaskNotifications } from "../utils/useTaskNotifications"
import { useTaskReadStore } from "../utils/useTaskReadStore"

export default function NotificationBell({
    tasks,
    memberId,
    onOpenTask,
}: {
    tasks: any[]
    memberId: string
    onOpenTask: (taskId: string, projectId: string) => void
}) {
    const notifs = useTaskNotifications(tasks, memberId)
    const unreadCount = notifs.length

    // 🔥 UI ONLY STATE
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    const markBellSeen = useTaskReadStore((s) => s.markBellSeen)
    // close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (!ref.current?.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener("mousedown", handler)
        return () => document.removeEventListener("mousedown", handler)
    }, [])

    return (
        <div className="relative" ref={ref}>
            {/* 🔔 BELL */}
            <button
                onClick={() => setOpen((v) => !v)}
                className="relative p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
            >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 text-xs bg-red-500 text-white rounded-full px-1">
                        {unreadCount}
                    </span>
                )}
            </button>

            {/* 📋 POPUP */}
            {open && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow z-50">
                    {unreadCount === 0 && (
                        <div className="px-4 py-3 text-sm text-gray-500">
                            No new notifications
                        </div>
                    )}

                    {notifs.map((n) => (
                        <button
                            key={`${n.taskId}-${n.type}`}
                            onClick={() => {
                                setOpen(false)
                                markBellSeen()
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-blue-50 dark:hover:bg-gray-800 text-sm"
                        >
                            <div className="font-medium">
                                {n.type === "comment"
                                    ? "💬 New comment"
                                    : n.type === "status"
                                        ? "🔄 Task updated"
                                        : "🆕 New task"}
                            </div>
                            <div className="text-xs text-gray-500">
                                Project Name: {n.projectName}
                            </div>
                            <div className="text-xs text-gray-500">
                                Task Name: {n.taskName}
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
