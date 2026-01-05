import React, { useMemo, useState } from "react";
import parse from "html-react-parser";
import Select from "react-select";
import { useMyTasks } from "../hooks/useTasks";
import { makeSelectStyles, makeSelectTheme } from "../utils/selectStyles";

/* ================= helpers ================= */
function hashStr(s?: string) {
    if (!s) return 0;
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
    return Math.abs(h);
}

function hsl(h: number, s = 75, l = 50) {
    return `hsl(${h} ${s}% ${l}%)`;
}
function hsla(h: number, s = 75, l = 50, a = 1) {
    return `hsla(${h} ${s}% ${l}% / ${a})`;
}

function formatDateShort(d: any) {
    if (!d) return null;
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/* ================= status pill ================= */
function statusPill(status?: string) {
    switch (status) {
        case "todo":
            return {
                key: "todo",
                label: "To Do",
                classes:
                    "bg-slate-500/10 dark:bg-slate-400/20 text-slate-600 dark:text-slate-300",
            };
        case "inprogress":
            return {
                key: "inprogress",
                label: "In Progress",
                classes:
                    "bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300",
            };
        case "qa":
            return {
                key: "qa",
                label: "QA",
                classes:
                    "bg-amber-600/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-300",
            };
        case "deploy":
            return {
                key: "deploy",
                label: "Deploy",
                classes:
                    "bg-emerald-600/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300",
            };
        case "done":
            return {
                key: "done",
                label: "Done",
                classes:
                    "bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300",
            };
        default:
            return {
                key: "unknown",
                label: "Unknown",
                classes: "bg-gray-500/10 text-gray-400",
            };
    }
}


/* ================= project ribbon ================= */
function projectRibbonStyle(name?: string) {
    const h = hashStr(name) % 360;
    const isDark =
        typeof window !== "undefined" &&
        document.documentElement.classList.contains("dark");

    return {
        bg: isDark ? hsla(h, 65, 40, 0.35) : hsla(h, 80, 55, 0.9),
        text: isDark ? hsl(h, 80, 90) : hsl(h, 30, 15),
        dot: isDark ? hsla(h, 70, 55, 0.95) : hsl(h, 75, 45),
    };
}

function DueDatePill({ dueDate }: { dueDate?: string }) {
    if (!dueDate) return null;

    const due = new Date(dueDate);
    if (Number.isNaN(due.getTime())) return null;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dueOnly = new Date(due.getFullYear(), due.getMonth(), due.getDate());

    const isOverdue = dueOnly.getTime() < today.getTime();
    const isToday = dueOnly.getTime() === today.getTime();

    const base =
        "flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium";
    const cls = isOverdue
        ? "bg-red-700/10 dark:bg-red-600/20 text-red-500 dark:text-red-300"
        : isToday
            ? "bg-amber-700/10 dark:bg-amber-600/20 text-amber-500 dark:text-amber-300"
            : "bg-emerald-700/10 dark:bg-emerald-600/20 text-emerald-500 dark:text-emerald-300";

    return (
        <div
            className={`${base} ${cls}`}
            title={`Due ${dueDate}`}
            aria-live="polite"
        >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                <path
                    d="M8 7V3M16 7V3M3 11h18M5 21h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>

            <div className="flex flex-col leading-tight">
                <span className="text-xs">
                    {formatDateShort(dueDate)}
                </span>
                {(isOverdue || isToday) && (
                    <span className="text-[11px]">
                        {isOverdue ? "overdue" : "due today"}
                    </span>
                )}
            </div>
        </div>
    );
}


/* ================= types ================= */
type Props = {
    memberId: string;
    workspaceId: string;
    onSelectTask: (projectId: string) => void
};

type ProjectOption = {
    value: string;
    label: string;
    meta: {
        hue: number;
        dot: string;
        text: string;
    };
};

export default function MyTasksList({ memberId, workspaceId, onSelectTask }: Props) {

    // 🗓️ date range
    const [startDate, setStartDate] = useState<string | undefined>()
    const [endDate, setEndDate] = useState<string | undefined>()

    const { data, isLoading, error } = useMyTasks(
        memberId,
        workspaceId,
        startDate,
        endDate
    )

    const dark =
        typeof window !== "undefined" &&
        document.documentElement.classList.contains("dark");

    /* ================= filter state ================= */
    const [projectFilter, setProjectFilter] = useState<string | undefined>();
    const [statusFilter, setStatusFilter] = useState<string>("all");

    /* ================= project select ================= */
    const styles = makeSelectStyles(dark);
    const theme = makeSelectTheme(dark);

    const projectOptions: ProjectOption[] = useMemo<ProjectOption[]>(() => {
        if (!data) return [];
        const names = Array.from(
            new Set<string>(data.map((t: any) => t.project?.name ?? "No Project"))
        );

        return names.map((name) => {
            const hue = hashStr(name) % 360;
            return {
                value: name,
                label: name,
                meta: {
                    hue,
                    dot: dark ? hsla(hue, 70, 55, 0.95) : hsl(hue, 75, 45),
                    text: dark ? hsl(hue, 70, 75) : hsl(hue, 75, 25),
                },
            };
        });
    }, [data, dark]);

    const formatOptionLabel = (opt: ProjectOption) => (
        <div className="flex items-center gap-2 text-sm">
            <span
                className="inline-block rounded-full"
                style={{ width: 10, height: 10, background: opt.meta.dot }}
            />
            <span>{opt.label}</span>
        </div>
    );

    const SingleValue = (props: any) => {
        const opt: ProjectOption = props.data;
        return (
            <div className="flex items-center gap-2 text-sm" style={{ color: opt.meta.text }}>
                <span
                    className="inline-block rounded-full"
                    style={{ width: 10, height: 10, background: opt.meta.dot }}
                />
                <span>{opt.label}</span>
            </div>
        );
    };
    /* ================= filtered tasks ================= */
    const filteredTasks = useMemo(() => {
        if (!data) return [];

        return data.filter((t: any) => {
            const projectName = t.project?.name ?? "No Project";

            if (projectFilter && projectName !== projectFilter) return false;
            if (statusFilter !== "all" && t.status !== statusFilter) return false;

            return true;
        });
    }, [data, projectFilter, statusFilter]);

    if (isLoading)
        return <div className="text-gray-400">Loading my tasks...</div>;

    if (error)
        return <div className="text-red-400">Failed to load tasks</div>;

    const hasAnyTask = Array.isArray(data) && data.length > 0;

    function AssigneesCell({ assignees }: { assignees?: any[] }) {
        if (!Array.isArray(assignees) || assignees.length === 0) {
            return <span className="text-gray-400">-</span>;
        }

        return (
            <div className="flex items-center gap-1">
                {assignees.slice(0, 3).map((a: any) => {
                    const name = a.name ?? "?";
                    const initial = name[0]?.toUpperCase() ?? "?";

                    return a.photo ? (
                        <img
                            key={a.id}
                            src={a.photo}
                            title={name}
                            className="w-6 h-6 rounded-full object-cover border"
                        />
                    ) : (
                        <div
                            key={a.id}
                            title={name}
                            className="
                            w-6 h-6 rounded-full
                            bg-gray-300 dark:bg-gray-600
                            text-[10px] font-semibold
                            flex items-center justify-center
                        "
                        >
                            {initial}
                        </div>
                    );
                })}

                {assignees.length > 3 && (
                    <div className="
                    w-6 h-6 rounded-full
                    bg-gray-200 dark:bg-gray-700
                    text-[10px]
                    flex items-center justify-center
                ">
                        +{assignees.length - 3}
                    </div>
                )}
            </div>
        );
    }


    return (
        <div className="space-y-4">
            {/* ================= FILTER BAR ================= */}
            <div className="flex flex-wrap items-center gap-3">
                {/* Project filter (react-select) */}
                <div className="w-64">
                    <Select
                        options={projectOptions}
                        value={projectOptions.find((o) => o.value === projectFilter) ?? null}
                        onChange={(opt: any) => setProjectFilter(opt?.value)}
                        isClearable
                        styles={styles}
                        theme={theme}
                        formatOptionLabel={formatOptionLabel}
                        components={{ SingleValue }}
                        placeholder="Filter project…"
                        classNamePrefix="cf-select"
                    />
                </div>
                {/* Date range filter */}
                <div className="flex items-center gap-2">
                    <div className="
                        flex items-center gap-2 px-3 py-2 rounded-lg border
                        bg-white/60 dark:bg-gray-800/60
                        border-gray-300 dark:border-gray-700
                        text-sm
                    ">
                        <input
                            type="date"
                            value={startDate ?? ""}
                            onChange={(e) => setStartDate(e.target.value || undefined)}
                            className="bg-transparent outline-none text-sm"
                        />
                        <span className="text-gray-400">→</span>
                        <input
                            type="date"
                            value={endDate ?? ""}
                            onChange={(e) => setEndDate(e.target.value || undefined)}
                            className="bg-transparent outline-none text-sm"
                        />
                    </div>

                    {(startDate || endDate) && (
                        <button
                            onClick={() => {
                                setStartDate(undefined);
                                setEndDate(undefined);
                            }}
                            className="text-sm text-indigo-500 hover:underline"
                        >
                            Reset
                        </button>
                    )}
                </div>


                {/* Status filter (pill) */}
                <div className="flex gap-2 flex-wrap">
                    {[
                        { key: "all", label: "All" },
                        statusPill("todo"),
                        statusPill("inprogress"),
                        statusPill("qa"),
                        statusPill("deploy"),
                        statusPill("done"),
                    ].map((s: any) => (
                        <button
                            key={s.key}
                            onClick={() => setStatusFilter(s.key)}
                            className={`
                                px-3 py-1.5 rounded-full text-xs font-semibold transition
                                ${statusFilter === s.key
                                    ? "bg-indigo-600 text-white shadow"
                                    : s.classes
                                }
                            `}
                        >
                            {s.label}
                        </button>
                    ))}
                </div>

            </div>

            {/* ================= TASK LIST ================= */}
            {/* ================= TASK TABLE ================= */}
            <div className="overflow-auto border rounded-sm">
                <table className="w-full text-xs border-collapse">
                    <thead className="bg-gray-100 dark:bg-gray-800">
                        <tr>
                            <th className="px-3 py-2 border text-left font-semibold">Project</th>
                            <th className="px-3 py-2 border text-left font-semibold">Task</th>
                            <th className="px-3 py-2 border text-left font-semibold">Description</th>
                            <th className="px-3 py-2 border text-left font-semibold">Assignee</th>
                            <th className="px-3 py-2 border text-left font-semibold">Status</th>
                            <th className="px-3 py-2 border text-left font-semibold">Due</th>
                            <th className="px-3 py-2 border text-left font-semibold">Created</th>
                            <th className="px-3 py-2 border text-left font-semibold">Finished</th>
                        </tr>
                    </thead>

                    <tbody>
                        {filteredTasks.map((task: any) => {
                            const status = statusPill(task.status);

                            return (
                                <tr
                                    key={task.id}
                                    onClick={() => onSelectTask(task.projectId)}
                                    className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                                >
                                    <td className="px-3 py-2 border">
                                        {task.project?.name ?? "No Project"}
                                    </td>

                                    <td className="px-3 py-2 border font-medium">
                                        {task.title}
                                    </td>

                                    <td className="px-3 py-2 border text-gray-500">
                                        <div className="line-clamp-2">
                                            {task.description
                                                ? parse(task.description)
                                                : <span className="text-gray-400">-</span>
                                            }
                                        </div>
                                    </td>

                                    <td className="px-3 py-2 border">
                                        <AssigneesCell assignees={task.taskAssignees} />
                                    </td>

                                    <td className="px-3 py-2 border">
                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${status.classes}`}>
                                            {status.label}
                                        </span>
                                    </td>

                                    <td className="px-3 py-2 border text-gray-500">
                                        {task.dueDate
                                            ? formatDateShort(task.dueDate)
                                            : "-"
                                        }
                                    </td>

                                    <td className="px-3 py-2 border text-gray-400">
                                        {formatDateShort(task.createdAt)}
                                    </td>

                                    <td className="px-3 py-2 border text-gray-400">
                                        {formatDateShort(task.finishDate)}
                                    </td>
                                </tr>
                            );
                        })}

                        {filteredTasks.length === 0 && (
                            <tr>
                                <td
                                    colSpan={7}
                                    className="px-4 py-6 text-center text-gray-400"
                                >
                                    No tasks match current filter
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

        </div>
    );
}
