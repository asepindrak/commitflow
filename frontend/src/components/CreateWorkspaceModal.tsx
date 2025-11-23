// frontend/src/components/CreateWorkspaceModal.tsx
import React, { useEffect, useState } from "react";
import { X, Check } from "lucide-react";

export type Workspace = {
  id: string;
  name: string;
  description?: string;
  createdAt?: string;
};

export default function CreateWorkspaceModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (w: Workspace) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setError("");
      setSaving(false);
    }
  }, [open]);

  const generateId = () => {
    if (typeof (globalThis as any).crypto?.randomUUID === "function") {
      try {
        return (globalThis as any).crypto.randomUUID();
      } catch {
        // fallback below
      }
    }
    return `ws_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError("");
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Workspace name is required");
      return;
    }
    setSaving(true);

    // create workspace object
    const workspace: Workspace = {
      id: generateId(),
      name: trimmed,
      description: description.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    try {
      // call parent
      onCreate(workspace);
      setSaving(false);
      onClose();
    } catch (err: any) {
      setSaving(false);
      setError(err?.message || "Failed to create workspace");
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      aria-modal="true"
      role="dialog"
    >
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => {
          if (!saving) onClose();
        }}
      />

      {/* modal */}
      <div className="relative w-full max-w-md mx-4 bg-slate-100 dark:bg-gray-900 rounded-2xl shadow-xl ring-1 ring-black/10 dark:ring-white/10 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h3 className="text-sm font-semibold">Create workspace</h3>
          <button
            onClick={() => !saving && onClose()}
            className="p-1 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4">
          <div className="mb-4">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Name
            </label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Corp"
              className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-800 text-sm outline-none focus:ring-1 focus:ring-sky-300"
              disabled={saving}
            />
          </div>

          <div className="mb-4">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description"
              className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-800 text-sm outline-none focus:ring-1 focus:ring-sky-300 resize-none h-20"
              disabled={saving}
            />
          </div>

          {error && <div className="mb-3 text-xs text-red-400">{error}</div>}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => !saving && onClose()}
              className="px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 text-sm"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className={`group inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
              bg-gradient-to-r from-sky-500 to-sky-600 text-white
              hover:from-sky-600 hover:to-sky-700
              active:scale-95 transition-all duration-300
              disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              {saving ? (
                <span>Creating...</span>
              ) : (
                <>
                  <Check
                    size={16}
                    className="transition-transform duration-300 group-hover:-rotate-6"
                  />
                  <span>Create</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
