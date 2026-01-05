
export const safeString = (v: any) =>
    v === null || typeof v === "undefined" ? "" : String(v);

export const tryParseJSON = (s: string) => {
    try {
        return JSON.parse(s);
    } catch {
        return null;
    }
};