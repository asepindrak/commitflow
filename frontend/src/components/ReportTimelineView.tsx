import React, { useMemo } from "react";

/* ================= helpers ================= */

function parseDate(d?: string) {
    if (!d) return null;
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return null;
    return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

function daysBetween(a: Date, b: Date) {
    const ms = 1000 * 60 * 60 * 24;
    return Math.round((b.getTime() - a.getTime()) / ms);
}

function addDays(d: Date, days: number) {
    const r = new Date(d);
    r.setDate(r.getDate() + days);
    return r;
}

function formatDay(d: Date) {
    return d.getDate();
}

function formatWeekday(d: Date) {
    return d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 1);
}

/* ================= component ================= */

export default function ReportTimelineView({
    rows,
    onSelectTask,
}: {
    rows: any[];
    onSelectTask: (projectId: string) => void;
}) {
    const tasks = rows;

    /* ===== collect date range from rows ===== */
    const { startDate, endDate, days } = useMemo(() => {
        const dates: Date[] = [];

        tasks.forEach((t) => {
            const s = parseDate(t.startDate) ?? parseDate(t.createdAt);
            const e = parseDate(t.finishDate) ?? parseDate(t.dueDate) ?? s;
            if (s) dates.push(s);
            if (e) dates.push(e);
        });

        const today = new Date();
        const min = dates.length
            ? new Date(Math.min(...dates.map((d) => d.getTime())))
            : today;
        const max = dates.length
            ? new Date(Math.max(...dates.map((d) => d.getTime())))
            : today;

        const paddedMin = addDays(min, -2);
        const paddedMax = addDays(max, 2);

        return {
            startDate: paddedMin,
            endDate: paddedMax,
            days: daysBetween(paddedMin, paddedMax) + 1,
        };
    }, [tasks]);

    const DAY_WIDTH = 26;
    const timelineWidth = Math.max(900, days * DAY_WIDTH);

    return (
        <div className="border rounded-xl bg-white dark:bg-gray-900 p-4 overflow-auto">
            <div className="mb-3">
                <div className="text-sm text-gray-500">Timeline</div>
                <div className="text-lg font-semibold">
                    Task Timeline Report
                </div>
            </div>

            <div style={{ minWidth: timelineWidth }}>
                {/* ===== HEADER ===== */}
                <div className="flex border-b">
                    {Array.from({ length: days }).map((_, i) => {
                        const d = addDays(startDate, i);
                        const isWeekend =
                            d.getDay() === 0 || d.getDay() === 6;

                        return (
                            <div
                                key={i}
                                style={{ width: DAY_WIDTH }}
                                className={`h-10 text-xs flex flex-col items-center justify-center
                                    ${isWeekend
                                        ? "bg-gray-50 dark:bg-gray-800/60"
                                        : ""
                                    }`}
                            >
                                <span className="text-gray-400">
                                    {formatWeekday(d)}
                                </span>
                                <span className="font-medium">
                                    {formatDay(d)}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* ===== LANES ===== */}
                <div className="mt-3 space-y-3">
                    {tasks.map((t) => {
                        const s =
                            parseDate(t.startDate) ??
                            parseDate(t.createdAt) ??
                            startDate;

                        const e =
                            parseDate(t.finishDate) ??
                            parseDate(t.dueDate) ??
                            s;

                        const clampedStart =
                            s < startDate ? startDate : s;
                        const clampedEnd =
                            e > endDate ? endDate : e;

                        const offset =
                            daysBetween(startDate, clampedStart) * DAY_WIDTH;

                        const span =
                            (daysBetween(clampedStart, clampedEnd) + 1) *
                            DAY_WIDTH;

                        return (
                            <div
                                key={t.id}
                                className="relative h-14"
                                style={{ minWidth: timelineWidth }}
                            >
                                {/* grid */}
                                <div className="absolute inset-0 flex">
                                    {Array.from({ length: days }).map((_, i) => (
                                        <div
                                            key={i}
                                            style={{ width: DAY_WIDTH }}
                                            className="border-r border-gray-100 dark:border-gray-800/60"
                                        />
                                    ))}
                                </div>

                                {/* bar */}
                                <div
                                    onClick={() =>
                                        onSelectTask(t.projectId)
                                    }
                                    title={`${t.title}`}
                                    className={`
                                        absolute top-2 h-10 rounded-lg px-3
                                        flex items-center text-sm font-semibold
                                        cursor-pointer shadow
                                        ${t.status === "done"
                                            ? "bg-emerald-500 text-white"
                                            : "bg-indigo-500 text-white"
                                        }
                                    `}
                                    style={{
                                        transform: `translateX(${offset}px)`,
                                        width: Math.max(24, span - 4),
                                    }}
                                >
                                    <span className="truncate">
                                        {t.title}
                                    </span>
                                </div>
                            </div>
                        );
                    })}

                    {tasks.length === 0 && (
                        <div className="py-8 text-center text-sm text-gray-400">
                            No tasks in selected range
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
