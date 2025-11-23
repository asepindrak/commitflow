import { Plus } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

// CreateProjectModal.tsx
// Default export: a reusable modal component to create a Project with `name` and `description`.
// TailwindCSS classes are used. This component is controlled by `isOpen` and `onClose` props.

export type CreateProjectPayload = {
  name: string;
  description?: string | null;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (payload: CreateProjectPayload) => Promise<void> | void;
  initialName?: string;
  initialDescription?: string;
  submittingText?: string;
};

export default function CreateProjectModal({
  isOpen,
  onClose,
  onCreate,
  initialName = "",
  initialDescription = "",
  submittingText = "Creating...",
}: Props) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [busy, setBusy] = useState(false);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setDescription(initialDescription);
      // focus first input when modal opens
      setTimeout(() => firstInputRef.current?.focus(), 50);
      // prevent body scroll
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }

    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isOpen, initialName, initialDescription]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      // small client-side validation
      firstInputRef.current?.focus();
      return;
    }
    try {
      setBusy(true);
      await onCreate({
        name: name.trim(),
        description: description.trim() || null,
      });
      // reset and close after successful create
      setName("");
      setDescription("");
      onClose();
    } catch (err) {
      // let parent handle errors — but we can console log here for debug
      console.error("Create project failed", err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      aria-modal
      role="dialog"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />

      {/* Modal panel */}
      <div className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 z-10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Create project</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="block text-sm mb-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Name
            </span>
            <input
              ref={firstInputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
              className="mt-1 block w-full px-3 py-2 rounded-lg bg-slate-100 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 text-sm outline-none focus:ring-1 focus:ring-sky-300"
              required
            />
          </label>

          <label className="block text-sm mb-4">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Description (optional)
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description"
              className="mt-1 block w-full px-3 py-2 rounded-lg bg-slate-100 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 text-sm outline-none focus:ring-1 focus:ring-sky-300 min-h-[96px]"
            />
          </label>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-sm"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={busy}
              aria-disabled={busy}
              className={`group inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
    bg-gradient-to-r from-sky-500 to-sky-600 text-white
    hover:from-sky-600 hover:to-sky-700
    active:scale-95 transition-all duration-300
    dark:from-sky-600 dark:to-sky-700 dark:hover:from-sky-700 dark:hover:to-sky-800
    ${busy ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <Plus
                size={16}
                className="transition-transform duration-300 group-hover:rotate-90"
                aria-hidden="true"
              />
              <span>{busy ? submittingText : "Create"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/*
Usage example (in a parent component):

import React, { useState } from 'react';
import CreateProjectModal from './CreateProjectModal';

export default function ProjectsContainer() {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState([]);

  async function handleCreate(payload) {
    // call your API here
    const created = await api.createProject(payload); // example
    setProjects((p) => [created, ...p]);
  }

  return (
    <div>
      <button onClick={() => setOpen(true)}>New project</button>
      <CreateProjectModal
        isOpen={open}
        onClose={() => setOpen(false)}
        onCreate={handleCreate}
      />
    </div>
  );
}
*/
