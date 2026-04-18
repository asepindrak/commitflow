import React, { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { Send, ArrowLeft, MessageCircle, Trash2 } from "lucide-react";
import type { TeamMember } from "../types";
import * as api from "../api/projectApi";
import { usePresenceStore } from "../utils/usePresenceStore";

const BASE = import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "";

type DM = {
  id: string;
  senderId: string;
  senderName: string;
  senderPhoto?: string;
  receiverId: string;
  content: string;
  attachments?: any;
  isRead: boolean;
  createdAt: string;
};

type Props = {
  workspaceId: string;
  myMemberId: string;
  myName: string;
  myPhoto?: string;
  team: TeamMember[];
  isPlaySound?: boolean;
};

export default function DirectMessages({
  workspaceId,
  myMemberId,
  myName,
  myPhoto,
  team,
  isPlaySound,
}: Props) {
  const [selectedPeer, setSelectedPeer] = useState<TeamMember | null>(null);
  const [messages, setMessages] = useState<DM[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const online = usePresenceStore((s) => s.online);

  // Fetch unread counts
  useEffect(() => {
    if (!workspaceId || !myMemberId) return;
    api
      .getDmUnread(workspaceId, myMemberId)
      .then(setUnread)
      .catch(() => {});
  }, [workspaceId, myMemberId]);

  // Socket setup
  useEffect(() => {
    if (!workspaceId || !BASE) return;
    const socket = io(BASE, {
      transports: ["websocket", "polling"],
      withCredentials: true,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("group-chat:join", {
        workspaceId,
        memberId: myMemberId,
        memberName: myName,
      });
    });

    socket.on("dm:message", (msg: DM) => {
      const isMyConversation =
        (msg.senderId === myMemberId && msg.receiverId === selectedPeer?.id) ||
        (msg.receiverId === myMemberId && msg.senderId === selectedPeer?.id);
      if (isMyConversation) {
        setMessages((prev) => [...prev, msg]);
      }
      // Update unread if I'm the receiver and not viewing this conversation
      if (msg.receiverId === myMemberId && msg.senderId !== selectedPeer?.id) {
        setUnread((prev) => ({
          ...prev,
          [msg.senderId]: (prev[msg.senderId] ?? 0) + 1,
        }));
      }
    });

    socket.on("dm:deleted", ({ messageId }: { messageId: string }) => {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    });

    socket.on(
      "dm:read",
      ({ receiverId, senderId }: { receiverId: string; senderId: string }) => {
        if (senderId === myMemberId) {
          setMessages((prev) =>
            prev.map((m) =>
              m.senderId === myMemberId && m.receiverId === receiverId
                ? { ...m, isRead: true }
                : m,
            ),
          );
        }
      },
    );

    return () => {
      socket.disconnect();
    };
  }, [workspaceId, myMemberId, selectedPeer?.id]);

  // Load conversation on select
  useEffect(() => {
    if (!selectedPeer) return;
    setLoading(true);
    api
      .getDmConversation(workspaceId, myMemberId, selectedPeer.id)
      .then((data) => setMessages(Array.isArray(data) ? data : []))
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));

    // Mark as read
    setUnread((prev) => ({ ...prev, [selectedPeer.id]: 0 }));
    socketRef.current?.emit("dm:read", {
      workspaceId,
      receiverId: myMemberId,
      senderId: selectedPeer.id,
    });
  }, [selectedPeer?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = () => {
    if (!input.trim() || !selectedPeer) return;
    socketRef.current?.emit("dm:send", {
      workspaceId,
      senderId: myMemberId,
      senderName: myName,
      senderPhoto: myPhoto,
      receiverId: selectedPeer.id,
      content: input.trim(),
    });
    setInput("");
  };

  const handleDelete = (msg: DM) => {
    if (msg.senderId !== myMemberId) return;
    socketRef.current?.emit("dm:delete", {
      workspaceId,
      messageId: msg.id,
      senderId: myMemberId,
    });
  };

  const peers = team.filter((m) => m.id !== myMemberId && !m.isTrash);

  // Contact list view
  if (!selectedPeer) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <MessageCircle size={20} className="text-sky-500" />
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">
              Direct Messages
            </h3>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {peers.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-10">
              No team members
            </p>
          )}
          {peers.map((member) => {
            const isOnline = online.includes(member.id);
            const unreadCount = unread[member.id] ?? 0;
            return (
              <button
                key={member.id}
                onClick={() => setSelectedPeer(member)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left"
              >
                <div className="relative">
                  {member.photo ? (
                    <img
                      src={member.photo}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center text-white font-bold text-sm">
                      {member.name?.[0]?.toUpperCase() ?? "?"}
                    </div>
                  )}
                  <div
                    className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-gray-900 ${
                      isOnline ? "bg-emerald-400" : "bg-gray-300"
                    }`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
                    {member.name}
                  </p>
                  <p className="text-[11px] text-gray-400">
                    {isOnline ? "Online" : "Offline"}
                  </p>
                </div>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-sky-500 text-white text-[10px] font-bold">
                    {unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Conversation view
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setSelectedPeer(null)}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft size={18} className="text-gray-500" />
        </button>
        <div className="relative">
          {selectedPeer.photo ? (
            <img
              src={selectedPeer.photo}
              alt=""
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center text-white font-bold text-xs">
              {selectedPeer.name?.[0]?.toUpperCase() ?? "?"}
            </div>
          )}
          <div
            className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-gray-900 ${
              online.includes(selectedPeer.id)
                ? "bg-emerald-400"
                : "bg-gray-300"
            }`}
          />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-800 dark:text-gray-100">
            {selectedPeer.name}
          </p>
          <p className="text-[10px] text-gray-400">
            {online.includes(selectedPeer.id) ? "Online" : "Offline"}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading && (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-sky-500" />
          </div>
        )}
        {!loading && messages.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-10">
            No messages yet. Say hi!
          </p>
        )}
        {messages.map((msg) => {
          const isMine = msg.senderId === myMemberId;
          return (
            <div
              key={msg.id}
              className={`flex ${isMine ? "justify-end" : "justify-start"} group`}
            >
              <div
                className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm relative ${
                  isMine
                    ? "bg-sky-500 text-white rounded-br-md"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-bl-md"
                }`}
              >
                {!isMine && (
                  <p className="text-[10px] font-bold mb-0.5 opacity-70">
                    {msg.senderName}
                  </p>
                )}
                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                <div className="flex items-center gap-1 mt-1 text-[9px] opacity-60">
                  <span>
                    {new Date(msg.createdAt).toLocaleTimeString(undefined, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {isMine && msg.isRead && <span>✓✓</span>}
                </div>
                {isMine && (
                  <button
                    onClick={() => handleDelete(msg)}
                    className="absolute -top-2 -right-2 hidden group-hover:flex w-5 h-5 rounded-full bg-red-500 text-white items-center justify-center"
                  >
                    <Trash2 size={10} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm outline-none focus:ring-2 focus:ring-sky-300 text-gray-800 dark:text-gray-100"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="p-2.5 rounded-xl bg-sky-500 text-white hover:bg-sky-600 disabled:opacity-40 transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
