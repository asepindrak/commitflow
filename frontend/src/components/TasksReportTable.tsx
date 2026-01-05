import React, { useMemo, useState } from "react";
import { Download, Loader2, RotateCcw } from "lucide-react";
import { useMyTasks, useReportTasks } from "../hooks/useTasks";
import type { TeamMember } from "../types";
import Select from "react-select";
import { makeSelectStyles, makeSelectTheme } from "../utils/selectStyles";
import parse from "html-react-parser";
import * as XLSX from "xlsx";
import ReportTimelineView from "./ReportTimelineView";

type MemberOption = {
    value: string;
    label: string;
    member: TeamMember;
};


/* ================= helpers ================= */
function formatDate(d?: string) {
    if (!d) return "";
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return "";
    return dt.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

function statusLabel(s?: string) {
    switch (s) {
        case "todo": return "Todo";
        case "inprogress": return "In Progress";
        case "qa": return "QA";
        case "deploy": return "Deploy";
        case "done": return "Done";
        default: return "-";
    }
}

function statusColor(s?: string) {
    switch (s) {
        case "todo": return "text-gray-600";
        case "inprogress": return "text-blue-600";
        case "qa": return "text-amber-600";
        case "deploy": return "text-emerald-600";
        case "done": return "text-indigo-600";
        default: return "text-gray-400";
    }
}

function getWeekKey(dateStr?: string) {
    if (!dateStr) return null;

    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return null;

    const firstDayOfMonth = new Date(d.getFullYear(), d.getMonth(), 1);
    const diff = d.getDate() + firstDayOfMonth.getDay() - 1;
    const week = Math.floor(diff / 7) + 1;

    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const range = `${formatDate(weekStart.toISOString())} – ${formatDate(
        weekEnd.toISOString()
    )}`;

    return {
        key: `Week ${week}`,
        label: `Week ${week} (${range})`,
    };
}

function groupByWeekForTimeline(tasks: any[]) {
    const map: Record<string, any[]> = {};

    tasks.forEach((t) => {
        const key = getWeekKey(t.finishDate || t.createdAt);
        if (!key) return;

        if (!map[key.label]) map[key.label] = [];
        map[key.label].push(t);
    });

    // sort tiap minggu by date
    Object.values(map).forEach((items) =>
        items.sort((a, b) => {
            const da = new Date(a.finishDate || a.createdAt).getTime();
            const db = new Date(b.finishDate || b.createdAt).getTime();
            return da - db;
        })
    );

    return map;
}


/* ================= types ================= */
type Props = {
    workspaceId: string;
    onSelectTask: (projectId: string) => void;
    team: TeamMember[];
};

export default function TasksReportTable({
    workspaceId,
    onSelectTask,
    team
}: Props) {

    // date range (default handled by backend: last 60 days)
    const [startDate, setStartDate] = useState<string | undefined>();
    const [endDate, setEndDate] = useState<string | undefined>();
    const [selectedMemberId, setSelectedMemberId] = useState<string | undefined>();
    const [statusFilter, setStatusFilter] = useState<string>("all");
    type ViewMode = "table" | "timeline";

    const [viewMode, setViewMode] = useState<ViewMode>("table");

    const normalizedMemberId =
        selectedMemberId && selectedMemberId !== "undefined"
            ? selectedMemberId
            : undefined;

    const safeStartDate =
        startDate && startDate.trim() !== "" ? startDate : undefined;

    const safeEndDate =
        endDate && endDate.trim() !== "" ? endDate : undefined;

    const { data, isLoading, error } = useReportTasks(
        workspaceId,
        normalizedMemberId,
        safeStartDate,
        safeEndDate
    );


    const rows = useMemo(() => {
        if (!Array.isArray(data)) return [];

        return data.filter((t: any) => {
            if (statusFilter !== "all" && t.status !== statusFilter) return false;
            return true;
        });
    }, [data, statusFilter]);

    const timelineGroups = useMemo(() => {
        return groupByWeekForTimeline(rows);
    }, [rows]);

    const memberOptions = useMemo<MemberOption[]>(() => {
        if (!Array.isArray(team) || team.length === 0) return [];
        return team.map((m) => ({
            value: m.id,
            label: m.name ?? "Unnamed",
            member: m,
        }));
    }, [team]);


    const MemberOptionLabel = ({ member }: { member: TeamMember }) => {
        const initial = member.name?.[0]?.toUpperCase() ?? "?";

        return (
            <div className="flex items-center gap-2 text-xs">
                {member.photo ? (
                    <img
                        src={member.photo}
                        alt={member.name}
                        className="w-5 h-5 rounded-full object-cover"
                    />
                ) : (
                    <div className="w-5 h-5 rounded-full bg-gray-300 text-[10px] flex items-center justify-center">
                        {initial}
                    </div>
                )}
                <span className="truncate">{member.name}</span>
            </div>
        );
    };

    const selectStyles = {
        control: (base: any) => ({
            ...base,
            minHeight: 28,
            height: 28,
            fontSize: 12,
            borderRadius: 2,
        }),
        valueContainer: (base: any) => ({
            ...base,
            padding: "0 6px",
        }),
        input: (base: any) => ({
            ...base,
            margin: 0,
            padding: 0,
        }),
        indicatorsContainer: (base: any) => ({
            ...base,
            height: 28,
        }),
    };

    function statusPill(status?: string) {
        switch (status) {
            case "todo":
                return {
                    key: "todo",
                    label: "Todo",
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
                    key: "all",
                    label: "All",
                    classes: "bg-gray-500/10 text-gray-500 dark:text-gray-400",
                };
        }
    }


    function AssigneesCell({ assignees }: { assignees?: any[] }) {
        if (!Array.isArray(assignees) || assignees.length === 0) {
            return <span className="text-gray-400">-</span>;
        }

        return (
            <div className="flex items-center gap-1">
                {assignees.slice(0, 3).map((a: any) => {
                    const name = a.member?.name ?? a.name ?? "?";
                    const photo = a.member?.photo ?? a.photo;
                    const initial = name[0]?.toUpperCase() ?? "?";

                    return photo ? (
                        <img
                            key={a.id}
                            src={photo}
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
                    <div
                        title={`${assignees.length - 3} more`}
                        className="
                        w-6 h-6 rounded-full
                        bg-gray-200 dark:bg-gray-700
                        text-[10px]
                        flex items-center justify-center
                    "
                    >
                        +{assignees.length - 3}
                    </div>
                )}
            </div>
        );
    }

    function TimelineItem({ task }: { task: any }) {
        const date = task.finishDate || task.createdAt;

        return (
            <div className="relative pl-6 pb-6">
                {/* dot */}
                <span
                    className={`
                    absolute left-0 top-1.5 w-3 h-3 rounded-full
                    ${task.status === "done"
                            ? "bg-emerald-500"
                            : "bg-gray-400"}
                `}
                />

                <div className="space-y-1">
                    <div className="text-sm font-semibold">
                        {task.project?.name ?? "-"} — {task.title}
                    </div>

                    <div className="text-xs text-gray-500 flex items-center gap-2">
                        <span>{formatDate(date)}</span>
                        <span>•</span>
                        <span className={statusColor(task.status)}>
                            {statusLabel(task.status)}
                        </span>
                    </div>

                    {Array.isArray(task.taskAssignees) &&
                        task.taskAssignees.length > 0 && (
                            <div className="flex gap-1 mt-1">
                                <AssigneesCell assignees={task.taskAssignees} />
                            </div>
                        )}
                </div>
            </div>
        );
    }


    function stripHtml(html?: string) {
        if (!html) return "";
        return html.replace(/<[^>]*>?/gm, "").trim();
    }

    function exportToXlsx() {
        if (!rows || rows.length === 0) return;

        const sheetData = rows.map((t: any, i: number) => ({
            No: i + 1,
            Project: t.project?.name ?? "-",
            Task: t.title ?? "",
            Description: stripHtml(t.description),
            Assignees: Array.isArray(t.taskAssignees)
                ? t.taskAssignees
                    .map((a: any) => a.member?.name ?? a.name)
                    .filter(Boolean)
                    .join(", ")
                : "-",
            Status: statusLabel(t.status),
            "Due Date": formatDate(t.dueDate),
            Created: formatDate(t.createdAt),
            Finished: formatDate(t.finishDate),
        }));

        const ws = XLSX.utils.json_to_sheet(sheetData);

        // auto column width
        ws["!cols"] = Object.keys(sheetData[0]).map((k) => ({
            wch: Math.max(
                k.length,
                ...sheetData.map((r: any) => String(r[k] ?? "").length)
            ) + 2,
        }));

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Task Report");

        const fileName = [
            "task-report",
            startDate ?? "all",
            endDate ?? "now",
        ].join("_");

        XLSX.writeFile(wb, `${fileName}.xlsx`);
    }

    function exportDoneTaskByWeek() {
        if (!rows || rows.length === 0) return;

        // ambil hanya DONE
        const doneTasks = rows.filter((t: any) => t.status === "done");
        if (doneTasks.length === 0) return;

        // group by week
        const grouped: Record<string, any[]> = {};

        doneTasks.forEach((t: any) => {
            const wk = getWeekKey(t.finishDate);
            if (!wk) return;

            if (!grouped[wk.label]) grouped[wk.label] = [];
            grouped[wk.label].push(t);
        });

        const wb = XLSX.utils.book_new();

        Object.entries(grouped).forEach(([sheetName, tasks]) => {
            const data = tasks.map((t: any, i: number) => ({
                No: i + 1,
                "Kode Task": t.title ?? "",
                Modul: t.project?.name ?? "-",
                Task: t.title ?? "",
            }));

            const ws = XLSX.utils.json_to_sheet(data);

            // auto width
            ws["!cols"] = Object.keys(data[0]).map((k) => ({
                wch: Math.max(
                    k.length,
                    ...data.map((r: any) => String(r[k] ?? "").length)
                ) + 2,
            }));

            XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
        });

        const fileName = [
            "Report_Task_Done",
            startDate ?? "all",
            endDate ?? "now",
        ].join("_");

        XLSX.writeFile(wb, `${fileName}.xlsx`);
    }

    const timelineColumns = useMemo(() => {
        const map: Record<string, any[]> = {
            todo: [],
            inprogress: [],
            qa: [],
            deploy: [],
            done: [],
        };

        rows.forEach((t: any) => {
            if (map[t.status]) {
                map[t.status].push(t);
            }
        });

        return [
            { key: "todo", title: "Todo", items: map.todo },
            { key: "inprogress", title: "In Progress", items: map.inprogress },
            { key: "qa", title: "QA", items: map.qa },
            { key: "deploy", title: "Deploy", items: map.deploy },
            { key: "done", title: "Done", items: map.done },
        ];
    }, [rows]);


    /* ================= states ================= */
    if (isLoading)
        return <div className="text-sm text-gray-400">Loading report…</div>;

    if (error)
        return <div className="text-sm text-red-400">Failed to load report</div>;

    return (
        <div className="space-y-3">

            {/* ================= FILTER BAR ================= */}
            <div className="
                sticky top-0 z-30
                flex flex-wrap items-center gap-3
                p-3 mb-3
                rounded-xl
                bg-white/80 dark:bg-gray-800/80
                backdrop-blur-sm
                border border-gray-200 dark:border-gray-700
            ">


                {/* Title */}
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                    Report
                </span>

                {/* Member filter */}
                <div className="w-48">
                    {memberOptions.length > 0 && (
                        <Select
                            options={memberOptions}
                            value={
                                memberOptions.find((o) => o.value === normalizedMemberId) ?? null
                            }
                            onChange={(opt: any) =>
                                setSelectedMemberId(
                                    opt && typeof opt.value === "string"
                                        ? opt.value
                                        : undefined
                                )
                            }
                            isClearable
                            placeholder="Member"
                            styles={makeSelectStyles(
                                typeof window !== "undefined" &&
                                document.documentElement.classList.contains("dark")
                            )}
                            theme={makeSelectTheme(
                                typeof window !== "undefined" &&
                                document.documentElement.classList.contains("dark")
                            )}
                            formatOptionLabel={(opt: MemberOption) => (
                                <MemberOptionLabel member={opt.member} />
                            )}
                            classNamePrefix="cf-select"
                        />
                    )}
                </div>

                {/* Date range */}
                <div className="
                    flex items-center gap-2 px-3 py-2 rounded-lg border
                    bg-white/60 dark:bg-gray-900/60
                    border-gray-300 dark:border-gray-700
                    text-xs
                ">
                    <input
                        type="date"
                        value={startDate ?? ""}
                        onChange={(e) =>
                            setStartDate(e.target.value || undefined)
                        }
                        className="bg-transparent outline-none"
                    />
                    <span className="text-gray-400">→</span>
                    <input
                        type="date"
                        value={endDate ?? ""}
                        onChange={(e) =>
                            setEndDate(e.target.value || undefined)
                        }
                        className="bg-transparent outline-none"
                    />
                </div>

                {/* Reset */}
                {(startDate || endDate || normalizedMemberId) && (
                    <button
                        onClick={() => {
                            setStartDate(undefined);
                            setEndDate(undefined);
                            setSelectedMemberId(undefined);
                        }}
                        className="
                            flex items-center gap-1 text-xs
                            text-indigo-500 hover:underline
                        "
                    >
                        <RotateCcw size={12} />
                        Reset
                    </button>
                )}

                {/* Status filter */}
                <div className="flex items-center gap-2 flex-wrap">
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

                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                    <button
                        onClick={() => setViewMode("table")}
                        className={`
                            px-3 py-1.5 text-xs font-semibold rounded-md transition
                            ${viewMode === "table"
                                ? "bg-white dark:bg-gray-900 shadow text-white"
                                : "text-gray-500 dark:text-gray-300"}
                        `}
                    >
                        Table
                    </button>

                    <button
                        onClick={() => setViewMode("timeline")}
                        className={`
                            px-3 py-1.5 text-xs font-semibold rounded-md transition
                            ${viewMode === "timeline"
                                ? "bg-white dark:bg-gray-900 shadow text-white"
                                : "text-gray-500 dark:text-gray-300"}
                        `}
                    >
                        Timeline
                    </button>
                </div>


                <button
                    onClick={exportToXlsx}
                    disabled={isLoading}
                    title="Export report to Excel"
                    aria-label="Export to Excel"
                    className={`group inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                        bg-gradient-to-r from-sky-500 to-sky-600 text-white
                        hover:from-sky-600 hover:to-sky-700
                        active:scale-95 transition-all duration-300
                        dark:from-sky-600 dark:to-sky-700 dark:hover:from-sky-700 dark:hover:to-sky-800`}
                >
                    <Download
                        size={16}
                        className="transition-transform duration-300 group-hover:-rotate-6"
                        aria-hidden="true"
                    />
                    {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <>
                            <span>Export Report</span>
                        </>
                    )}
                </button>

                <button
                    onClick={exportDoneTaskByWeek}
                    disabled={isLoading}
                    className="
                        group inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                        bg-gradient-to-r from-emerald-500 to-emerald-600 text-white
                        hover:from-emerald-600 hover:to-emerald-700
                        active:scale-95 transition-all
                    "
                >
                    <Download size={16} />
                    Export Task Done (Weekly)
                </button>

            </div>


            {/* ================= TABLE ================= */}
            {viewMode === "table" && (
                <div className="overflow-auto border rounded-sm">
                    <table className="w-full text-xs border-collapse">
                        <thead className="bg-gray-100 dark:bg-gray-800">
                            <tr>
                                <th className="px-3 py-2 border text-left font-semibold">Project</th>
                                <th className="px-3 py-2 border text-left font-semibold">Task</th>
                                <th className="px-3 py-2 border text-left font-semibold">Description</th>
                                <th className="px-3 py-2 border text-left font-semibold">Assignee</th>
                                <th className="px-3 py-2 border text-left font-semibold">Status</th>
                                <th className="px-3 py-2 border text-left font-semibold">Due Date</th>
                                <th className="px-3 py-2 border text-left font-semibold">Created</th>
                                <th className="px-3 py-2 border text-left font-semibold">Finished</th>
                            </tr>
                        </thead>


                        <tbody>
                            {rows.map((t: any) => (
                                <tr
                                    key={t.id}
                                    onClick={() => onSelectTask(t.projectId)}
                                    className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                                >
                                    <td className="px-3 py-2 border">
                                        {t.project?.name ?? "-"}
                                    </td>

                                    <td className="px-3 py-2 border">
                                        {t.title}
                                    </td>

                                    <td className="px-3 py-2 border">
                                        <div className="line-clamp-2">
                                            {typeof t.description === "string" && t.description.trim() !== ""
                                                ? parse(t.description)
                                                : <span className="text-gray-400">-</span>
                                            }
                                        </div>
                                    </td>

                                    <td className="px-3 py-2 border">
                                        <AssigneesCell assignees={t.taskAssignees} />
                                    </td>

                                    <td className={`px-3 py-2 border font-medium ${statusColor(t.status)}`}>
                                        {statusLabel(t.status)}
                                    </td>

                                    <td className="px-3 py-2 border">
                                        {formatDate(t.dueDate)}
                                    </td>

                                    <td className="px-3 py-2 border text-gray-500">
                                        {formatDate(t.createdAt)}
                                    </td>

                                    <td className="px-3 py-2 border text-gray-500">
                                        {formatDate(t.finishDate)}
                                    </td>
                                </tr>
                            ))}


                            {rows.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={5}
                                        className="px-4 py-6 text-center text-gray-400"
                                    >
                                        No data in selected date range
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>

                </div>
            )}

            {viewMode === "timeline" && (
                <ReportTimelineView
                    rows={rows}
                    onSelectTask={onSelectTask}
                />
            )}


        </div>
    );
}
