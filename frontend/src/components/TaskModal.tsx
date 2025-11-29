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
} from "lucide-react";
import Swal from "sweetalert2";
import type { Task, Attachment, TeamMember } from "../types";
import uploadMultipleFilesToS3 from "../utils/uploadFile";
import { PrioritySelect } from "./PrioritySelect";
import { AssigneeSelect } from "./AssigneeSelect";
import { handleWhatsapp, handleWhatsappTask } from "../utils/sendWhatsapp";
import WhatsappIcon from "./WhatsappIcon";
import { useAuthStore } from "../utils/store";
import { FaComment } from "react-icons/fa";

export default function TaskModal({
  projects,
  activeProjectId,
  currentMemberId,
  task,
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
  dark: boolean;
  onClose: () => void;
  onSave: (t: Task) => void;
  onAddComment: (
    author: string,
    body: string,
    attachments?: Attachment[]
  ) => void;
  onDelete: (id: string) => void;
  team: TeamMember[];
}) {
  const [local, setLocal] = useState<Task>(task);
  const [commentText, setCommentText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const currentAssignee = team.find((t) => t.id === task.assigneeId);
  const assigneePhone = currentAssignee?.phone || "";
  const user = useAuthStore((s) => s.user);
  const currentMemberName = user?.name ?? null;

  const currentProject = useMemo(
    () => projects.find((m) => String(m.id) === String(activeProjectId)),
    [projects, activeProjectId]
  );
  const currentProjectName = currentProject?.name ?? null;

  useEffect(() => {
    const derived: Task = { ...task };

    if ((derived as any).startDate instanceof Date) {
      (derived as any).startDate = (derived as any).startDate
        .toISOString()
        .slice(0, 10);
    }
    if ((derived as any).dueDate instanceof Date) {
      (derived as any).dueDate = (derived as any).dueDate
        .toISOString()
        .slice(0, 10);
    }

    if (!derived.assigneeName && derived.assigneeId && Array.isArray(team)) {
      const m = team.find((x) => x.id === derived.assigneeId);
      if (m) derived.assigneeName = m.name;
    }

    if (!derived.assigneeId && derived.assigneeName && Array.isArray(team)) {
      const m = team.find((x) => x.name === derived.assigneeName);
      if (m) derived.assigneeId = m.id;
    }

    setLocal(derived);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task, team]);

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
        attachments
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

  function handleAssigneeChange(v: any) {
    if (!v) {
      setLocal((s) => ({ ...s, assigneeId: null, assigneeName: null }));
      return;
    }

    if (typeof v === "string") {
      let member = team.find((m) => m.id === v);
      if (!member) member = team.find((m) => m.name === v);
      setLocal((s) => ({
        ...s,
        assigneeName: member?.name ?? v ?? null,
        assigneeId: member?.id ?? null,
      }));
      return;
    }

    if (typeof v === "object") {
      const id = (v.id as string) ?? (v.value as string) ?? null;
      const name = (v.name as string) ?? (v.label as string) ?? null;
      if (id) {
        const member = team.find((m) => m.id === id);
        setLocal((s) => ({
          ...s,
          assigneeId: id,
          assigneeName: name ?? member?.name ?? null,
        }));
        return;
      }
      if (name) {
        const member = team.find((m) => m.name === name);
        setLocal((s) => ({
          ...s,
          assigneeName: name,
          assigneeId: member ? member.id : null,
        }));
        return;
      }

      setLocal((s) => ({
        ...s,
        assigneeName: v ?? null,
        assigneeId: null,
      }));
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
    }
  };

  // --- tambahkan bersama function lainnya di komponen (mis. setelah handleAssigneeChange) ---
  // props: onAddComment: (author, body, attachments?) => Promise<any>

  async function handleSaveClick() {
    setIsLoading(true);
    const toSave: Task = { ...local };

    // normalize simple empty strings -> null like sebelumya
    if (!toSave.assigneeId && toSave.assigneeName) {
      const member = team.find((m) => m.name === toSave.assigneeName);
      if (member) toSave.assigneeId = member.id;
    }
    if (toSave.assigneeId === "") toSave.assigneeId = null;
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
            attachments
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-black/40 via-black/30 to-black/20 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal wrapper: rounded + overflow-hidden so corners stay rounded */}
      <div
        className="relative z-10 w-[86%] h-[92%] rounded-xl shadow-2xl bg-slate-100 dark:bg-gray-900 text-slate-900 dark:text-slate-100 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Layout: header (fixed inside modal) + scrollable content */}
        <div className="h-full flex flex-col">
          {/* Header: only title + action buttons (non-scrolling) */}
          <div className="shrink-0 px-8 pt-8 pb-4 flex items-start justify-between bg-transparent">
            <div className="w-full pr-6">
              <input
                className="text-3xl font-extrabold w-full bg-transparent outline-none mb-2 py-2"
                placeholder="Task Name"
                value={local.title}
                onChange={(e) => setLocal({ ...local, title: e.target.value })}
              />
            </div>

            <div className="flex gap-3 ml-4">
              <button
                type="button"
                onClick={() =>
                  handleWhatsappTask(
                    assigneePhone ?? "",
                    task,
                    currentProjectName
                  )
                }
                title="Whatsapp assignee"
                aria-label="Send Whatsapp to assignee"
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium shadow-sm
               bg-green-500/95 hover:bg-green-600/95 text-white
               dark:bg-green-300/20 dark:text-white dark:hover:bg-green-400/30
               transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-300"
              >
                <WhatsappIcon />
              </button>

              <button
                type="button"
                disabled={isLoading || uploading}
                onClick={handleSaveClick}
                className="group inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
             bg-gradient-to-r from-sky-500 to-sky-600 text-white
             hover:from-sky-600 hover:to-sky-700
             active:scale-95 transition-all duration-300
             dark:from-sky-600 dark:to-sky-700 dark:hover:from-sky-700 dark:hover:to-sky-800"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Save
                      size={16}
                      className="transition-transform duration-300 group-hover:-rotate-6"
                    />
                    <span>Save</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onClose}
                className="ml-2 flex items-center gap-2 px-2 py-2 rounded-lg text-sm font-medium
                bg-slate-100 dark:bg-gray-900
               text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800
               transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
              >
                <X size={24} />
              </button>
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-auto px-8 pb-8">
            {/* Assignee / Priority / Dates (moved to scrollable area) */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div className="flex items-center gap-4 text-base">
                <label className="w-28 text-sm font-medium">Assignee</label>
                <div className="flex-1">
                  <AssigneeSelect
                    value={local.assigneeId ?? local.assigneeName ?? ""}
                    onChange={handleAssigneeChange}
                    dark={dark}
                    team={team}
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 text-base">
                <label className="w-28 text-sm font-medium">Priority</label>
                <div className="flex-1">
                  <PrioritySelect
                    value={local.priority}
                    onChange={(v) => setLocal({ ...local, priority: v })}
                    dark={dark}
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 text-base">
                <label className="w-28 text-sm font-medium">Start</label>
                <input
                  type="date"
                  value={local.startDate || ""}
                  onChange={(e) =>
                    setLocal({ ...local, startDate: e.target.value })
                  }
                  className="border px-3 py-2 rounded-lg bg-transparent border-gray-200 dark:border-gray-700 text-sm"
                />
              </div>

              <div className="flex items-center gap-4 text-base">
                <label className="w-28 text-sm font-medium">Due</label>
                <input
                  type="date"
                  value={local.dueDate || ""}
                  onChange={(e) =>
                    setLocal({ ...local, dueDate: e.target.value })
                  }
                  className="border px-3 py-2 rounded-lg bg-transparent border-gray-200 dark:border-gray-700 text-sm"
                />
              </div>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-8">
              <div>
                <h4 className="font-semibold text-lg mb-3">Description</h4>
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 min-h-[220px] bg-transparent">
                  <ReactQuill
                    id="description"
                    theme="snow"
                    value={local?.description}
                    onChange={(value: any) =>
                      setLocal({ ...local, description: value })
                    }
                    placeholder="Description"
                  />
                </div>

                {/* Delete button moved inside scrollable content (not fixed) */}
                <div className="mt-25">
                  <button
                    onClick={handleDeleteClick}
                    disabled={uploading}
                    className="px-4 py-2 bg-gray-800 hover:bg-red-400 text-white rounded-lg shadow-md text-sm flex gap-2"
                    title="Delete task"
                  >
                    <Trash size={16} /> Delete task
                  </button>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-lg mb-3">Comments</h4>

                <div className="max-h-[40vh] overflow-y-auto border rounded-lg p-3 border-gray-200 dark:border-gray-700 bg-transparent">
                  {(local.comments || []).length === 0 && (
                    <div className="text-sm text-gray-500 dark:text-gray-400 py-4">
                      No comments yet.
                    </div>
                  )}

                  {(local.comments || []).map((c) => (
                    <div
                      key={c.id}
                      className="p-4 border-b border-gray-100 dark:border-gray-800"
                    >
                      <div className="text-sm font-medium mb-2">
                        {c.author}{" "}
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {" "}
                          {new Date(c.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-sm mt-1 mb-3">{parse(c.body)}</div>

                      {c.attachments && c.attachments.length > 0 && (
                        <div className="mt-2">
                          <div className="text-xs text-gray-400 mb-2">
                            Attachments:
                          </div>

                          <div className="flex flex-col gap-3">
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
                                  className="flex flex-col p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent gap-2"
                                >
                                  {/* PREVIEW */}
                                  {a.url && (
                                    <>
                                      {isImage && (
                                        <img
                                          src={a.url}
                                          alt={a.name}
                                          className="max-h-60 rounded-lg object-cover"
                                        />
                                      )}

                                      {isVideo && (
                                        <video
                                          src={a.url}
                                          controls
                                          className="max-h-60 rounded-lg"
                                        />
                                      )}
                                    </>
                                  )}

                                  {/* INFO */}
                                  <div className="flex items-center justify-between">
                                    <div className="text-sm">
                                      {a.name}{" "}
                                      <span className="text-xs text-gray-400">
                                        ({Math.round((a.size || 0) / 1024)} KB)
                                      </span>
                                    </div>

                                    <div>
                                      {a.url ? (
                                        <a
                                          href={a.url}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="text-sm underline"
                                        >
                                          Open
                                        </a>
                                      ) : (
                                        <span className="text-xs text-gray-400">
                                          (no url)
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-4">
                  <div className="gap-2">
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 bg-transparent">
                      <ReactQuill
                        id="commentText"
                        theme="snow"
                        value={commentText}
                        onChange={setCommentText}
                        placeholder="Write a comment"
                      />
                    </div>

                    <div className="flex gap-4 my-4 items-center">
                      <label
                        className="flex items-center gap-2 px-4 py-2 rounded-lg border 
             border-gray-300 dark:border-gray-700 bg-slate-100 dark:bg-gray-900 
             text-slate-700 dark:text-slate-200 cursor-pointer text-sm
             hover:bg-gray-50 dark:hover:bg-gray-800 transition 
             focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 shadow-sm"
                      >
                        <Paperclip
                          size={18}
                          className="text-slate-600 dark:text-slate-300"
                        />
                        <span>Attach files</span>

                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          accept=".png,.jpg,.jpeg,.pdf,.docx,video/*"
                          onChange={onFileChange}
                          className="hidden"
                        />
                      </label>

                      <button
                        onClick={handleAddComment}
                        disabled={uploading}
                        className={`group inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
              bg-gradient-to-r from-sky-500 to-sky-600 text-white
              hover:from-sky-600 hover:to-sky-700
              active:scale-95 transition-all duration-300
              ${
                uploading ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
              }`}
                      >
                        {uploading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <MessageSquare
                              size={16}
                              className="transition-transform duration-300 group-hover:-rotate-6"
                            />
                            <span>Comment</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {files.length > 0 && (
                    <div className="mt-2">
                      <div className="text-sm text-gray-400 mb-2">
                        Files to upload:
                      </div>
                      <div className="flex gap-3 flex-wrap mt-2">
                        {files.map((f, i) => (
                          <div
                            key={i}
                            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm flex items-center gap-3 bg-transparent"
                          >
                            <div className="flex items-center gap-3">
                              <File size={16} />
                              <div className="max-w-xs truncate">{f.name}</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => removePendingFile(i)}
                              className="text-sm text-red-500"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
