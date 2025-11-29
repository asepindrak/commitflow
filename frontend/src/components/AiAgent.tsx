import { useState, useEffect } from "react";
import "./AiAgent.css";

function AiAgent({ setIsShow }: any) {
  const messages = [
    "📈 Hey! Ready to track contributions?",
    "💡 Need a quick analysis?",
    "🔍 Looking for the top contributors?",
    "🤖 I'm here to help with insights!",
    "🔍 Want to see who contributed?",
    "📂 What repositories do we have?",
    "💡 Need repo insights?",
    "🧠 Analysis activated!",
    "🗂️ Need help with task management?",
    "📌 Want to review your task progress?",
    "📋 Ready to manage your projects?",
    "🚀 Need an overview of your project status?",
    "📊 Want to check task assignments?",
    "📅 Looking to organize your project timeline?",
  ];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState("");
  const [wordIndex, setWordIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    const words = messages[currentIndex].split(" ");

    if (wordIndex < words.length) {
      const timeout = setTimeout(() => {
        setDisplayedText((prev) =>
          prev ? `${prev} ${words[wordIndex]}` : words[wordIndex]
        );
        setWordIndex((prev) => prev + 1);
      }, 250);
      return () => clearTimeout(timeout);
    } else {
      setIsTyping(false);
      const wait = setTimeout(() => {
        setDisplayedText("");
        setWordIndex(0);
        setCurrentIndex((prev) => (prev + 1) % messages.length);
        setIsTyping(true);
      }, 5000);
      return () => clearTimeout(wait);
    }
  }, [wordIndex, currentIndex]);

  return (
    <div
      className="fixed bottom-5 right-5 z-50 flex items-center space-x-3"
      onClick={() => setIsShow(true)}
    >
      {/* Balon chat di kiri */}
      <div className="chat-bubble relative px-4 py-2 text-sm rounded-2xl shadow-md cursor-pointer backdrop-blur-md border border-blue-100 animate-gradient select-none">
        <span>{displayedText}</span>
        {isTyping && <span className="typing-cursor text-blue-500">|</span>}

        {/* Segitiga balon (ekor) */}
        <div className="chat-tail"></div>
      </div>

      {/* Tombol chatbot di kanan */}
      <button
        onClick={() => setIsShow(true)}
        className="transform transition-transform duration-200 hover:scale-105 cursor-pointer"
      >
        <img
          src="ai-logo.png"
          className="transition-transform duration-300 ease-in-out hover:scale-110"
          width={55}
          height={55}
          alt="Ask AI Agent"
        />
      </button>
    </div>
  );
}

export default AiAgent;
