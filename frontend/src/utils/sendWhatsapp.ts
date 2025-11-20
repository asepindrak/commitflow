import type { Task } from "../types";
import { htmlToPlainFallback } from "./htmlToPlainFallback";
import { normalizePhone } from "./normalizePhone";

export const handleWhatsapp = (phone: string) => {
  const url = `https://wa.me/${normalizePhone(phone)}`;
  window.open(url, "_blank");
};

export const handleWhatsappTask = (
  phone: string,
  task: Task,
  projectName: string
) => {
  const normalized = normalizePhone(phone);
  const descHtml = task.description || "";
  const descText = htmlToPlainFallback(descHtml);

  const message = `Halo, saya ingin menanyakan update terkait task berikut:
  
  Project: ${projectName}
  Task: ${task.title}
  ${descText ? descText + "\n\n" : ""}Status: ${task.status || "-"}
  Deadline: ${task.dueDate || "-"}
  Prioritas: ${task.priority || "-"}
  
  Mohon informasikan perkembangan terbarunya ya.
  Terima kasih.`.trim();

  const url = `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank", "noopener,noreferrer");
};
