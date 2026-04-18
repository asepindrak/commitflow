// frontend/src/components/TaskModal.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import parse from "html-react-parser";
import {
  BubblesIcon,
  Check,
  File,
  Loader2,
  MessageSquare,
  Paperclip,
  Save,
  Send,
  Trash,
  X,
  Download,
} from "lucide-react";
import Swal from "sweetalert2";
import type { Task, Attachment, TeamMember } from "../types";
import uploadMultipleFilesToS3 from "../utils/uploadFile";
import { PrioritySelect } from "./PrioritySelect";
import { AssigneeSelect } from "./AssigneeSelect";
import { handleWhatsapp, handleWhatsappTask } from "../utils/sendWhatsapp";
import WhatsappIcon from "./WhatsappIcon";
import MediaModal from "./MediaModal";
import { useAuthStore } from "../utils/store";
import { FaComment } from "react-icons/fa";
import { getTaskAssignees } from "../utils/getTaskAssignees";

export default function TaskModal({
  projects,
  activeProjectId,
  currentMemberId,
  task,
  allTasks = [],
  dark,
  onClose,
  onSave,
  onAddComment,
  onDelete,
  team,
}: {
  projects: any[];
  activeProjectId: string;
  currentMemberId: any;
  task: Task;
  allTasks?: Task[];
  dark: boolean;
  onClose: () => void;
  onSave: (t: Task) => void;
  onAddComment: (
    author: string,
    body: string,
    attachments?: Attachment[],
  ) => void;
  onDelete: (id: string) => void;
  team: TeamMember[];
}) {
  const [local, setLocal] = useState<Task>(task);
  const [commentText, setCommentText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [mediaViewerOpen, setMediaViewerOpen] = useState(false);
  const [mediaViewerUrl, setMediaViewerUrl] = useState<string>("");
  const [mediaViewerType, setMediaViewerType] = useState<"image" | "video">(
    "image",
  );
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const assigneeMembers = useMemo(() => {
    return getTaskAssignees(task, team);
  }, [task, team]);

  const assigneePhones = assigneeMembers
    .map((m) => m.phone)
    .filter((p): p is string => Boolean(p));

  const user = useAuthStore((s) => s.user);
  const currentMemberName = user?.name ?? null;

  const currentProject = useMemo(
    () => projects.find((m) => String(m.id) === String(activeProjectId)),
    [projects, activeProjectId],
  );
  const currentProjectName = currentProject?.name ?? null;

  useEffect(() => {
    const derived: any = { ...task };

    if (derived.startDate instanceof Date) {
      derived.startDate = derived.startDate.toISOString().slice(0, 10);
    }
    if (derived.dueDate instanceof Date) {
      derived.dueDate = derived.dueDate.toISOString().slice(0, 10);
    }

    setLocal(derived);
  }, [task]);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.currentTarget.files;
    if (!list || list.length === 0) return;
    const arr = Array.from(list);
    setFiles((prev) => [...prev, ...arr]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removePendingFile(idx: number) {
    setFiles((s) => s.filter((_, i) => i !== idx));
  }

  async function handleAddComment() {
    if (!commentText.trim() && files.length === 0) return;
    setUploading(true);
    const filesToUpload = [...files];
    let attachments: Attachment[] | undefined = undefined;
    try {
      if (filesToUpload.length > 0) {
        const folder = `projects/${local.projectId}/tasks/${local.id}`;
        const urls = await uploadMultipleFilesToS3(filesToUpload, folder);
        attachments = urls.map((u, i) => ({
          id: Math.random().toString(36).slice(2, 9),
          name: filesToUpload[i].name,
          type: filesToUpload[i].type,
          size: filesToUpload[i].size,
          url: u,
        }));
      }

      onAddComment(
        currentMemberName ?? "No Name",
        commentText.trim(),
        attachments,
      );

      setLocal((s) => ({
        comments: [
          {
            id: Math.random().toString(36).slice(2, 9),
            author: currentMemberName ?? "No Name",
            body: commentText.trim(),
            createdAt: new Date().toISOString(),
            attachments,
          },
          ...(s.comments || []),
        ],
        ...s,
      }));

      setCommentText("");
      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      console.error("[Attach] upload failed:", err);
      await Swal.fire({
        title: "Upload failed",
        text: `Gagal upload file: ${err?.message || err}`,
        icon: "error",
        background: dark ? "#111827" : undefined,
        color: dark ? "#e5e7eb" : undefined,
      });
    } finally {
      setUploading(false);
    }
  }

  const handleDeleteClick = async () => {
    if (!local?.id) return;
    const res = await Swal.fire({
      title: "Delete this task?",
      text: "This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#ef4444",
      background: dark ? "#111827" : undefined,
      color: dark ? "#e5e7eb" : undefined,
    });

    if (!res.isConfirmed) return;
    setIsLoading(true);
    try {
      await onDelete(local.id);
      await Swal.fire({
        title: "Deleted",
        text: "Task has been deleted.",
        icon: "success",
        background: dark ? "#111827" : undefined,
        color: dark ? "#e5e7eb" : undefined,
        timer: 1200,
        showConfirmButton: false,
      });
    } catch (err: any) {
      console.error("onDelete failed", err);
      await Swal.fire({
        title: "Delete failed",
        text: err?.message || String(err),
        icon: "error",
        background: dark ? "#111827" : undefined,
        color: dark ? "#e5e7eb" : undefined,
      });
    } finally {
      onClose();
      setIsLoading(false);
    }
  };

  // --- tambahkan bersama function lainnya di komponen (mis. setelah handleAssigneeChange) ---
  // props: onAddComment: (author, body, attachments?) => Promise<any>

  async function handleSaveClick() {
    setIsLoading(true);
    const toSave: any = { ...local };

    if (toSave.priority === "") toSave.priority = null;
    if (toSave.startDate === "") toSave.startDate = null;
    if (toSave.dueDate === "") toSave.dueDate = null;

    // jika ada comment pending, upload + add comment dulu dan await
    if (!isEmptyQuill(commentText) || files.length > 0) {
      setUploading(true);
      let attachments: Attachment[] | undefined = undefined;
      try {
        if (files.length > 0) {
          const folder = `projects/${local.projectId}/tasks/${local.id}`;
          const urls = await uploadMultipleFilesToS3(files, folder);
          attachments = urls.map((u, i) => ({
            id: Math.random().toString(36).slice(2, 9),
            name: files[i].name,
            type: files[i].type,
            size: files[i].size,
            url: u,
          }));
        }

        // await parent to persist comment and return the saved comment object (if parent returns one)
        let savedComment: any = null;
        try {
          savedComment = await onAddComment(
            currentMemberName ?? "No Name",
            commentText.trim(),
            attachments,
          );
        } catch (e) {
          // parent might throw or not return; we'll fallback to optimistic tmp comment
          console.warn("onAddComment threw or rejected:", e);
          savedComment = null;
        }

        // use the returned savedComment (server-assigned id / timestamps), fallback to local newComment
        const newComment =
          savedComment ??
          ({
            id: Math.random().toString(36).slice(2, 9),
            // keep taskId if available; parent will normalize if needed
            taskId: toSave.id ?? local.id,
            author: currentMemberName ?? "No Name",
            body: commentText.trim(),
            attachments:
              attachments && attachments.length > 0 ? attachments : null,
            createdAt: new Date().toISOString(),
            isTrash: false,
          } as any);

        // prepend comment so it shows up immediately
        toSave.comments = [newComment, ...(toSave.comments || [])];

        // reset editor & pending files
        setCommentText("");
        setFiles([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } catch (err: any) {
        console.error("[Save] upload/addComment failed:", err);
        await Swal.fire({
          title: "Upload/Add comment failed",
          text: `Gagal upload atau menambahkan komentar: ${
            err?.message || err
          }`,
          icon: "error",
          background: dark ? "#111827" : undefined,
          color: dark ? "#e5e7eb" : undefined,
        });
        // stop save to avoid losing comment; keep modal open
        setUploading(false);
        setIsLoading(false);
        return;
      } finally {
        setUploading(false);
      }
    }

    // now safe to call onSave (parent will include comments)
    try {
      await onSave(toSave);
      // close modal only after successful save
      onClose();
    } catch (err: any) {
      console.error("onSave failed", err);
      await Swal.fire({
        title: "Save failed",
        text: err?.message || String(err),
        icon: "error",
        background: dark ? "#111827" : undefined,
        color: dark ? "#e5e7eb" : undefined,
      });
      // do not close modal on failure
    } finally {
      setIsLoading(false);
    }
  }

  function isEmptyQuill(html?: string | null) {
    if (!html) return true;

    // jika ada <img ...> treat as non-empty
    if (/<img[\s\S]*src=/.test(String(html))) return false;

    // replace common html entities
    let s = String(html)
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");

    // remove all tags and test remaining text
    s = s.replace(/<[^>]*>/g, "");
    s = s.replace(/\s+/g, "");

    return s.length === 0;
  }

  const openMediaViewer = (url: string, type: "image" | "video") => {
    setMediaViewerUrl(url);
    setMediaViewerType(type);
    setMediaViewerOpen(true);
  };

  const closeMediaViewer = () => {
    setMediaViewerOpen(false);
    setMediaViewerUrl("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Shell */}
      <div
        className="relative z-10 w-[90%] h-[92%] max-w-7xl rounded-2xl shadow-2xl shadow-black/20 overflow-hidden flex flex-col bg-white dark:bg-[#0f1117] text-slate-900 dark:text-slate-100 border border-gray-100/80 dark:border-gray-800/80"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ─── Header Bar ─── */}
        <div className="shrink-0 flex items-center justify-between gap-4 px-7 py-4 border-b border-gray-100 dark:border-gray-800/80 bg-white/80 dark:bg-[#0f1117]/90 backdrop-blur-sm">
          {/* Title input */}
          <input
            className="flex-1 text-xl font-bold bg-transparent outline-none placeholder-gray-300 dark:placeholder-gray-600 truncate"
            placeholder="Task name…"
            value={local.title}
            onChange={(e) => setLocal({ ...local, title: e.target.value })}
          />

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {/* WhatsApp */}
            <button
              type="button"
              onClick={() =>
                assigneePhones.forEach((phone) => {
                  if (!currentProjectName) return;
                  handleWhatsappTask(phone, task, currentProjectName);
                })
              }
              title="Send via WhatsApp"
              className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-800/30 transition-colors"
            >
              <WhatsappIcon />
            </button>

            {/* Delete */}
            <button
              type="button"
              onClick={handleDeleteClick}
              disabled={isLoading}
              title="Delete task"
              className="p-2 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-800/30 transition-colors"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash size={16} />
              )}
            </button>

            {/* Save */}
            <button
              type="button"
              disabled={isLoading || uploading}
              onClick={handleSaveClick}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white shadow-sm shadow-sky-200/50 dark:shadow-sky-900/30 active:scale-95 transition-all duration-150 disabled:opacity-60"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Save size={15} />
                  <span>Save</span>
                </>
              )}
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ─── Body ─── */}
        <div className="flex-1 overflow-hidden flex">
          {/* ─── Left Panel: meta + description ─── */}
          <div className="flex flex-col w-[55%] border-r border-gray-100 dark:border-gray-800/60 overflow-y-auto">
            {/* Meta fields */}
            <div className="px-7 py-5 space-y-4 border-b border-gray-100 dark:border-gray-800/60 bg-gray-50/60 dark:bg-white/[0.02]">
              {/* Assignee */}
              <div className="flex items-center gap-4">
                <span className="w-24 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider shrink-0">
                  Assignee
                </span>
                <div className="flex-1">
                  <AssigneeSelect
                    multiple
                    value={(local.taskAssignees ?? [])
                      .map((a) => a.id)
                      .filter(Boolean)}
                    team={team}
                    dark={dark}
                    onChange={(v) => {
                      const memberIds = Array.isArray(v) ? v : [];
                      setLocal((s: any) => ({
                        ...s,
                        taskAssignees: memberIds.map((id) => ({ id })),
                      }));
                    }}
                  />
                </div>
              </div>

              {/* Priority */}
              <div className="flex items-center gap-4">
                <span className="w-24 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider shrink-0">
                  Priority
                </span>
                <div className="flex-1">
                  <PrioritySelect
                    value={local.priority}
                    onChange={(v) => setLocal({ ...local, priority: v })}
                    dark={dark}
                  />
                </div>
              </div>

              {/* Labels */}
              <div className="flex items-start gap-4">
                <span className="w-24 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider shrink-0 pt-1.5">
                  Labels
                </span>
                <div className="flex-1">
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {(local.labels ?? []).map(
                      (lb: { name: string; color: string }, idx: number) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold text-white"
                          style={{ background: lb.color }}
                        >
                          {lb.name}
                          <button
                            type="button"
                            onClick={() =>
                              setLocal({
                                ...local,
                                labels: (local.labels ?? []).filter(
                                  (_: any, i: number) => i !== idx,
                                ),
                              })
                            }
                            className="ml-0.5 opacity-70 hover:opacity-100"
                          >
                            ×
                          </button>
                        </span>
                      ),
                    )}
                  </div>
                  <LabelAdder
                    onAdd={(lb) =>
                      setLocal({
                        ...local,
                        labels: [...(local.labels ?? []), lb],
                      })
                    }
                  />
                </div>
              </div>

              {/* Dependencies */}
              <div className="flex items-start gap-4">
                <span className="w-24 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider shrink-0 pt-1.5">
                  Depends
                </span>
                <div className="flex-1">
                  <div className="space-y-1 mb-2">
                    {(local.dependencies ?? []).map(
                      (dep: { taskId: string; type: string }, idx: number) => {
                        const depTask = allTasks.find(
                          (t) => t.id === dep.taskId,
                        );
                        return (
                          <div
                            key={idx}
                            className="flex items-center gap-2 text-xs bg-gray-50 dark:bg-gray-800 rounded-lg px-2.5 py-1.5"
                          >
                            <span
                              className={`font-semibold ${dep.type === "blocked_by" ? "text-red-500" : "text-blue-500"}`}
                            >
                              {dep.type === "blocked_by"
                                ? "Blocked by"
                                : "Blocks"}
                            </span>
                            <span className="text-gray-700 dark:text-gray-200 truncate flex-1">
                              {depTask?.title ?? dep.taskId}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setLocal({
                                  ...local,
                                  dependencies: (
                                    local.dependencies ?? []
                                  ).filter((_: any, i: number) => i !== idx),
                                })
                              }
                              className="text-gray-400 hover:text-red-500"
                            >
                              ×
                            </button>
                          </div>
                        );
                      },
                    )}
                  </div>
                  <DependencyAdder
                    allTasks={allTasks.filter(
                      (t) => t.id !== local.id && !t.isTrash,
                    )}
                    existingDeps={local.dependencies ?? []}
                    onAdd={(dep) =>
                      setLocal({
                        ...local,
                        dependencies: [...(local.dependencies ?? []), dep],
                      })
                    }
                  />
                </div>
              </div>

              {/* Time Tracking */}
              <div className="flex items-start gap-4">
                <span className="w-24 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider shrink-0 pt-1.5">
                  Time
                </span>
                <div className="flex-1">
                  <TimeTracker
                    entries={local.timeEntries ?? []}
                    currentMemberId={currentMemberId}
                    currentMemberName={currentMemberName ?? "Unknown"}
                    onChange={(entries) =>
                      setLocal({ ...local, timeEntries: entries })
                    }
                  />
                </div>
              </div>

              {/* Dates row */}
              <div className="flex items-center gap-4">
                <span className="w-24 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider shrink-0">
                  Start
                </span>
                <input
                  type="date"
                  value={local.startDate || ""}
                  onChange={(e) =>
                    setLocal({ ...local, startDate: e.target.value })
                  }
                  className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 text-sm outline-none focus:border-sky-400 dark:focus:border-sky-500 transition-colors"
                />
                <span className="text-gray-300 dark:text-gray-600 text-xs mx-1">
                  →
                </span>
                <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  Due
                </span>
                <input
                  type="date"
                  value={local.dueDate || ""}
                  onChange={(e) =>
                    setLocal({ ...local, dueDate: e.target.value })
                  }
                  className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 text-sm outline-none focus:border-sky-400 dark:focus:border-sky-500 transition-colors"
                />
              </div>

              {/* Recurrence */}
              <div className="flex items-center gap-4">
                <span className="w-24 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider shrink-0">
                  Repeat
                </span>
                <select
                  value={local.recurrence?.pattern ?? ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) {
                      setLocal({ ...local, recurrence: null });
                    } else {
                      setLocal({
                        ...local,
                        recurrence: {
                          ...(local.recurrence ?? {}),
                          pattern: val as any,
                          interval: local.recurrence?.interval ?? 1,
                        },
                      });
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 text-sm outline-none focus:border-sky-400 dark:focus:border-sky-500 transition-colors text-gray-700 dark:text-gray-200"
                >
                  <option value="">No repeat</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="custom">Custom</option>
                </select>
                {local.recurrence?.pattern === "custom" && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-400">every</span>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={local.recurrence?.interval ?? 1}
                      onChange={(e) =>
                        setLocal({
                          ...local,
                          recurrence: {
                            ...local.recurrence!,
                            interval: parseInt(e.target.value) || 1,
                          },
                        })
                      }
                      className="w-14 px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 text-sm outline-none text-center text-gray-700 dark:text-gray-200"
                    />
                    <span className="text-xs text-gray-400">days</span>
                  </div>
                )}
                {local.recurrence && (
                  <span className="text-[10px] text-emerald-500 font-semibold">
                    ✓ Recurring
                  </span>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="flex-1 px-7 py-5 flex flex-col">
              <h4 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
                Description
              </h4>
              <div className="flex-1 rounded-xl border border-gray-100 dark:border-gray-700/60 overflow-hidden bg-white dark:bg-gray-800/30 min-h-[200px]">
                <ReactQuill
                  id="description"
                  theme="snow"
                  value={local?.description}
                  onChange={(value: any) =>
                    setLocal({ ...local, description: value })
                  }
                  placeholder="Add a description…"
                />
              </div>
            </div>
          </div>

          {/* ─── Right Panel: comments ─── */}
          <div className="flex flex-col w-[45%] overflow-hidden">
            {/* Comment list */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <h4 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">
                Comments
                {(local.comments || []).length > 0 && (
                  <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400 text-xs font-bold">
                    {(local.comments || []).length}
                  </span>
                )}
              </h4>

              {(local.comments || []).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-300 dark:text-gray-600 gap-3">
                  <FaComment size={32} />
                  <p className="text-sm">No comments yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(local.comments || []).map((c) => {
                    const initials = (c.author ?? "?")
                      .slice(0, 2)
                      .toUpperCase();
                    const hue = c.author
                      ? c.author
                          .split("")
                          .reduce(
                            (a: number, ch: string) => a + ch.charCodeAt(0),
                            0,
                          ) % 360
                      : 200;
                    return (
                      <div key={c.id} className="flex gap-3 group">
                        {/* Avatar */}
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-sm"
                          style={{ background: `hsl(${hue},65%,52%)` }}
                        >
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="text-sm font-semibold">
                              {c.author}
                            </span>
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                              {new Date(c.createdAt).toLocaleString(undefined, {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed bg-gray-50 dark:bg-gray-800/40 rounded-xl px-4 py-2.5 border border-gray-100 dark:border-gray-700/40">
                            {parse(c.body)}
                          </div>

                          {/* Attachments */}
                          {c.attachments && c.attachments.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {c.attachments.map((a: any) => {
                                const isImage =
                                  a.type?.startsWith("image/") ||
                                  /\.(png|jpg|jpeg|gif|webp)$/i.test(a.name);
                                const isVideo =
                                  a.type?.startsWith("video/") ||
                                  /\.(mp4|webm|mov)$/i.test(a.name);

                                return (
                                  <div
                                    key={a.id}
                                    className="rounded-xl overflow-hidden border border-gray-100 dark:border-gray-700/50 bg-white dark:bg-gray-800/40 shadow-sm"
                                  >
                                    {a.url && isImage && (
                                      <img
                                        src={a.url}
                                        alt={a.name}
                                        onClick={() =>
                                          openMediaViewer(a.url, "image")
                                        }
                                        className="max-h-44 max-w-[220px] object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                        title="Click to expand"
                                      />
                                    )}
                                    {a.url && isVideo && (
                                      <div
                                        className="relative cursor-pointer"
                                        onClick={() =>
                                          openMediaViewer(a.url, "video")
                                        }
                                      >
                                        <video
                                          src={a.url}
                                          className="max-h-44 max-w-[220px]"
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                          <div className="w-10 h-10 rounded-full bg-white/80 flex items-center justify-center">
                                            <div className="w-0 h-0 border-t-[7px] border-t-transparent border-l-[12px] border-l-gray-800 border-b-[7px] border-b-transparent ml-1" />
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                    {!isImage && !isVideo && (
                                      <div className="flex items-center gap-2 px-3 py-2 text-sm">
                                        <File
                                          size={15}
                                          className="text-gray-400"
                                        />
                                        <span className="max-w-[160px] truncate text-gray-600 dark:text-gray-300">
                                          {a.name}
                                        </span>
                                        <span className="text-xs text-gray-400">
                                          ({Math.round((a.size || 0) / 1024)}KB)
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Comment composer */}
            <div className="shrink-0 border-t border-gray-100 dark:border-gray-800/60 px-6 py-4 bg-gray-50/50 dark:bg-white/[0.02] space-y-3">
              <div className="relative rounded-xl border border-gray-200 dark:border-gray-700/60 overflow-visible bg-white dark:bg-gray-800/30">
                <ReactQuill
                  id="commentText"
                  theme="snow"
                  value={commentText}
                  onChange={(val: string) => {
                    setCommentText(val);
                    // Check for @mention trigger
                    const text = val.replace(/<[^>]*>/g, "");
                    const atMatch = text.match(/@(\w*)$/);
                    if (atMatch) {
                      setMentionQuery(atMatch[1]);
                      setMentionOpen(true);
                    } else {
                      setMentionOpen(false);
                    }
                  }}
                  placeholder="Write a comment… (type @ to mention)"
                />
                {mentionOpen && (
                  <div className="absolute bottom-full left-2 mb-1 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-30 max-h-40 overflow-y-auto">
                    {team
                      .filter(
                        (m) =>
                          !m.isTrash &&
                          m.name
                            ?.toLowerCase()
                            .includes(mentionQuery.toLowerCase()),
                      )
                      .slice(0, 8)
                      .map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            const plain = commentText.replace(/<[^>]*>/g, "");
                            const idx = plain.lastIndexOf("@");
                            if (idx >= 0) {
                              const before = commentText.substring(
                                0,
                                commentText.lastIndexOf("@"),
                              );
                              setCommentText(
                                before +
                                  `<strong class="text-sky-500">@${m.name}</strong>&nbsp;`,
                              );
                            }
                            setMentionOpen(false);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 text-left transition-colors"
                        >
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center text-[10px] text-white font-bold shrink-0">
                            {m.name?.[0]?.toUpperCase() ?? "?"}
                          </div>
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-200 truncate">
                            {m.name}
                          </span>
                        </button>
                      ))}
                    {team.filter(
                      (m) =>
                        !m.isTrash &&
                        m.name
                          ?.toLowerCase()
                          .includes(mentionQuery.toLowerCase()),
                    ).length === 0 && (
                      <p className="text-xs text-gray-400 py-2 text-center">
                        No matches
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Pending files */}
              {files.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {files.map((f, i) => (
                    <div
                      key={i}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-sky-200 dark:border-sky-700/40 bg-sky-50 dark:bg-sky-900/20 text-xs text-sky-700 dark:text-sky-300"
                    >
                      <File size={13} />
                      <span className="max-w-[120px] truncate">{f.name}</span>
                      <button
                        type="button"
                        onClick={() => removePendingFile(i)}
                        className="text-sky-400 hover:text-red-500 transition-colors ml-1"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between gap-2">
                {/* Attach files */}
                <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700/60 bg-white dark:bg-gray-800/50 text-sm text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <Paperclip size={15} className="text-gray-400" />
                  <span>Attach</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".png,.jpg,.jpeg,.pdf,.docx,video/*"
                    onChange={onFileChange}
                    className="hidden"
                  />
                </label>

                {/* Send comment */}
                <button
                  onClick={handleAddComment}
                  disabled={uploading}
                  className="inline-flex items-center gap-2 px-4 py-1.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white active:scale-95 transition-all duration-150 disabled:opacity-60 shadow-sm shadow-sky-200/40 dark:shadow-sky-900/30"
                >
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Send size={14} />
                      <span>Send</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Media Viewer */}
      <MediaModal
        isOpen={mediaViewerOpen}
        url={mediaViewerUrl}
        type={mediaViewerType}
        onClose={closeMediaViewer}
      />
    </div>
  );
}

const LABEL_PRESETS = [
  { name: "Bug", color: "#ef4444" },
  { name: "Feature", color: "#3b82f6" },
  { name: "Improvement", color: "#8b5cf6" },
  { name: "Hotfix", color: "#f97316" },
  { name: "Documentation", color: "#06b6d4" },
  { name: "Design", color: "#ec4899" },
  { name: "Backend", color: "#10b981" },
  { name: "Frontend", color: "#6366f1" },
];

function LabelAdder({
  onAdd,
}: {
  onAdd: (lb: { name: string; color: string }) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [custom, setCustom] = React.useState("");
  const [customColor, setCustomColor] = React.useState("#6366f1");

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-gray-400 hover:text-sky-500 transition-colors"
      >
        + Add label
      </button>
      {open && (
        <div className="absolute z-20 top-6 left-0 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-2.5 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {LABEL_PRESETS.map((lb) => (
              <button
                key={lb.name}
                type="button"
                onClick={() => {
                  onAdd(lb);
                  setOpen(false);
                }}
                className="px-2 py-0.5 rounded-full text-[10px] font-semibold text-white hover:opacity-80 transition-opacity"
                style={{ background: lb.color }}
              >
                {lb.name}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 pt-1 border-t border-gray-100 dark:border-gray-700">
            <input
              type="color"
              value={customColor}
              onChange={(e) => setCustomColor(e.target.value)}
              className="w-6 h-6 rounded cursor-pointer border-0 p-0"
            />
            <input
              type="text"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Custom label"
              className="flex-1 text-xs bg-transparent outline-none text-gray-700 dark:text-gray-200 placeholder-gray-400"
              onKeyDown={(e) => {
                if (e.key === "Enter" && custom.trim()) {
                  onAdd({ name: custom.trim(), color: customColor });
                  setCustom("");
                  setOpen(false);
                }
              }}
            />
            <button
              type="button"
              onClick={() => {
                if (custom.trim()) {
                  onAdd({ name: custom.trim(), color: customColor });
                  setCustom("");
                  setOpen(false);
                }
              }}
              className="text-xs text-sky-500 hover:text-sky-600 font-semibold"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DependencyAdder({
  allTasks,
  existingDeps,
  onAdd,
}: {
  allTasks: Task[];
  existingDeps: { taskId: string; type: string }[];
  onAdd: (dep: { taskId: string; type: "blocked_by" | "blocks" }) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [depType, setDepType] = React.useState<"blocked_by" | "blocks">(
    "blocked_by",
  );

  const existingIds = new Set(existingDeps.map((d) => d.taskId));
  const filtered = allTasks
    .filter((t) => !existingIds.has(t.id))
    .filter(
      (t) => !search || t.title.toLowerCase().includes(search.toLowerCase()),
    )
    .slice(0, 10);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-gray-400 hover:text-sky-500 transition-colors"
      >
        + Add dependency
      </button>
      {open && (
        <div className="absolute z-20 top-6 left-0 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-3 space-y-2">
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setDepType("blocked_by")}
              className={`flex-1 text-[11px] py-1 rounded-lg font-semibold transition-colors ${
                depType === "blocked_by"
                  ? "bg-red-100 dark:bg-red-900/30 text-red-600"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-500"
              }`}
            >
              Blocked by
            </button>
            <button
              type="button"
              onClick={() => setDepType("blocks")}
              className={`flex-1 text-[11px] py-1 rounded-lg font-semibold transition-colors ${
                depType === "blocks"
                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-500"
              }`}
            >
              Blocks
            </button>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks..."
            className="w-full text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 outline-none text-gray-700 dark:text-gray-200 placeholder-gray-400"
          />
          <div className="max-h-40 overflow-y-auto space-y-0.5">
            {filtered.length === 0 && (
              <p className="text-[11px] text-gray-400 py-2 text-center">
                No tasks found
              </p>
            )}
            {filtered.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  onAdd({ taskId: t.id, type: depType });
                  setSearch("");
                  setOpen(false);
                }}
                className="w-full text-left text-xs px-2.5 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 truncate transition-colors"
              >
                {t.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function TimeTracker({
  entries,
  currentMemberId,
  currentMemberName,
  onChange,
}: {
  entries: {
    memberId: string;
    memberName: string;
    start: string;
    end?: string;
    duration?: number;
  }[];
  currentMemberId: string;
  currentMemberName: string;
  onChange: (entries: any[]) => void;
}) {
  const activeEntry = entries.find(
    (e) => e.memberId === currentMemberId && !e.end,
  );
  const [elapsed, setElapsed] = React.useState(0);

  React.useEffect(() => {
    if (!activeEntry) {
      setElapsed(0);
      return;
    }
    const start = new Date(activeEntry.start).getTime();
    const tick = () => setElapsed(Date.now() - start);
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [activeEntry?.start]);

  const handleStart = () => {
    onChange([
      ...entries,
      {
        memberId: currentMemberId,
        memberName: currentMemberName,
        start: new Date().toISOString(),
      },
    ]);
  };

  const handleStop = () => {
    const now = new Date().toISOString();
    onChange(
      entries.map((e) => {
        if (e.memberId === currentMemberId && !e.end) {
          const dur = new Date(now).getTime() - new Date(e.start).getTime();
          return { ...e, end: now, duration: dur };
        }
        return e;
      }),
    );
  };

  const totalTime = entries.reduce((sum, e) => sum + (e.duration ?? 0), 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {activeEntry ? (
          <>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-bold">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              {formatDuration(elapsed)}
            </div>
            <button
              type="button"
              onClick={handleStop}
              className="text-xs px-3 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 font-semibold transition-colors"
            >
              Stop
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={handleStart}
            className="text-xs px-3 py-1.5 rounded-lg bg-sky-500 text-white hover:bg-sky-600 font-semibold transition-colors"
          >
            Start Timer
          </button>
        )}
        {totalTime > 0 && (
          <span className="text-[11px] text-gray-400">
            Total: {formatDuration(totalTime)}
          </span>
        )}
      </div>
      {entries.filter((e) => e.end).length > 0 && (
        <div className="space-y-1 max-h-24 overflow-y-auto">
          {entries
            .filter((e) => e.end)
            .slice(-5)
            .map((e, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400"
              >
                <span className="font-semibold">{e.memberName}</span>
                <span>{formatDuration(e.duration ?? 0)}</span>
                <span className="text-gray-300 dark:text-gray-600">
                  {new Date(e.start).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
