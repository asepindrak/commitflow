// utils/teamNormalize.ts (atau langsung di ProjectManagement.tsx)
export type TeamMember = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  role?: string;
  photo?: string;
};

function safeString(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "object") {
    // common places to look for a human name
    if (typeof v.name === "string" && v.name.trim() !== "") return v.name;
    if (typeof v.fullName === "string" && v.fullName.trim() !== "")
      return v.fullName;
    if (typeof v.displayName === "string" && v.displayName.trim() !== "")
      return v.displayName;
    // sometimes library parse gives { "0":"A","1":"n", ... } or nested
    if (Object.keys(v).length === 1 && typeof v[0] === "string") return v[0];
    try {
      const s = JSON.stringify(v);
      return s.length > 60 ? s.slice(0, 57) + "..." : s;
    } catch {
      return String(v);
    }
  }
  return String(v);
}

export function normalizeTeamInput(raw: any[] = []): TeamMember[] {
  return (raw || []).map((t: any, idx: number) => {
    if (typeof t === "string" && t.trim() !== "") {
      return {
        id: `tm_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        name: t.trim(),
      };
    }
    if (typeof t === "object" && t !== null) {
      const name = safeString(t.name ?? t);
      return {
        id: t.id || `tm_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        name: name.trim(),
        phone: t.phone,
        email: t.email,
        role: t.role,
        photo: t.photo,
        workspaceId: t.workspaceId,
        userId: t.userId,
        isAdmin: t.isAdmin,
      };
    }
    // fallback for weird values (null/undefined/empty)
    return {
      id: `tm_${idx}_${Math.random().toString(36).slice(2, 6)}`,
      name: safeString(t).trim(),
    };
  });
}
