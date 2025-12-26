import React from "react";
import { X, Download } from "lucide-react";

interface MediaModalProps {
  isOpen: boolean;
  url: string;
  type: "image" | "video";
  onClose: () => void;
}

export default function MediaModal({
  isOpen,
  url,
  type,
  onClose,
}: MediaModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-[101] p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        aria-label="Close media viewer"
      >
        <X size={24} />
      </button>

      <div
        className="relative max-w-7xl max-h-[90vh] w-full h-full flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {type === "image" ? (
          <img
            src={url}
            alt="Full size preview"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          />
        ) : (
          <video
            src={url}
            controls
            autoPlay
            className="max-w-full max-h-full rounded-lg shadow-2xl"
          />
        )}
      </div>

      {/* <a
        href={url}
        download
        className="absolute bottom-4 right-4 z-[101] flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        <Download size={18} />
        <span>Download</span>
      </a> */}
    </div>
  );
}
