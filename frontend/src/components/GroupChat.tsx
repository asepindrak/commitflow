import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { io, Socket } from "socket.io-client";
import {
  Send,
  Hash,
  Smile,
  Paperclip,
  X,
  File,
  Film,
  Image,
  FileText,
  CornerUpLeft,
  Search,
  FolderOpen,
  Download,
  Trash2,
  AtSign,
  Pin,
} from "lucide-react";
import type { TeamMember } from "../types";
import { useAuthStore } from "../utils/store";
import { apiFetch } from "../utils/apiFetch";
import { useChatNotifStore } from "../utils/useChatNotifStore";
import { usePresenceStore } from "../utils/usePresenceStore";
import { playSound } from "../utils/playSound";

const BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

// ─── Max file size: 50 MB ────────────────────────────────────────────────────
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// ─── Types ───────────────────────────────────────────────────────────────────
type ChatAttachment = {
  url: string;
  name: string;
  type: string; // mime type
  size: number;
};

type ChatMessage = {
  id: string;
  workspaceId: string;
  memberId: string;
  memberName: string;
  memberPhoto?: string | null;
  content: string;
  attachments?: ChatAttachment[] | null;
  replyTo?: {
    id: string;
    memberName: string;
    content: string;
    attachments?: ChatAttachment[] | null;
  } | null;
  isPinned?: boolean;
  createdAt: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function nameToHue(name = "") {
  return name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
}

function initials(name = "") {
  return name
    .split(" ")
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString([], {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

function sameDay(a: string, b: string) {
  try {
    return new Date(a).toDateString() === new Date(b).toDateString();
  } catch {
    return false;
  }
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ─── Render text with @mention highlights ────────────────────────────────────
function RichContent({ text, isMine }: { text: string; isMine: boolean }) {
  const parts = text.split(/(@\w[\w\s]*?\w(?=\s|$|[.,!?;:])|@\w+)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("@") ? (
          <span
            key={i}
            className={`font-semibold ${
              isMine
                ? "text-sky-100 bg-white/20"
                : "text-sky-500 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/30"
            } rounded px-0.5`}
          >
            {part}
          </span>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </>
  );
}

function isImage(type: string) {
  return type.startsWith("image/");
}

function isVideo(type: string) {
  return type.startsWith("video/");
}

function AttachmentIcon({ type, size = 16 }: { type: string; size?: number }) {
  if (isImage(type)) return <Image size={size} />;
  if (isVideo(type)) return <Film size={size} />;
  if (
    type.includes("pdf") ||
    type.includes("document") ||
    type.includes("word") ||
    type.includes("text")
  )
    return <FileText size={size} />;
  return <File size={size} />;
}

// ─── Avatar ──────────────────────────────────────────────────────────────────
function Avatar({
  name,
  photo,
  size = 32,
}: {
  name: string;
  photo?: string | null;
  size?: number;
}) {
  const hue = nameToHue(name);
  return (
    <div
      className="rounded-full shrink-0 flex items-center justify-center font-semibold overflow-hidden"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: photo ? undefined : `hsl(${hue}, 65%, 88%)`,
        color: `hsl(${hue}, 60%, 28%)`,
      }}
    >
      {photo ? (
        <img
          src={photo}
          alt={name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <span className="select-none">{initials(name)}</span>
      )}
    </div>
  );
}

// ─── Pending attachment (before upload) ─────────────────────────────────────
type PendingFile = {
  file: File;
  previewUrl: string | null; // local blob URL for images
  uploading: boolean;
  error: string | null;
  result: ChatAttachment | null;
};

// ─── Attachment renderer ─────────────────────────────────────────────────────
function AttachmentBubble({
  att,
  isMine,
}: {
  att: ChatAttachment;
  isMine: boolean;
}) {
  if (isImage(att.type)) {
    return (
      <a
        href={att.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        <img
          src={att.url}
          alt={att.name}
          className="max-w-[260px] max-h-[200px] rounded-xl object-cover border border-black/10 hover:opacity-90 transition-opacity"
          loading="lazy"
        />
      </a>
    );
  }

  if (isVideo(att.type)) {
    return (
      <video
        src={att.url}
        controls
        className="max-w-[280px] rounded-xl border border-black/10"
        style={{ maxHeight: 200 }}
      />
    );
  }

  // Doc / other file — card with large icon
  const ext = att.name.split(".").pop()?.toUpperCase() ?? "";
  const iconColor = att.type.includes("pdf")
    ? "text-red-500 bg-red-50 dark:bg-red-900/20"
    : att.type.includes("word") || att.type.includes("document")
      ? "text-blue-500 bg-blue-50 dark:bg-blue-900/20"
      : att.type.includes("sheet") ||
          att.type.includes("excel") ||
          att.type.includes("csv")
        ? "text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20"
        : att.type.includes("presentation") || att.type.includes("powerpoint")
          ? "text-orange-500 bg-orange-50 dark:bg-orange-900/20"
          : "text-gray-500 bg-gray-100 dark:bg-gray-800";

  return (
    <a
      href={att.url}
      target="_blank"
      rel="noopener noreferrer"
      download={att.name}
      className={`flex items-center gap-3 px-3.5 py-3 rounded-xl transition-colors border ${
        isMine
          ? "bg-white/15 hover:bg-white/25 text-white border-white/20"
          : "bg-white dark:bg-gray-800/80 hover:bg-gray-50 dark:hover:bg-gray-800 text-slate-700 dark:text-slate-200 border-gray-200 dark:border-gray-700/60"
      }`}
      style={{ minWidth: 220 }}
    >
      <div
        className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
          isMine ? "bg-white/20 text-white" : iconColor
        }`}
      >
        <AttachmentIcon type={att.type} size={22} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="truncate text-xs font-semibold leading-tight">
          {att.name}
        </div>
        <div
          className={`text-[10px] mt-0.5 flex items-center gap-1.5 ${isMine ? "text-white/60" : "text-gray-400"}`}
        >
          <span>{ext}</span>
          <span>·</span>
          <span>{formatBytes(att.size)}</span>
        </div>
      </div>
      <Download
        size={14}
        className={`shrink-0 ${isMine ? "text-white/50" : "text-gray-300"}`}
      />
    </a>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function GroupChat({
  workspaceId,
  workspaceName,
  team,
  isPlaySound = true,
}: {
  workspaceId: string;
  workspaceName: string;
  team: TeamMember[];
  isPlaySound?: boolean;
}) {
  const userId = useAuthStore((s) => s.userId);
  const user = useAuthStore((s) => s.user);
  const pushChatNotif = useChatNotifStore((s) => s.push);

  const me = team.find(
    (m) => m.userId === userId && m.workspaceId === workspaceId,
  );
  const myMemberId = me?.id ?? userId ?? "unknown";
  const myName = me?.name ?? user?.name ?? "You";
  const myPhoto = me?.photo ?? user?.photo ?? null;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [fileManagerOpen, setFileManagerOpen] = useState(false);
  const [fileManagerTab, setFileManagerTab] = useState<"images" | "files">(
    "images",
  );
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIdx, setMentionIdx] = useState(0);
  const [pinnedOpen, setPinnedOpen] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Stable refs for values used inside socket callbacks
  const myMemberIdRef = useRef(myMemberId);
  myMemberIdRef.current = myMemberId;
  const myNameRef = useRef(myName);
  myNameRef.current = myName;
  const isPlaySoundRef = useRef(isPlaySound);
  isPlaySoundRef.current = isPlaySound;

  // ── Load history ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!workspaceId) return;
    setLoading(true);
    apiFetch(
      `${BASE}/api/group-chat/messages?workspaceId=${workspaceId}&limit=100`,
    )
      .then((r) => r.json())
      .then((data: ChatMessage[]) =>
        setMessages(Array.isArray(data) ? data : []),
      )
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  }, [workspaceId]);

  // ── Socket.IO ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!workspaceId || !BASE) return;

    const socket = io(BASE, {
      transports: ["websocket", "polling"],
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("group-chat:join", {
        workspaceId,
        memberId: myMemberIdRef.current,
        memberName: myNameRef.current,
      });
    });

    socket.on("disconnect", () => setConnected(false));

    // ── Presence ──────────────────────────────────────────────────────────
    socket.on(
      "presence:list",
      (data: { online: string[]; lastSeen: Record<string, string> }) => {
        usePresenceStore.getState().setList(data.online, data.lastSeen);
      },
    );
    socket.on(
      "presence:update",
      (data: {
        memberId: string;
        status: "online" | "offline";
        lastSeen?: string;
      }) => {
        usePresenceStore
          .getState()
          .setPresence(data.memberId, data.status, data.lastSeen);
      },
    );

    socket.on("group-chat:message", (msg: ChatMessage) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });

      // Push notification for messages from others
      if (msg.memberId !== myMemberIdRef.current) {
        const isMention = msg.content
          ?.toLowerCase()
          .includes(`@${myNameRef.current.toLowerCase()}`);
        pushChatNotif({
          id: msg.id,
          type: isMention ? "mention" : "message",
          senderName: msg.memberName,
          content: msg.content,
          workspaceName,
          createdAt: msg.createdAt,
        });
        playSound("/sounds/incoming.mp3", isPlaySoundRef.current);
      }
    });

    socket.on("group-chat:deleted", ({ messageId }: { messageId: string }) => {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    });

    socket.on(
      "group-chat:pinned",
      ({ messageId, isPinned }: { messageId: string; isPinned: boolean }) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, isPinned } : m)),
        );
      },
    );

    return () => {
      socket.emit("group-chat:leave", { workspaceId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [workspaceId]);

  // ── Auto scroll ─────────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── File picker ─────────────────────────────────────────────────────────────
  const handleFilesPicked = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newEntries: PendingFile[] = Array.from(files)
      .filter((f) => f.size <= MAX_FILE_SIZE)
      .map((file) => ({
        file,
        previewUrl: isImage(file.type) ? URL.createObjectURL(file) : null,
        uploading: false,
        error: null,
        result: null,
      }));
    setPendingFiles((prev) => [...prev, ...newEntries]);
    // reset file input so same file can be re-picked
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePending = (idx: number) => {
    setPendingFiles((prev) => {
      const copy = [...prev];
      const entry = copy.splice(idx, 1)[0];
      if (entry?.previewUrl) URL.revokeObjectURL(entry.previewUrl);
      return copy;
    });
  };

  // ── Upload pending files ─────────────────────────────────────────────────────
  const uploadPendingFiles = async (): Promise<ChatAttachment[]> => {
    if (pendingFiles.length === 0) return [];

    const results: ChatAttachment[] = [];
    const failedNames: string[] = [];

    for (let i = 0; i < pendingFiles.length; i++) {
      const entry = pendingFiles[i];

      // already successfully uploaded in a previous attempt
      if (entry.result) {
        results.push(entry.result);
        continue;
      }

      // mark as uploading
      setPendingFiles((prev) =>
        prev.map((p, idx) =>
          idx === i ? { ...p, uploading: true, error: null } : p,
        ),
      );

      const formData = new FormData();
      // Ensure correct filename & mime type are provided to multer
      const mimeType = entry.file.type || "application/octet-stream";
      const blob = entry.file.slice(0, entry.file.size, mimeType);
      formData.append("file", blob, entry.file.name);
      formData.append("folder", "group-chat");

      try {
        const res = await apiFetch(`${BASE}/upload`, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          let errMsg = `Upload failed (${res.status})`;
          try {
            const errJson = await res.json();
            if (errJson?.message) errMsg = String(errJson.message);
          } catch {
            /* ignore */
          }
          throw new Error(errMsg);
        }

        const json = await res.json();
        const url = json.uploaded?.[0]?.url;
        if (!url) throw new Error("Server returned no URL");

        const uploaded: ChatAttachment = {
          url,
          name: entry.file.name,
          type: mimeType,
          size: entry.file.size,
        };
        results.push(uploaded);

        setPendingFiles((prev) =>
          prev.map((p, idx) =>
            idx === i ? { ...p, uploading: false, result: uploaded } : p,
          ),
        );
      } catch (err: any) {
        const msg = err?.message ?? "Upload failed";
        failedNames.push(entry.file.name);
        setPendingFiles((prev) =>
          prev.map((p, idx) =>
            idx === i ? { ...p, uploading: false, error: msg } : p,
          ),
        );
      }
    }

    if (failedNames.length > 0) {
      setUploadError(
        `Failed to upload: ${failedNames.join(", ")}. Check your connection or file storage config.`,
      );
    }

    return results;
  };

  // ── Send ────────────────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const content = input.trim();
    if (!content && pendingFiles.length === 0) return;
    if (!socketRef.current) return;

    setUploadError(null);
    setUploading(true);
    let attachments: ChatAttachment[] = [];
    try {
      attachments = await uploadPendingFiles();
    } finally {
      setUploading(false);
    }

    // Only send if we have text OR at least one file uploaded successfully
    const hasFailedFiles = pendingFiles.some((p) => p.error);
    if (!content && attachments.length === 0) {
      // All files failed — keep them in the strip so user can retry
      return;
    }

    socketRef.current.emit("group-chat:send", {
      workspaceId,
      memberId: myMemberId,
      memberName: myName,
      memberPhoto: myPhoto,
      content,
      attachments: attachments.length ? attachments : undefined,
      replyTo: replyingTo
        ? {
            id: replyingTo.id,
            memberName: replyingTo.memberName,
            content: replyingTo.content,
            attachments: replyingTo.attachments,
          }
        : undefined,
    });

    setInput("");
    setReplyingTo(null);
    // Keep only failed files in the pending strip
    setPendingFiles((prev) =>
      hasFailedFiles ? prev.filter((p) => p.error) : [],
    );
    textareaRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    input,
    pendingFiles,
    workspaceId,
    myMemberId,
    myName,
    myPhoto,
    replyingTo,
  ]);

  // ── Mention logic ──────────────────────────────────────────────────────────
  const workspaceTeam = useMemo(
    () => team.filter((m) => m.workspaceId === workspaceId),
    [team, workspaceId],
  );

  const mentionCandidates = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return workspaceTeam.filter((m) => m.name.toLowerCase().includes(q));
  }, [mentionQuery, workspaceTeam]);

  const detectMention = (value: string, cursorPos: number) => {
    // Look backwards from cursor to find an unfinished @mention
    const before = value.slice(0, cursorPos);
    const match = before.match(/@([\w\s]*)$/);
    if (match) {
      setMentionQuery(match[1]);
      setMentionIdx(0);
    } else {
      setMentionQuery(null);
    }
  };

  const insertMention = (member: TeamMember) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const cursorPos = ta.selectionStart;
    const before = input.slice(0, cursorPos);
    const after = input.slice(cursorPos);
    const atIdx = before.lastIndexOf("@");
    if (atIdx === -1) return;
    const newBefore = before.slice(0, atIdx) + `@${member.name} `;
    setInput(newBefore + after);
    setMentionQuery(null);
    // Restore cursor after React re-render
    requestAnimationFrame(() => {
      ta.focus();
      const pos = newBefore.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);
    detectMention(val, e.target.selectionStart);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Mention popup keyboard navigation
    if (mentionQuery !== null && mentionCandidates.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIdx((v) => (v + 1) % mentionCandidates.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIdx((v) => (v <= 0 ? mentionCandidates.length - 1 : v - 1));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(mentionCandidates[mentionIdx]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMentionQuery(null);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Paste images ─────────────────────────────────────────────────────────────
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(e.clipboardData.files).filter(
      (f) => f.size <= MAX_FILE_SIZE,
    );
    if (files.length === 0) return;
    e.preventDefault();
    const newEntries: PendingFile[] = files.map((file) => ({
      file,
      previewUrl: isImage(file.type) ? URL.createObjectURL(file) : null,
      uploading: false,
      error: null,
      result: null,
    }));
    setPendingFiles((prev) => [...prev, ...newEntries]);
  };

  // ── Search filter ─────────────────────────────────────────────────────────
  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return messages;
    const q = searchQuery.toLowerCase();
    return messages.filter(
      (m) =>
        m.content.toLowerCase().includes(q) ||
        m.memberName.toLowerCase().includes(q) ||
        (m.attachments as ChatAttachment[] | undefined)?.some((a) =>
          a.name.toLowerCase().includes(q),
        ),
    );
  }, [messages, searchQuery]);

  // ── Shared files (for file manager) ──────────────────────────────────────
  const sharedFiles = useMemo(() => {
    const all: (ChatAttachment & { senderName: string; sentAt: string })[] = [];
    for (const msg of messages) {
      const atts = Array.isArray(msg.attachments)
        ? (msg.attachments as ChatAttachment[])
        : [];
      for (const a of atts) {
        all.push({ ...a, senderName: msg.memberName, sentAt: msg.createdAt });
      }
    }
    return all.reverse(); // newest first
  }, [messages]);

  const sharedImages = useMemo(
    () => sharedFiles.filter((f) => isImage(f.type)),
    [sharedFiles],
  );
  const sharedDocs = useMemo(
    () => sharedFiles.filter((f) => !isImage(f.type)),
    [sharedFiles],
  );

  // ── Grouped messages ────────────────────────────────────────────────────────
  function isGrouped(i: number) {
    if (i === 0) return false;
    const prev = filteredMessages[i - 1];
    const cur = filteredMessages[i];
    if (prev.memberId !== cur.memberId) return false;
    const diff =
      new Date(cur.createdAt).getTime() - new Date(prev.createdAt).getTime();
    return diff < 3 * 60 * 1000;
  }

  const onlineMembers = team.filter(
    (m) => m.workspaceId === workspaceId,
  ).length;

  const canSend =
    (input.trim() !== "" || pendingFiles.some((p) => !p.error)) &&
    connected &&
    !uploading;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0d1117] rounded-2xl border border-gray-100 dark:border-gray-800/70 shadow-sm overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-gray-800/70 bg-white/80 dark:bg-[#0d1117]/80 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-400 to-violet-500 flex items-center justify-center shadow-sm">
            <Hash size={15} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight">
              {workspaceName}
            </p>
            <p className="text-xs text-gray-400">
              {onlineMembers} member{onlineMembers !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Search toggle */}
          <button
            onClick={() => {
              setSearchOpen((v) => !v);
              if (!searchOpen)
                setTimeout(() => searchInputRef.current?.focus(), 80);
              else setSearchQuery("");
            }}
            title="Search messages"
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
              searchOpen
                ? "bg-sky-100 dark:bg-sky-900/30 text-sky-500"
                : "text-gray-400 hover:text-sky-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
          >
            <Search size={15} />
          </button>

          {/* File manager toggle */}
          <button
            onClick={() => setFileManagerOpen(true)}
            title="Shared files"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-sky-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <FolderOpen size={15} />
          </button>

          {/* Pinned messages toggle */}
          <button
            onClick={() => setPinnedOpen((v) => !v)}
            title="Pinned messages"
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors relative ${
              pinnedOpen
                ? "bg-amber-100 dark:bg-amber-900/30 text-amber-500"
                : "text-gray-400 hover:text-amber-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
          >
            <Pin size={15} />
            {messages.filter((m) => m.isPinned).length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center">
                {messages.filter((m) => m.isPinned).length}
              </span>
            )}
          </button>

          <span
            className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-400" : "bg-red-400"}`}
            title={connected ? "Connected" : "Disconnected"}
          />
          <span className="text-xs text-gray-400">
            {connected ? "Live" : "Offline"}
          </span>

          <div className="flex -space-x-2 ml-2">
            {team
              .filter((m) => m.workspaceId === workspaceId)
              .slice(0, 5)
              .map((m) => (
                <div
                  key={m.id}
                  title={m.name}
                  className="ring-2 ring-white dark:ring-[#0d1117] rounded-full"
                >
                  <Avatar name={m.name} photo={m.photo} size={26} />
                </div>
              ))}
            {team.filter((m) => m.workspaceId === workspaceId).length > 5 && (
              <div className="w-[26px] h-[26px] rounded-full bg-gray-100 dark:bg-gray-800 ring-2 ring-white dark:ring-[#0d1117] flex items-center justify-center text-[10px] text-gray-500 font-semibold">
                +{team.filter((m) => m.workspaceId === workspaceId).length - 5}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Search bar ──────────────────────────────────────────────────── */}
      {searchOpen && (
        <div className="shrink-0 px-4 py-2.5 border-b border-gray-100 dark:border-gray-800/70 bg-gray-50/80 dark:bg-gray-900/40 backdrop-blur-sm flex items-center gap-2.5">
          <Search size={14} className="text-gray-400 shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search messages, users, or files…"
            className="flex-1 bg-transparent text-sm text-slate-800 dark:text-slate-100 placeholder-gray-400 dark:placeholder-gray-600 outline-none"
          />
          {searchQuery && (
            <span className="text-[10px] text-gray-400 shrink-0">
              {filteredMessages.length} result
              {filteredMessages.length !== 1 ? "s" : ""}
            </span>
          )}
          <button
            onClick={() => {
              setSearchOpen(false);
              setSearchQuery("");
            }}
            className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Pinned messages panel ──────────────────────────────────────────── */}
      {pinnedOpen && (
        <div className="shrink-0 max-h-56 overflow-y-auto border-b border-gray-100 dark:border-gray-800/70 bg-amber-50/40 dark:bg-amber-900/10">
          <div className="px-4 py-2 flex items-center justify-between">
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <Pin size={12} />
              Pinned Messages ({messages.filter((m) => m.isPinned).length})
            </span>
            <button
              onClick={() => setPinnedOpen(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X size={14} />
            </button>
          </div>
          {messages.filter((m) => m.isPinned).length === 0 ? (
            <p className="px-4 pb-3 text-xs text-gray-400">
              No pinned messages yet
            </p>
          ) : (
            <div className="space-y-1 px-4 pb-3">
              {messages
                .filter((m) => m.isPinned)
                .map((m) => (
                  <div
                    key={m.id}
                    className="flex items-start gap-2 p-2 rounded-lg bg-white/60 dark:bg-gray-800/60 border border-amber-200/50 dark:border-amber-700/30"
                  >
                    <Pin size={12} className="text-amber-400 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                        {m.memberName}
                      </span>
                      <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                        {m.content ||
                          (m.attachments?.length
                            ? `${m.attachments.length} file(s)`
                            : "")}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        if (!socketRef.current) return;
                        socketRef.current.emit("group-chat:pin", {
                          workspaceId,
                          messageId: m.id,
                        });
                      }}
                      title="Unpin"
                      className="shrink-0 text-gray-400 hover:text-red-500 p-1"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* ── Messages area ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1 scroll-smooth">
        {loading && (
          <div className="flex justify-center py-8">
            <div className="animate-spin w-5 h-5 border-2 border-sky-400 border-t-transparent rounded-full" />
          </div>
        )}

        {!loading && filteredMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full py-20 text-gray-400 gap-3 select-none">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-100 to-violet-100 dark:from-sky-900/20 dark:to-violet-900/20 flex items-center justify-center">
              {searchQuery ? (
                <Search size={26} className="text-gray-300" />
              ) : (
                <Smile size={26} className="text-sky-400" />
              )}
            </div>
            <p className="text-sm font-medium">
              {searchQuery ? "No results found" : "No messages yet"}
            </p>
            <p className="text-xs text-gray-300 dark:text-gray-600">
              {searchQuery
                ? "Try a different keyword"
                : "Be the first to say something!"}
            </p>
          </div>
        )}

        {filteredMessages.map((msg, i) => {
          const isMine = msg.memberId === myMemberId;
          const grouped = isGrouped(i);
          const showDate =
            i === 0 ||
            !sameDay(filteredMessages[i - 1].createdAt, msg.createdAt);
          const atts: ChatAttachment[] = Array.isArray(msg.attachments)
            ? (msg.attachments as ChatAttachment[])
            : [];

          return (
            <React.Fragment key={msg.id}>
              {showDate && (
                <div className="flex items-center gap-3 py-3">
                  <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800/60" />
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest shrink-0">
                    {formatDate(msg.createdAt)}
                  </span>
                  <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800/60" />
                </div>
              )}

              <div
                className={`group flex items-end gap-2.5 ${isMine ? "flex-row-reverse" : ""} ${grouped && !showDate ? "mt-0.5" : "mt-3"}`}
              >
                <div
                  className={`shrink-0 ${grouped && !showDate ? "opacity-0" : ""}`}
                >
                  <Avatar
                    name={msg.memberName}
                    photo={msg.memberPhoto}
                    size={32}
                  />
                </div>

                <div
                  className={`flex flex-col gap-1 max-w-[68%] ${isMine ? "items-end" : "items-start"}`}
                >
                  {(!grouped || showDate) && (
                    <div
                      className={`flex items-baseline gap-1.5 ${isMine ? "flex-row-reverse" : ""}`}
                    >
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {isMine ? "You" : msg.memberName}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {formatTime(msg.createdAt)}
                      </span>
                    </div>
                  )}

                  {/* Reply quote */}
                  {msg.replyTo && (
                    <div
                      className={`rounded-xl px-3 py-1.5 text-[11px] mb-0.5 border-l-[3px] max-w-full ${
                        isMine
                          ? "bg-sky-600/40 border-white/70 text-white/80"
                          : "bg-gray-100 dark:bg-gray-800/50 border-sky-400 text-gray-500 dark:text-gray-400"
                      }`}
                    >
                      <div className="font-semibold mb-0.5 leading-tight">
                        {msg.replyTo.memberName}
                      </div>
                      <div className="truncate max-w-[220px] leading-relaxed">
                        {msg.replyTo.content
                          ? msg.replyTo.content.length > 60
                            ? msg.replyTo.content.slice(0, 60) + "…"
                            : msg.replyTo.content
                          : msg.replyTo.attachments?.length
                            ? "📎 Attachment"
                            : ""}
                      </div>
                    </div>
                  )}

                  {/* Pinned indicator */}
                  {msg.isPinned && (
                    <div
                      className={`flex items-center gap-1 text-[10px] text-amber-500 ${isMine ? "justify-end" : ""}`}
                    >
                      <Pin size={10} />
                      <span>Pinned</span>
                    </div>
                  )}

                  {/* Text bubble */}
                  {msg.content && (
                    <div
                      className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
                        isMine
                          ? "bg-gradient-to-br from-sky-500 to-sky-600 text-white rounded-br-sm shadow-md shadow-sky-500/20"
                          : "bg-gray-100 dark:bg-gray-800/70 text-slate-800 dark:text-slate-200 rounded-bl-sm"
                      }`}
                    >
                      <RichContent text={msg.content} isMine={isMine} />
                    </div>
                  )}

                  {/* Attachments */}
                  {atts.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      {atts.map((att, ai) => (
                        <AttachmentBubble key={ai} att={att} isMine={isMine} />
                      ))}
                    </div>
                  )}
                </div>

                {/* Reply button — appears on hover */}
                <button
                  onClick={() => setReplyingTo(msg)}
                  title="Reply"
                  className="shrink-0 self-center opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-sky-500 dark:hover:text-sky-400"
                >
                  <CornerUpLeft size={13} />
                </button>

                {/* Pin button — appears on hover */}
                <button
                  onClick={() => {
                    if (!socketRef.current) return;
                    socketRef.current.emit("group-chat:pin", {
                      workspaceId,
                      messageId: msg.id,
                    });
                  }}
                  title={msg.isPinned ? "Unpin" : "Pin"}
                  className={`shrink-0 self-center opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full hover:bg-amber-50 dark:hover:bg-amber-900/20 ${
                    msg.isPinned
                      ? "text-amber-500"
                      : "text-gray-400 hover:text-amber-500 dark:hover:text-amber-400"
                  }`}
                >
                  <Pin size={13} />
                </button>

                {/* Delete button — only for own messages */}
                {isMine && (
                  <button
                    onClick={() => {
                      if (!socketRef.current) return;
                      socketRef.current.emit("group-chat:delete", {
                        workspaceId,
                        messageId: msg.id,
                        memberId: myMemberId,
                      });
                    }}
                    title="Unsend"
                    className="shrink-0 self-center opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </React.Fragment>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {/* ── Upload error banner ────────────────────────────────────────────── */}
      {uploadError && (
        <div className="shrink-0 mx-4 mt-2 flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl px-3.5 py-2.5 text-xs text-red-600 dark:text-red-400">
          <span className="flex-1 leading-relaxed">{uploadError}</span>
          <button
            onClick={() => setUploadError(null)}
            className="shrink-0 hover:opacity-70 mt-0.5"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* ── Pending files preview ───────────────────────────────────────────── */}
      {pendingFiles.length > 0 && (
        <div className="shrink-0 px-4 pt-3 flex flex-wrap gap-2 border-t border-gray-100 dark:border-gray-800/70">
          {pendingFiles.map((pf, idx) => (
            <div
              key={idx}
              className={`relative group flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs border ${
                pf.error
                  ? "bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700/60"
                  : "bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700/60"
              }`}
            >
              {/* File icon / thumbnail */}
              {pf.previewUrl ? (
                <img
                  src={pf.previewUrl}
                  alt={pf.file.name}
                  className="w-10 h-10 rounded-lg object-cover shrink-0"
                />
              ) : (
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                    pf.error
                      ? "bg-red-100 dark:bg-red-900/30 text-red-500"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-500"
                  }`}
                >
                  {pf.uploading ? (
                    <div className="w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <AttachmentIcon type={pf.file.type} size={18} />
                  )}
                </div>
              )}

              <div className="min-w-0 max-w-[120px]">
                <div
                  className={`truncate font-medium ${
                    pf.error
                      ? "text-red-600 dark:text-red-400"
                      : "text-slate-700 dark:text-slate-200"
                  }`}
                >
                  {pf.file.name}
                </div>
                {pf.error ? (
                  <div
                    className="text-red-500 dark:text-red-400 truncate"
                    title={pf.error}
                  >
                    {pf.error.length > 30
                      ? pf.error.slice(0, 30) + "…"
                      : pf.error}
                  </div>
                ) : (
                  <div className="text-gray-400">
                    {formatBytes(pf.file.size)}
                  </div>
                )}
              </div>

              <button
                onClick={() => removePending(idx)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Composer ───────────────────────────────────────────────────────── */}
      <div className="shrink-0 px-4 py-3 border-t border-gray-100 dark:border-gray-800/70 bg-white/80 dark:bg-[#0d1117]/80 backdrop-blur-md">
        {/* Reply preview strip */}
        {replyingTo && (
          <div className="flex items-center gap-2.5 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/50 rounded-xl px-3.5 py-2 mb-2.5 text-xs">
            <CornerUpLeft size={13} className="text-sky-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-sky-500">
                {replyingTo.memberName}
              </span>
              <span className="text-gray-400 ml-1.5">
                {replyingTo.content
                  ? replyingTo.content.length > 80
                    ? replyingTo.content.slice(0, 80) + "…"
                    : replyingTo.content
                  : replyingTo.attachments?.length
                    ? "📎 Attachment"
                    : ""}
              </span>
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              className="shrink-0 hover:opacity-70 text-gray-400"
            >
              <X size={13} />
            </button>
          </div>
        )}

        <div className="relative flex items-end gap-2.5 bg-gray-50 dark:bg-gray-800/60 rounded-2xl border border-gray-200/80 dark:border-gray-700/60 px-3.5 py-2.5 focus-within:border-sky-400/60 dark:focus-within:border-sky-500/50 transition-colors">
          {/* Mention popup */}
          {mentionQuery !== null && mentionCandidates.length > 0 && (
            <div className="absolute bottom-full left-0 mb-2 w-64 max-h-48 overflow-y-auto bg-white dark:bg-[#1c2128] rounded-xl border border-gray-200 dark:border-gray-700/60 shadow-xl z-20">
              <div className="px-3 py-1.5 text-[10px] text-gray-400 font-semibold uppercase tracking-wider border-b border-gray-100 dark:border-gray-800/70">
                Members
              </div>
              {mentionCandidates.map((m, idx) => (
                <button
                  key={m.id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertMention(m);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                    idx === mentionIdx
                      ? "bg-sky-50 dark:bg-sky-900/20"
                      : "hover:bg-gray-50 dark:hover:bg-gray-800/60"
                  }`}
                >
                  <Avatar name={m.name} photo={m.photo} size={24} />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                    {m.name}
                  </span>
                  {m.role && (
                    <span className="text-[10px] text-gray-400 ml-auto shrink-0">
                      {m.role}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          <Avatar name={myName} photo={myPhoto} size={28} />

          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={`Message #${workspaceName}…`}
            className="flex-1 bg-transparent resize-none outline-none text-sm text-slate-800 dark:text-slate-100 placeholder-gray-400 dark:placeholder-gray-600 leading-relaxed max-h-36 overflow-y-auto"
            style={{ fieldSizing: "content" } as any}
          />

          {/* Mention button */}
          <button
            type="button"
            onClick={() => {
              const ta = textareaRef.current;
              if (!ta) return;
              const pos = ta.selectionStart;
              const before = input.slice(0, pos);
              const after = input.slice(pos);
              const needSpace =
                before.length > 0 &&
                !before.endsWith(" ") &&
                !before.endsWith("\n");
              const newVal = before + (needSpace ? " @" : "@") + after;
              setInput(newVal);
              const newPos = before.length + (needSpace ? 2 : 1);
              setMentionQuery("");
              setMentionIdx(0);
              requestAnimationFrame(() => {
                ta.focus();
                ta.setSelectionRange(newPos, newPos);
              });
            }}
            title="Mention someone"
            className="shrink-0 w-8 h-8 rounded-xl text-gray-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/20 flex items-center justify-center transition-colors"
          >
            <AtSign size={16} />
          </button>

          {/* Attach button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Attach file"
            className="shrink-0 w-8 h-8 rounded-xl text-gray-400 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-900/20 flex items-center justify-center transition-colors"
          >
            <Paperclip size={16} />
          </button>

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!canSend}
            className="shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 text-white flex items-center justify-center hover:from-sky-600 hover:to-sky-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 shadow-sm shadow-sky-500/30"
          >
            {uploading ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send size={14} />
            )}
          </button>
        </div>

        <p className="text-[10px] text-gray-400 mt-1 ml-1">
          Press{" "}
          <kbd className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">
            Enter
          </kbd>{" "}
          to send ·{" "}
          <kbd className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">
            Shift+Enter
          </kbd>{" "}
          for newline · Paste to attach image
        </p>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar"
        className="hidden"
        onChange={(e) => handleFilesPicked(e.target.files)}
      />

      {/* ── File Manager Popup ─────────────────────────────────────────────── */}
      {fileManagerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#161b22] rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700/60 w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            {/* Popup header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800/70">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-400 to-sky-500 flex items-center justify-center shadow-sm">
                  <FolderOpen size={15} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    Shared Files
                  </p>
                  <p className="text-[11px] text-gray-400">
                    {sharedFiles.length} file
                    {sharedFiles.length !== 1 ? "s" : ""} in this chat
                  </p>
                </div>
              </div>
              <button
                onClick={() => setFileManagerOpen(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X size={15} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex px-5 pt-3 gap-1">
              <button
                onClick={() => setFileManagerTab("images")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  fileManagerTab === "images"
                    ? "bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400"
                    : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Image size={13} />
                  Images & Videos
                  <span className="text-[10px] opacity-60">
                    ({sharedImages.length})
                  </span>
                </span>
              </button>
              <button
                onClick={() => setFileManagerTab("files")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  fileManagerTab === "files"
                    ? "bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400"
                    : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <FileText size={13} />
                  Documents
                  <span className="text-[10px] opacity-60">
                    ({sharedDocs.length})
                  </span>
                </span>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {fileManagerTab === "images" && (
                <>
                  {sharedImages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-2 select-none">
                      <Image size={28} className="text-gray-300" />
                      <p className="text-xs">No images shared yet</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {sharedImages.map((img, idx) => (
                        <a
                          key={idx}
                          href={img.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group relative aspect-square rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700/60 hover:border-sky-400 transition-colors"
                        >
                          {isVideo(img.type) ? (
                            <video
                              src={img.url}
                              className="w-full h-full object-cover"
                              muted
                            />
                          ) : (
                            <img
                              src={img.url}
                              alt={img.name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                            <p className="text-[10px] text-white font-semibold truncate">
                              {img.name}
                            </p>
                            <p className="text-[9px] text-white/60">
                              {img.senderName} · {formatDate(img.sentAt)}
                            </p>
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                </>
              )}

              {fileManagerTab === "files" && (
                <>
                  {sharedDocs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-2 select-none">
                      <FileText size={28} className="text-gray-300" />
                      <p className="text-xs">No documents shared yet</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {sharedDocs.map((doc, idx) => (
                        <a
                          key={idx}
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          download={doc.name}
                          className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/60 border border-transparent hover:border-gray-200 dark:hover:border-gray-700/60 transition-all group"
                        >
                          <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 shrink-0 group-hover:bg-sky-50 dark:group-hover:bg-sky-900/20 group-hover:text-sky-500 transition-colors">
                            <AttachmentIcon type={doc.type} size={20} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                              {doc.name}
                            </p>
                            <p className="text-[11px] text-gray-400">
                              {formatBytes(doc.size)} · {doc.senderName} ·{" "}
                              {formatDate(doc.sentAt)}
                            </p>
                          </div>
                          <Download
                            size={14}
                            className="text-gray-300 group-hover:text-sky-500 shrink-0 transition-colors"
                          />
                        </a>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
