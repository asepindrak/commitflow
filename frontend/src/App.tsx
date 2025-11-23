// src/App.tsx
import Welcome from "./components/Welcome";
import AiAgent from "./components/AiAgent";
import ChatWindow from "./components/ChatWindow";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer } from "react-toastify";
import ProjectManagement from "./components/ProjectManagement";
import AuthCard from "./components/Auth/AuthCard";
import { useAuthStore } from "./utils/store";
import { playSound } from "./utils/playSound";
import { getState, saveState } from "./utils/local";

function App() {
  const [isShow, setIsShow] = useState(false);
  const [isLogin, setIsLogin] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth); // ambil setter dari store
  const initSession = useAuthStore((s) => s.initSession);
  const token = useAuthStore((s) => s.token);

  // untuk kontrol animasi splash logo
  const [showLogo, setShowLogo] = useState(true);

  const KEY = "isPlaySound";

  const [isPlaySound, setIsPlaySound] = useState<boolean>(() => {
    const fromLS = getState(KEY);
    return fromLS ?? false; // fallback default false
  });

  useEffect(() => {
    saveState(KEY, isPlaySound);
  }, [isPlaySound]);

  useEffect(() => {
    initSession();
  }, [isLogin]);

  useEffect(() => {
    new Audio("/sounds/send.mp3").load();
    new Audio("/sounds/incoming.mp3").load();
    new Audio("/sounds/close.mp3").load();
    playSound("/sounds/send.mp3", isPlaySound);
  }, []);

  const onClose = () => {
    setIsShow(false);
  };

  const handleAuth = (r: any) => {
    // r adalah AuthResult dari backend: { token, userId, teamMemberId?, ... }
    if (!r || !r.token) {
      console.warn("handleAuth: invalid auth result", r);
      return;
    }

    // set ke zustand (dan localStorage ditangani di setAuth)
    setAuth({
      token: r.token,
      userId: r.userId,
      user: r.user,
      teamMemberId: r.teamMemberId ?? null,
    });

    // update UI
    setIsLogin(true);
  };

  if (!token) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen p-4 text-white relative overflow-hidden">
        <AnimatePresence>
          <AuthCard onAuthSuccess={handleAuth} />
        </AnimatePresence>

        <ToastContainer
          position="top-right"
          autoClose={3000} // durasi otomatis hilang (ms)
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss={false}
          draggable
          pauseOnHover
          theme="dark" // <- gunakan dark mode
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col justify-center items-center min-h-screen p-4 text-white relative overflow-hidden">
      <AnimatePresence>
        {showLogo && (
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: [0, 1.5, 20], opacity: [1, 1, 0] }}
            transition={{ duration: 2, ease: "easeInOut" }}
            onAnimationComplete={() => setShowLogo(false)}
          >
            <img
              src="./logo.png"
              alt="Logo"
              className="w-32 h-32 sm:w-48 sm:h-48"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {!showLogo && (
        <motion.div
          className="flex-1 flex flex-col items-center justify-center w-full"
          initial="hidden"
          animate="visible"
        >
          <motion.div
            variants={{
              hidden: { opacity: 0, y: -20 },
              visible: { opacity: 1, y: 0, transition: { delay: 0.2 } },
            }}
          >
            <ProjectManagement
              setIsPlaySound={setIsPlaySound}
              isPlaySound={isPlaySound}
            />
          </motion.div>
        </motion.div>
      )}

      {!showLogo && (
        <motion.div
          className="flex-1 flex flex-col items-center justify-center w-full"
          initial="hidden"
          animate="visible"
        >
          <motion.div
            variants={{
              hidden: { opacity: 0, y: -20 },
              visible: { opacity: 1, y: 0, transition: { delay: 0.2 } },
            }}
          >
            <Welcome />
          </motion.div>

          {!isShow && <AiAgent setIsShow={setIsShow} />}
          {isShow && (
            <ChatWindow
              onClose={onClose}
              setIsPlaySound={setIsPlaySound}
              isPlaySound={isPlaySound}
            />
          )}
        </motion.div>
      )}

      <ToastContainer
        position="top-right"
        autoClose={3000} // durasi otomatis hilang (ms)
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss={false}
        draggable
        pauseOnHover
        theme="dark" // <- gunakan dark mode
      />
    </div>
  );
}

export default App;
