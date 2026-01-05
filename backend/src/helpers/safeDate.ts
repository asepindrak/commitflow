export function safeDate(v?: string) {
    if (!v) return undefined
    const d = new Date(v)
    return isNaN(d.getTime()) ? undefined : d
}

export function startOfDay(d: Date) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function endOfDay(d: Date) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export function parseDateSafe(d?: string): Date | undefined {
    if (!d) return undefined;
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return undefined;
    return dt;
}
