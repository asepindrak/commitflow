// frontend/src/components/TeamDetailModal.tsx
import React from "react";
import { X, Trash2, Send } from "lucide-react";
import Swal from "sweetalert2";
import type { TeamMember } from "../types";
import { toast } from "react-toastify";
import { normalizePhone } from "../utils/normalizePhone";
import { handleWhatsapp } from "../utils/sendWhatsapp";

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
        toast.dark(`${member.name} removed`);
        onClose();
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
      <div className="w-[520px] bg-white dark:bg-gray-900 rounded-xl shadow-xl p-6">
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
              className="p-2 rounded bg-green-500 dark:bg-green-500/20 text-white hover:bg-green-500 text-md flex gap-2"
            >
              <Send /> Whatsapp
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <X />
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-3 text-sm">
          <div>
            <strong>Phone:</strong> {member.phone || "—"}
          </div>
          <div>
            <strong>Email:</strong> {member.email || "—"}
          </div>
          <div>
            <strong>Role:</strong> {member.role || "—"}
          </div>
        </div>

        <button
          onClick={handleDelete}
          title="Remove member"
          className="p-2 rounded bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 flex gap-2 my-5"
        >
          <Trash2 /> Delete
        </button>
      </div>
    </div>
  );
}
