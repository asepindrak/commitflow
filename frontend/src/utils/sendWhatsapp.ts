import type { Task } from "../types";
import { htmlToPlainFallback } from "./htmlToPlainFallback";
import { normalizePhone } from "./normalizePhone";

export const handleWhatsapp = (phone: string) => {
  const url = `https://wa.me/${normalizePhone(phone)}`;
  window.open(url, "_blank");
};

// --- Helpers (robust date parsing & status) ---
function parseDateOnlySafe(v?: string | null) {
  if (!v) return null;

  // match YYYY-MM-DD (paling umum)
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const yy = Number(m[1]);
    const mm = Number(m[2]) - 1;
    const dd = Number(m[3]);
    return new Date(yy, mm, dd); // local midnight
  }

  // fallback ke Date()
  const dt = new Date(v);
  if (Number.isNaN(dt.getTime())) return null;
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

function getDueStatus(dueDateStr?: string | null) {
  const due = parseDateOnlySafe(dueDateStr);
  if (!due) return ""; // tidak tampilkan apa-apa

  const now = new Date();
  const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (due.getTime() < todayMid.getTime()) return "(OVERDUE)";
  if (due.getTime() === todayMid.getTime()) return "(DUE TODAY)";
  return "";
}

export const handleWhatsappTask = (
  phone: string,
  task: Task,
  projectName: string
) => {
  const normalized = normalizePhone(phone);

  const descHtml = task.description || "";
  const descText = htmlToPlainFallback(descHtml);

  const dueStatus = getDueStatus(task.dueDate); // <-- NEW

  const message = `Halo, saya ingin menanyakan update terkait task berikut:

Project: ${projectName}
Task: ${task.title}
${descText ? descText + "\n\n" : ""}Status: ${task.status || "-"}
Deadline: ${task.dueDate || "-"} ${dueStatus}
Prioritas: ${task.priority || "-"}

Mohon informasikan perkembangan terbarunya ya.
Terima kasih.`.trim();

  const url = `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank", "noopener,noreferrer");
};
