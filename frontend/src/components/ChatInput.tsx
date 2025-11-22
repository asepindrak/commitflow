import { Send, Mic, Loader } from "lucide-react";
import { useRef, useEffect, useState } from "react";

export default function ChatInput({
  input,
  setInput,
  handleSend,
  isLoading,
  placeholder,
  playSound,
  isPlaySound,
}: any) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const [isListening, setIsListening] = useState(false);
  const isListeningRef = useRef(false); // ref untuk status listening terbaru
  const transcriptRef = useRef<string>("");
  const autoSendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync ref dengan state
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  // Auto resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = textarea.scrollHeight + "px";
    }
  }, [input]);

  // Initialize speech recognition once
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech recognition tidak didukung di browser ini.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "id-ID";
    recognition.continuous = true;
    recognition.interimResults = true;

    let finalTranscript = "";

    recognition.onresult = (event: any) => {
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + " ";
        } else {
          interimTranscript += transcript;
        }
      }

      const combined = (finalTranscript + interimTranscript).trim();
      transcriptRef.current = combined;
      setInput(combined);

      if (autoSendTimerRef.current) clearTimeout(autoSendTimerRef.current);
      if (combined) {
        autoSendTimerRef.current = setTimeout(() => {
          handleSend(combined);
          transcriptRef.current = "";
          finalTranscript = "";
          setInput("");
        }, 3000);
      }
    };

    recognition.onerror = (err: any) => {
      console.error("Speech recognition error:", err);
    };

    recognition.onend = () => {
      // Restart hanya jika user masih ingin listening
      if (isListeningRef.current) {
        setTimeout(() => recognition.start(), 100);
      }
    };

    recognitionRef.current = recognition;
  }, [setInput, handleSend]);

  const toggleVoice = () => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    playSound("/sounds/close.mp3", isPlaySound);
    if (isListening) {
      recognition.stop();
      setIsListening(false);
      isListeningRef.current = false; // update ref sekaligus
      if (autoSendTimerRef.current) clearTimeout(autoSendTimerRef.current);
    } else {
      transcriptRef.current = "";
      setInput("");
      recognition.start();
      setIsListening(true);
      isListeningRef.current = true; // update ref sekaligus
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && e.shiftKey) return;
    if (e.key === "Enter") {
      e.preventDefault();
      handleSend(input);
      if (autoSendTimerRef.current) clearTimeout(autoSendTimerRef.current);
      transcriptRef.current = "";
      setInput("");
    }
  };

  return (
    <div className="p-3 border-t border-gray-700 bg-gray-900 flex items-end gap-2 rounded-b-lg">
      <textarea
        ref={textareaRef}
        className="flex-1 bg-gray-800 text-gray-100 placeholder-gray-500 px-4 py-2 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 resize-none overflow-hidden transition-all"
        placeholder={placeholder}
        value={input}
        rows={1}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
      />

      <button
        onClick={toggleVoice}
        className={`p-2 rounded-full transition flex items-center justify-center ${
          isListening
            ? "bg-red-500 hover:bg-red-600"
            : "bg-gray-700 hover:bg-gray-600"
        }`}
        title={isListening ? "Berhenti merekam" : "Mulai bicara"}
      >
        <Mic
          className={`w-5 h-5 ${isListening ? "text-white" : "text-gray-200"}`}
        />
      </button>

      <button
        onClick={() => handleSend(input)}
        disabled={isLoading}
        className="p-2 rounded-full bg-blue-600 hover:bg-blue-700 transition flex items-center justify-center"
        title="Kirim pesan"
      >
        {isLoading ? (
          <Loader className="w-5 h-5 text-white" />
        ) : (
          <Send className="w-5 h-5 text-white" />
        )}
      </button>
    </div>
  );
}
