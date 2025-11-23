import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { v4 as uuidv4 } from "uuid";
import { io, Socket } from "socket.io-client";
import packageJson from "../../package.json";
import { useStore } from "../utils/store";
import type { Message } from "../utils/store";
import { getRandomPlaceholder } from "../utils/placeholder";
import { Trash2, X, Copy, Check, Share2, VolumeX, Volume2 } from "lucide-react";
import { motion } from "framer-motion";
import Swal from "sweetalert2";
import ChatInput from "./ChatInput";
import remarkBreaks from "remark-breaks";
import TtsButton from "./TTSButton";
import { toast } from "react-toastify";
import { apiFetch } from "../utils/apiFetch";
import { playSound } from "../utils/playSound";

interface ChatWindowProps {
  onClose: () => void;
  isPlaySound: boolean;
  setIsPlaySound: (value: boolean) => void;
}

export default function ChatWindow({
  onClose,
  isPlaySound,
  setIsPlaySound,
}: ChatWindowProps) {
  const [input, setInput] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [thinkingMessage, setThinkingMessage] = useState(null);
  const socketRef = useRef<Socket | null>(null);
  const { messages, setMessages } = useStore();
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [placeholder, setPlaceholder] = useState(getRandomPlaceholder());
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMessagesReady, setIsMessagesReady] = useState(false);

  const fullText = `Halo! 👋 Selamat datang di **CommitFlow** 🧠.

Saya bisa bantu analisis repositori dan kontribusi member dalam bahasa yang mudah dimengerti.

Coba ketik:
- \`siapa saja yang berkontribusi di repo commitflow?\`
- \`siapa yang paling banyak berkontribusi di repo commitflow?\`
- \`list seluruh repositori.\`
- \`tampilkan semua project aktif.\`
- \`project mana yang memiliki task paling banyak?\`
- \`analisa project commitflow.\`
- \`tampilkan seluruh task di project commitflow.\`
- \`apa saja task yang statusnya inprogress?\`
- \`task todo untuk project commitflow apa saja?\`
- \`siapa member yang paling banyak task todo?\`
- \`list semua task yang dimiliki Bob.\`
- \`siapa yang paling overload di tim?\`
- \`siapa member yang paling banyak task inprogress di project commitflow?\`
- \`task mana yang belum punya assignee di project commitflow?\`
- \`bandingkan jumlah task todo dan done untuk semua project.\`

Siap bantu insight lebih cerdas. 💡`;

  useEffect(() => {
    fetchMessages();
  }, []);

  useEffect(() => {
    const userMessagesCount = messages.filter(
      (msg) => msg.role === "user"
    ).length;

    if (userMessagesCount > 0) {
      setWelcomeMessage(fullText);
      playSound("/sounds/send.mp3", isPlaySound);
      return;
    }

    let index = 0;
    const speed = 3;
    const startDelay = 500;

    const startTyping = () => {
      const timer = setInterval(() => {
        setWelcomeMessage((prev) => prev + fullText.charAt(index));
        index++;
        if (index >= fullText.length) clearInterval(timer);
      }, speed);
    };

    const delayTimer = setTimeout(startTyping, startDelay);
    setTimeout(() => playSound("/sounds/send.mp3", isPlaySound), 500);

    return () => clearTimeout(delayTimer);
  }, [isMessagesReady]);

  useEffect(() => {
    const interval = setInterval(
      () => setPlaceholder(getRandomPlaceholder()),
      5000
    );
    setTimeout(() => setIsVisible(true), 100);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    new Audio("/sounds/send.mp3").load();
    new Audio("/sounds/incoming.mp3").load();
    new Audio("/sounds/close.mp3").load();
  }, []);

  const closeWindow = () => {
    setIsVisible(false);
    setTimeout(() => {
      playSound("/sounds/close.mp3", isPlaySound);
      onClose();
    }, 500);
  };

  useEffect(() => {
    containerRef.current?.scrollTo(0, containerRef.current.scrollHeight);
  }, []);

  useEffect(() => {
    const socket = io(import.meta.env.VITE_API_URL);
    socketRef.current = socket;

    socket.on("ai_thinking", (data) => {
      setIsThinking(true);
      setThinkingMessage(data.message);
      if (data.type === "done") {
        setIsThinking(false);
        setThinkingMessage(null);
      }
      containerRef.current?.scrollTo(0, containerRef.current.scrollHeight);
    });
  }, []);

  const fetchMessages = async () => {
    const res = await apiFetch(`${import.meta.env.VITE_API_URL}/messages`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      setMessages(() => []);
      throw new Error(`Failed to fetch messages (HTTP ${res.status})`);
    }
    const data = await res.json();
    if (!data) {
      setMessages(() => []);
      return;
    }
    console.log("Fetched messages:", data);
    setMessages(() => data);
    setIsMessagesReady(true);
  };

  // const deleteMessage = async (id: string) => {
  //     //buatkan konfirmasi delete dengan Swal
  //     const result = await Swal.fire({
  //         title: "Konfirmasi Hapus",
  //         text: "Apakah Anda yakin ingin menghapus pesan ini?",
  //         icon: "warning",
  //         showCancelButton: true,
  //         confirmButtonText: "Hapus",
  //         cancelButtonText: "Batal",
  //         confirmButtonColor: "#d33",
  //         background: "#0f172a",
  //         color: "#f1f5f9",
  //     });

  //     if (!result.isConfirmed) return

  //     const res = await apiFetch(`${import.meta.env.VITE_API_URL}/messages/${id}`, {
  //         method: 'DELETE',
  //         headers: { 'Content-Type': 'application/json' },
  //     });

  //     if (!res.ok) {
  //         toast.error("Failed to delete message")
  //         throw new Error(`Failed to delete message (HTTP ${res.status})`);
  //     }
  //     const data = await res.json();
  //     if (!data) {
  //         toast.error("Failed to delete message")
  //         return;
  //     }
  //     toast.dark("Message deleted succesfuly")
  //     //remove message with id
  //     setMessages(prevMessages => prevMessages.filter(msg => msg.id !== id));

  // };

  const handleCopy = async (text: string) => {
    if (text) {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      playSound("/sounds/close.mp3", isPlaySound);
      setTimeout(() => setCopied(false), 1500);
      toast.dark("Teks berhasil disalin!");
    }
  };

  const shareTo = (platform: string, msg: string) => {
    const text = encodeURIComponent(msg);
    const url = encodeURIComponent(window.location.href);
    let shareUrl = "";

    switch (platform) {
      case "whatsapp":
        shareUrl = `https://wa.me/?text=${text}`;
        break;
      case "twitter":
        shareUrl = `https://twitter.com/intent/tweet?text=${text}`;
        break;
      case "telegram":
        shareUrl = `https://t.me/share/url?url=${url}&text=${text}`;
        break;
    }

    playSound("/sounds/close.mp3", isPlaySound);
    setShared(true);
    setTimeout(() => setShared(false), 1500);
    window.open(shareUrl, "_blank");
  };

  const clearChat = async () => {
    playSound("/sounds/close.mp3", isPlaySound);
    const result = await Swal.fire({
      title: "Bersihkan chat?",
      text: "Yakin ingin membersihkan semua pesan?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Ya, hapus",
      cancelButtonText: "Batal",
      confirmButtonColor: "#3b82f6",
      background: "#0f172a",
      color: "#f1f5f9",
    });
    if (!result.isConfirmed) return;

    const res = await apiFetch(`${import.meta.env.VITE_API_URL}/messages/all`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      toast.error("Failed to clear message");
      throw new Error(`Failed to clear message (HTTP ${res.status})`);
    }
    const data = await res.json();
    if (!data) {
      toast.error("Failed to clear message");
      return;
    }
    toast.dark("Message clear succesfuly");

    setMessages(() => []);
    closeWindow();
  };

  const onOffSound = () => {
    setIsPlaySound(!isPlaySound);
    playSound("/sounds/close.mp3", true);
  };

  const handleSend = async (textOverride?: string) => {
    const message = textOverride ?? input;
    if (!message.trim() || isLoading) return;

    setIsLoading(true);
    playSound("/sounds/send.mp3", isPlaySound);

    const userMsg: Message = { id: uuidv4(), content: message, role: "user" };
    setMessages((m: Message[]) => [...m, userMsg]);
    setInput("");

    const formattedMessages = [{ role: "user", content: message }];

    const aiId = uuidv4();
    const aiMsg = { id: aiId, content: "", role: "assistant" };
    setMessages((m: any) => [...m, aiMsg]);

    try {
      // 🔧 pakai apiFetch agar token otomatis di-handle
      const response = await apiFetch(`${import.meta.env.VITE_API_URL}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: formattedMessages }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Gagal koneksi ke /ask (HTTP ${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");

      setIsLoading(false);
      playSound("/sounds/incoming.mp3", isPlaySound);

      let hasScrolled = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk
          .split("\n")
          .filter((line) => line.trim().startsWith("data:"));

        for (const line of lines) {
          const data = line.replace(/^data:\s*/, "");
          if (data === "[DONE]") return;

          try {
            const json = JSON.parse(data);
            const token = json.choices?.[0]?.delta?.content || "";
            if (token) {
              setMessages((prev: any) =>
                prev.map((m: any) =>
                  m.id === aiId ? { ...m, content: m.content + token } : m
                )
              );

              if (!hasScrolled) {
                containerRef.current?.scrollTo({
                  top: containerRef.current.scrollHeight,
                  behavior: "smooth",
                });
                hasScrolled = true;
              }
            }
          } catch {
            // Abaikan chunk non-JSON (kadang newline kosong)
          }
        }
      }
    } catch (err) {
      console.error(err);
      toast.dark("Gagal menghubungi Insight AI!");
      setIsLoading(false);
    }
  };

  return (
    <div
      className={`fixed bottom-0 md:bottom-5 right-0 md:right-4 w-full h-full md:w-150 md:h-[90%] shadow-xl md:rounded-lg flex flex-col
        transform transition-all duration-500 ease-out z-99
        ${
          isVisible
            ? "opacity-100 translate-y-0 scale-100"
            : "opacity-0 translate-y-10 scale-90"
        }
        bg-[#0f172a] text-gray-100 border border-[#1e293b]
      `}
    >
      {/* Header */}
      <div className="flex justify-between items-center bg-[#1e293b] hover:bg-[#27364a] transition text-white p-2 md:rounded-t-lg cursor-pointer">
        <span className="flex gap-2 items-center">
          <img src="logo.png" width={25} height={20} alt="logo" />
          <span className="font-semibold">CommitFlow</span>
          <span
            className="mt-1 text-sm text-cyan-400"
            aria-label={packageJson.version}
          >
            v{packageJson.version}
          </span>
          <button
            onClick={onOffSound}
            className="py-1 px-2 rounded-sm ml-2 hover:bg-[#334155] transition"
          >
            {!isPlaySound ? (
              <VolumeX className="w-5 h-5 text-gray-300" />
            ) : (
              <Volume2 className="w-5 h-5 text-cyan-400" />
            )}
          </button>
          <button
            onClick={clearChat}
            className="flex gap-2 py-1 px-2 rounded-sm hover:bg-[#ef4444]/70 transition"
          >
            <Trash2 className="w-5 h-5 text-gray-300" />
          </button>
        </span>
        <button
          onClick={closeWindow}
          className="py-1 px-2 rounded-sm hover:bg-[#334155] transition"
        >
          <X className="w-5 h-5 text-gray-300" />
        </button>
      </div>

      {/* Chat messages */}
      <div
        ref={containerRef}
        className="flex-1 p-4 overflow-y-auto space-y-2 bg-[#0f172a] pb-20"
      >
        <motion.span
          key={uuidv4()}
          initial={{ y: 50, scale: 0.8 }}
          animate={{ y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 15 }}
          className="text-gray-100"
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkBreaks]}
            components={{
              a: (props) => (
                <a
                  {...props}
                  className="text-cyan-400 underline"
                  target="_blank"
                  rel="noopener noreferrer"
                />
              ),
              code: ({ inline, className, children, ...props }: any) => (
                <code
                  className={`cursor-pointer ${
                    inline
                      ? "bg-[#1e293b] text-pink-400 rounded px-1"
                      : "block bg-[#1e293b] text-cyan-300 p-2 rounded-md my-2 overflow-x-auto"
                  } ${className || ""}`}
                  {...props}
                  onClick={() => handleCopy(children)}
                >
                  {children}
                </code>
              ),
              strong: ({ children }) => (
                <strong className="text-emerald-400 drop-shadow-[0_0_6px_rgba(16,185,129,0.4)] font-semibold">
                  {children}
                </strong>
              ),
              em: ({ children }) => (
                <em className="text-blue-300 italic opacity-80">{children}</em>
              ),
            }}
          >
            {welcomeMessage || ""}
          </ReactMarkdown>
        </motion.span>

        {messages &&
          messages.length > 0 &&
          messages.map((msg: any) => {
            if (!msg.content || msg.role === "system") return null;
            return (
              <div
                key={msg.id}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`relative px-3 py-2 my-2 rounded-lg max-w-[90%] break-words ${
                    msg.role === "user"
                      ? "bg-cyan-700 text-white"
                      : "bg-[#1e293b] text-gray-200 pb-7"
                  }`}
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkBreaks]}
                    components={{
                      a: (props) => (
                        <a
                          {...props}
                          className="text-cyan-400 underline"
                          target="_blank"
                          rel="noopener noreferrer"
                        />
                      ),
                      code: ({
                        inline,
                        className,
                        children,
                        ...props
                      }: any) => (
                        <code
                          className={`cursor-pointer ${
                            inline
                              ? "bg-[#0f172a] text-pink-400 rounded px-1"
                              : "block bg-[#27364a] text-cyan-300 p-2 rounded-md my-2 overflow-x-auto"
                          } ${className || ""}`}
                          {...props}
                          onClick={() => handleCopy(children)}
                        >
                          {children}
                        </code>
                      ),
                      strong: ({ children }) => (
                        <strong className="text-emerald-400 drop-shadow-[0_0_6px_rgba(16,185,129,0.4)] font-semibold">
                          {children}
                        </strong>
                      ),
                      em: ({ children }) => (
                        <em className="text-blue-300 italic opacity-80">
                          {children}
                        </em>
                      ),
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>

                  {msg.role !== "user" && (
                    <>
                      {/* <button onClick={() => deleteMessage(msg.id)} className="text-gray-400 hover:text-cyan-400 right-25 bottom-2 absolute">
                                            {isLoading ? <Loader size={16} /> : <Trash2 size={16} />}
                                        </button> */}
                      <button
                        onClick={() => shareTo("whatsapp", msg.content)}
                        className="text-gray-400 hover:text-cyan-400 right-10 bottom-2 absolute"
                      >
                        {shared ? (
                          <Check size={16} className="text-green-500" />
                        ) : (
                          <Share2 size={16} />
                        )}
                      </button>
                      <button
                        onClick={() => handleCopy(msg.content)}
                        className="text-gray-400 hover:text-cyan-400 right-2 bottom-2 absolute"
                      >
                        {copied ? (
                          <Check size={16} className="text-green-500" />
                        ) : (
                          <Copy size={16} />
                        )}
                      </button>
                      <TtsButton text={msg.content} playSound={playSound} />
                    </>
                  )}
                </div>
              </div>
            );
          })}

        {isThinking && <span className="text-gray-400">{thinkingMessage}</span>}
      </div>

      <ChatInput
        input={input}
        setInput={setInput}
        handleSend={handleSend}
        isLoading={isLoading}
        placeholder={placeholder}
        playSound={playSound}
        isPlaySound={isPlaySound}
      />
    </div>
  );
}
