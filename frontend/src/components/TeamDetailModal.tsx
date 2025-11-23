// frontend/src/components/TeamDetailModal.tsx
import React from "react";
import { X, Trash2, Send } from "lucide-react";
import Swal from "sweetalert2";
import type { TeamMember } from "../types";
import { toast } from "react-toastify";
import { normalizePhone } from "../utils/normalizePhone";
import { handleWhatsapp } from "../utils/sendWhatsapp";
import WhatsappIcon from "./WhatsappIcon";

export default function TeamDetailModal({
  member,
  open,
  onClose,
  onDelete,
}: {
  member?: TeamMember | null;
  open: boolean;
  onClose: () => void;
  onDelete: (id: string) => void;
}) {
  if (!open || !member) return null;

  const handleDelete = () => {
    Swal.fire({
      title: "Remove member?",
      text: `Remove ${member.name} from the team?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Remove",
      confirmButtonColor: "#ef4444",
      background: "#111827",
      color: "#e5e7eb",
    }).then((res) => {
      if (res.isConfirmed) {
        onDelete(member.id);
        onClose();
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
      <div className="w-[520px] bg-slate-100 dark:bg-gray-900 rounded-xl shadow-xl p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-lg font-semibold">
              {member.photo ? (
                <img
                  src={member.photo}
                  alt={member.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                member.name
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()
              )}
            </div>
            <div>
              <div className="text-lg font-bold">{member.name}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {member.role ?? "—"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleWhatsapp(member?.phone ?? "")}
              title="Remove member"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium shadow-sm
               bg-green-500/95 hover:bg-green-600/95 text-white
               dark:bg-green-300/20 dark:text-white dark:hover:bg-green-400/30
               transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-300"
            >
              <WhatsappIcon />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="ml-8 flex items-center gap-2 px-2 py-2 rounded-lg text-sm font-medium
                bg-slate-100 dark:bg-gray-900
               text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800
               transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="mt-6 space-y-2 text-sm">
          {/* Phone */}
          <div className="flex">
            <span className="w-20 text-sky-400 font-medium">Phone</span>
            <span className="text-slate-200">: {member.phone || "—"}</span>
          </div>

          {/* Email */}
          <div className="flex">
            <span className="w-20 text-sky-400 font-medium">Email</span>
            <span className="text-slate-200 truncate">
              : {member.email || "—"}
            </span>
          </div>

          {/* Role */}
          <div className="flex">
            <span className="w-20 text-sky-400 font-medium">Role</span>
            <span className="text-slate-200">: {member.role || "—"}</span>
          </div>
        </div>

        <button
          onClick={handleDelete}
          title="Remove member"
          className="px-4 py-2 mt-8 bg-gray-800 hover:bg-red-400 text-white rounded-lg shadow-md text-sm flex gap-2"
        >
          <Trash2 size={16} /> Delete
        </button>
      </div>
    </div>
  );
}
