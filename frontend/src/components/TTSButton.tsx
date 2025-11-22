import { useState } from "react";
import { Volume2, Loader2 } from "lucide-react"; // Loader2 untuk loading spinner
import { playTts } from "../utils/playTts";

export default function TtsButton({
  text,
  playSound,
}: {
  text: string;
  playSound: any;
}) {
  const [isLoading, setIsLoading] = useState(false);

  const handlePlay = async () => {
    if (!text) return;
    setIsLoading(true);
    playSound("/sounds/close.mp3", true);
    try {
      await playTts(text); // pastikan playTts return promise
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handlePlay}
      className="text-gray-400 hover:text-gray-100 right-18 bottom-2 absolute cursor-pointer"
      title="Play TTS"
    >
      {isLoading ? (
        <Loader2 className="animate-spin w-4 h-4" />
      ) : (
        <Volume2 size={18} />
      )}
    </button>
  );
}
