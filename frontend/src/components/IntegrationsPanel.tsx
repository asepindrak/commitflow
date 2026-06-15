import { useState, useEffect } from "react";
import {
  Webhook,
  Plus,
  Trash2,
  Copy,
  Check,
  Globe,
  Bell,
  GitBranch,
  MessageSquare,
  Bot,
  Send,
  Eye,
  EyeOff,
  BookOpen,
  HelpCircle,
  Info,
  ExternalLink,
} from "lucide-react";
import { toast } from "react-toastify";
import {
  getWebhooksApi,
  createWebhookApi,
  toggleWebhookApi,
  deleteWebhookApi,
  getTelegramIntegrationsApi,
  createTelegramIntegrationApi,
  toggleTelegramIntegrationApi,
  deleteTelegramIntegrationApi,
} from "../api/integrationsApi";

interface WebhookEntry {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: string;
}

interface TelegramEntry {
  id: string;
  botToken: string;
  telegramId: string;
  events: string[];
  active: boolean;
  createdAt: string;
}

const EVENT_OPTIONS = [
  { key: "task.created", label: "Task Created", icon: Plus },
  { key: "task.updated", label: "Task Updated", icon: GitBranch },
  { key: "task.deleted", label: "Task Deleted", icon: Trash2 },
  { key: "comment.added", label: "Comment Added", icon: MessageSquare },
  { key: "sprint.changed", label: "Sprint Changed", icon: GitBranch },
  { key: "member.joined", label: "Member Joined", icon: Bell },
];

const SAMPLE_PAYLOAD = JSON.stringify(
  {
    event: "task.created",
    workspaceId: "d3b07384-d113-4691-bf99-813d9bb60d69",
    workspaceName: "Development",
    timestamp: "2026-06-16T04:20:17.000Z",
    data: {
      action: "task.created",
      entity: "task",
      entityId: "task-uuid",
      entityName: "Fix navigation bar bug",
      memberName: "Alex Johnson",
      meta: null
    }
  },
  null,
  2
);

export default function IntegrationsPanel({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const [activeTab, setActiveTab] = useState<"webhook" | "telegram">("webhook");
  const [webhooks, setWebhooks] = useState<WebhookEntry[]>([]);
  const [telegrams, setTelegrams] = useState<TelegramEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // Forms Visibility
  const [showAddWebhook, setShowAddWebhook] = useState(false);
  const [showAddTelegram, setShowAddTelegram] = useState(false);

  // Webhook Form State
  const [newUrl, setNewUrl] = useState("");

  // Telegram Form State
  const [botToken, setBotToken] = useState("");
  const [telegramId, setTelegramId] = useState("");
  const [showToken, setShowToken] = useState(false);

  // Shared Event Selection State
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [showDocs, setShowDocs] = useState(false);

  // Load Integrations
  useEffect(() => {
    if (!workspaceId) return;
    setLoading(true);
    Promise.all([
      getWebhooksApi(workspaceId),
      getTelegramIntegrationsApi(workspaceId),
    ])
      .then(([whs, tgs]) => {
        setWebhooks(whs);
        setTelegrams(tgs);
      })
      .catch((err) => {
        toast.error("Failed to load integrations: " + err.message);
      })
      .finally(() => setLoading(false));
  }, [workspaceId]);

  // Webhook CRUD Operations
  const handleAddWebhook = async () => {
    if (!newUrl.trim()) return toast.error("URL is required");
    if (selectedEvents.length === 0)
      return toast.error("Select at least one event");
    try {
      new URL(newUrl);
    } catch {
      return toast.error("Invalid URL");
    }
    try {
      const res = await createWebhookApi({
        workspaceId,
        url: newUrl.trim(),
        events: selectedEvents,
      });
      setWebhooks((prev) => [res, ...prev]);
      setNewUrl("");
      setSelectedEvents([]);
      setShowAddWebhook(false);
      toast.success("Webhook added successfully");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleToggleWebhook = async (id: string) => {
    try {
      const res = await toggleWebhookApi(id);
      setWebhooks((prev) =>
        prev.map((w) => (w.id === id ? { ...w, active: res.active } : w)),
      );
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleRemoveWebhook = async (id: string) => {
    try {
      await deleteWebhookApi(id);
      setWebhooks((prev) => prev.filter((w) => w.id !== id));
      toast.info("Webhook removed");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Telegram CRUD Operations
  const handleAddTelegram = async () => {
    if (!botToken.trim()) return toast.error("Bot Token is required");
    if (!telegramId.trim()) return toast.error("Chat ID/User ID is required");
    if (selectedEvents.length === 0)
      return toast.error("Select at least one event");

    try {
      const res = await createTelegramIntegrationApi({
        workspaceId,
        botToken: botToken.trim(),
        telegramId: telegramId.trim(),
        events: selectedEvents,
      });
      setTelegrams((prev) => {
        const exists = prev.some((t) => t.id === res.id);
        if (exists) {
          return prev.map((t) => (t.id === res.id ? res : t));
        }
        return [res, ...prev];
      });
      setBotToken("");
      setTelegramId("");
      setSelectedEvents([]);
      setShowAddTelegram(false);
      toast.success("Telegram integration added successfully");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleToggleTelegram = async (id: string) => {
    try {
      const res = await toggleTelegramIntegrationApi(id);
      setTelegrams((prev) =>
        prev.map((t) => (t.id === id ? { ...t, active: res.active } : t)),
      );
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleRemoveTelegram = async (id: string) => {
    try {
      await deleteTelegramIntegrationApi(id);
      setTelegrams((prev) => prev.filter((t) => t.id !== id));
      toast.info("Telegram integration removed");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  const toggleEvent = (key: string) => {
    setSelectedEvents((prev) =>
      prev.includes(key) ? prev.filter((e) => e !== key) : [...prev, key],
    );
  };

  const maskToken = (token: string) => {
    if (token.length <= 15) return token;
    return token.substring(0, 8) + "..." + token.substring(token.length - 4);
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-6 px-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Webhook size={24} className="text-white animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
              Integrations & Outgoing Channels
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Connect external services to receive instant updates on workspace events.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setShowDocs(!showDocs);
              setShowAddWebhook(false);
              setShowAddTelegram(false);
            }}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all shadow-md active:scale-95 border ${
              showDocs
                ? "bg-gray-200 border-gray-300 text-gray-850 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800"
            }`}
          >
            <HelpCircle size={16} />
            Documentation
          </button>
          <button
            onClick={() => {
              setShowAddWebhook(!showAddWebhook);
              setShowAddTelegram(false);
              setShowDocs(false);
              setSelectedEvents([]);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-all shadow-md hover:shadow-indigo-500/10 active:scale-95"
          >
            <Plus size={16} />
            Add Webhook
          </button>
          <button
            onClick={() => {
              setShowAddTelegram(!showAddTelegram);
              setShowAddWebhook(false);
              setShowDocs(false);
              setSelectedEvents([]);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold rounded-xl transition-all shadow-md hover:shadow-sky-500/10 active:scale-95"
          >
            <Send size={16} />
            Add Telegram
          </button>
        </div>
      </div>

      {/* Documentation Guide Banner */}
      {showDocs && (
        <div className="mb-8 p-6 bg-white dark:bg-gray-900 rounded-3xl border border-gray-200/80 dark:border-gray-800/80 shadow-xl shadow-gray-100/40 dark:shadow-none animate-fadeIn">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen size={18} className="text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-base font-bold text-gray-800 dark:text-gray-200">
              Integrations Reference & Setup Guide
            </h3>
          </div>

          <div className="space-y-6 text-sm text-gray-600 dark:text-gray-300">
            {/* Webhook Guide */}
            <div>
              <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-1.5 flex items-center gap-2">
                <Globe size={14} className="text-indigo-650 dark:text-indigo-400" />
                Outgoing Webhooks
              </h4>
              <p className="text-xs mb-3 text-gray-500 dark:text-gray-400 leading-relaxed">
                Webhooks send real-time POST payloads to your designated servers. Secure endpoints with HTTPS.
              </p>
              
              <div className="bg-gray-50 dark:bg-gray-950 p-4 rounded-2xl border border-gray-200/50 dark:border-gray-800/80 relative">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400">Sample JSON Payload</span>
                  <button
                    onClick={() => copyToClipboard(SAMPLE_PAYLOAD, "sample-payload")}
                    className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 text-xs flex items-center gap-1 transition-colors"
                  >
                    {copied === "sample-payload" ? (
                      <>
                        <Check size={12} className="text-green-500" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <pre className="text-xs font-mono overflow-x-auto text-gray-700 dark:text-gray-300 max-h-48 whitespace-pre">
                  {SAMPLE_PAYLOAD}
                </pre>
              </div>
            </div>

            {/* Telegram Guide */}
            <div className="border-t border-gray-150 dark:border-gray-800 pt-5">
              <h4 className="font-bold text-gray-800 dark:text-gray-200 mb-2.5 flex items-center gap-2">
                <Bot size={14} className="text-sky-500" />
                Telegram Bot Integration
              </h4>
              <div className="space-y-3 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                <div className="flex gap-2">
                  <span className="w-5 h-5 rounded-full bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 font-bold flex items-center justify-center shrink-0">1</span>
                  <p>
                    Open Telegram and search for <b>@BotFather</b>. Send <code>/newbot</code>, follow the prompts, and copy the generated <b>Bot Token</b>.
                  </p>
                </div>
                <div className="flex gap-2">
                  <span className="w-5 h-5 rounded-full bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 font-bold flex items-center justify-center shrink-0">2</span>
                  <p>
                    To obtain your <b>Chat ID / User ID</b>, search for <b>@userinfobot</b> or <b>@GetIDBot</b> on Telegram and send a message. It will reply with your ID number.
                  </p>
                </div>
                <div className="flex gap-2">
                  <span className="w-5 h-5 rounded-full bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 font-bold flex items-center justify-center shrink-0">3</span>
                  <p>
                    Enter both values in the form above, choose your events, and click <b>Save Telegram</b>. Make sure your bot is active (send <code>/start</code> to your bot).
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Forms Section */}
      {(showAddWebhook || showAddTelegram) && (
        <div className="mb-8 p-6 bg-white dark:bg-gray-900 rounded-3xl border border-gray-200/80 dark:border-gray-800/80 shadow-xl shadow-gray-100/40 dark:shadow-none animate-fadeIn">
          <div className="flex items-center gap-2 mb-5">
            <div className={`p-1.5 rounded-lg ${showAddWebhook ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600" : "bg-sky-50 dark:bg-sky-900/30 text-sky-500"}`}>
              {showAddWebhook ? <Globe size={18} /> : <Bot size={18} />}
            </div>
            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">
              {showAddWebhook ? "Configure Webhook" : "Configure Telegram Bot"}
            </h3>
          </div>

          {/* Webhook form fields */}
          {showAddWebhook && (
            <div className="mb-4">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5 block">
                Payload URL
              </label>
              <div className="flex items-center gap-2 relative">
                <Globe size={16} className="absolute left-3 text-gray-400" />
                <input
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://example.com/webhook"
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800 focus:bg-white dark:focus:bg-gray-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all dark:text-white"
                />
              </div>
            </div>
          )}

          {/* Telegram form fields */}
          {showAddTelegram && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5 block">
                  Bot Token
                </label>
                <div className="relative flex items-center">
                  <Bot size={16} className="absolute left-3 text-gray-400" />
                  <input
                    type={showToken ? "text" : "password"}
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    placeholder="123456789:ABCdefGhI..."
                    className="w-full pl-9 pr-10 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800 focus:bg-white dark:focus:bg-gray-900 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-3 text-gray-400 hover:text-gray-600"
                  >
                    {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5 block">
                  Telegram User ID / Chat ID
                </label>
                <div className="relative flex items-center">
                  <Send size={16} className="absolute left-3 text-gray-400" />
                  <input
                    value={telegramId}
                    onChange={(e) => setTelegramId(e.target.value)}
                    placeholder="e.g. 987654321"
                    className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800 focus:bg-white dark:focus:bg-gray-900 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 outline-none transition-all dark:text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Events Selector */}
          <div className="mb-6">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2.5 block">
              Notify on events
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {EVENT_OPTIONS.map((ev) => {
                const isSelected = selectedEvents.includes(ev.key);
                return (
                  <button
                    key={ev.key}
                    onClick={() => toggleEvent(ev.key)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all text-left ${
                      isSelected
                        ? showAddWebhook
                          ? "bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800/80 text-indigo-700 dark:text-indigo-300"
                          : "bg-sky-50/50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-800/80 text-sky-700 dark:text-sky-300"
                        : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-500 hover:border-gray-300 dark:hover:border-gray-700 hover:bg-gray-50/50 dark:hover:bg-gray-800/30"
                    }`}
                  >
                    <ev.icon size={14} className={isSelected ? "" : "opacity-60"} />
                    {ev.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex gap-2.5 justify-end">
            <button
              onClick={() => {
                setShowAddWebhook(false);
                setShowAddTelegram(false);
                setNewUrl("");
                setBotToken("");
                setTelegramId("");
                setSelectedEvents([]);
              }}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 font-semibold rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={showAddWebhook ? handleAddWebhook : handleAddTelegram}
              className={`px-5 py-2 text-sm font-semibold text-white rounded-xl transition-all shadow-md ${
                showAddWebhook
                  ? "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/10"
                  : "bg-sky-500 hover:bg-sky-600 shadow-sky-500/10"
              }`}
            >
              {showAddWebhook ? "Save Webhook" : "Save Telegram"}
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 mb-6">
        <button
          onClick={() => setActiveTab("webhook")}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-sm font-bold transition-all ${
            activeTab === "webhook"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          }`}
        >
          <Globe size={16} />
          Webhooks
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-1 ${activeTab === "webhook" ? "bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400" : "bg-gray-100 dark:bg-gray-800 text-gray-400"}`}>
            {webhooks.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("telegram")}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-sm font-bold transition-all ${
            activeTab === "telegram"
              ? "border-sky-500 text-sky-500"
              : "border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          }`}
        >
          <Bot size={16} />
          Telegram Bots
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-1 ${activeTab === "telegram" ? "bg-sky-100 dark:bg-sky-950 text-sky-500" : "bg-gray-100 dark:bg-gray-800 text-gray-400"}`}>
            {telegrams.length}
          </span>
        </button>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <div className="w-8 h-8 rounded-full border-2 border-t-indigo-600 border-gray-200 animate-spin mb-3" />
          <p className="text-sm font-medium">Loading integrations...</p>
        </div>
      ) : (
        <>
          {/* Webhooks List */}
          {activeTab === "webhook" && (
            <div className="space-y-4">
              {webhooks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-gray-50/50 dark:bg-gray-900/30 rounded-3xl border border-dashed border-gray-200 dark:border-gray-800 text-gray-400">
                  <Globe size={40} className="opacity-30 mb-3" />
                  <p className="text-sm font-medium">No webhooks configured</p>
                  <p className="text-xs mt-1 text-gray-400/80">
                    Add a webhook to dispatch workspace event payloads to your URLs.
                  </p>
                </div>
              ) : (
                webhooks.map((wh) => (
                  <div
                    key={wh.id}
                    className={`p-5 rounded-2xl border transition-all ${
                      wh.active
                        ? "bg-white dark:bg-gray-900 border-gray-200/80 dark:border-gray-800 shadow-sm shadow-gray-100/50 dark:shadow-none"
                        : "bg-gray-50/30 dark:bg-gray-800/10 border-gray-100 dark:border-gray-900 opacity-60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 mb-1.5">
                          <span
                            className={`w-2 h-2 rounded-full ${wh.active ? "bg-green-500 animate-pulse" : "bg-gray-300"}`}
                          />
                          <span className="text-sm font-mono font-medium text-gray-700 dark:text-gray-200 truncate">
                            {wh.url}
                          </span>
                          <button
                            onClick={() => copyToClipboard(wh.url, wh.id)}
                            className="text-gray-300 hover:text-gray-500 shrink-0 transition-colors"
                          >
                            {copied === wh.id ? (
                              <Check size={14} className="text-green-500" />
                            ) : (
                              <Copy size={14} />
                            )}
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2.5">
                          {wh.events.map((ev) => (
                            <span
                              key={ev}
                              className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100/30"
                            >
                              {ev}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleToggleWebhook(wh.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                            wh.active
                              ? "bg-green-50/50 border-green-200 text-green-600 hover:bg-green-100/50 dark:bg-green-950/20 dark:border-green-800 dark:text-green-400"
                              : "bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400"
                          }`}
                        >
                          {wh.active ? "Active" : "Paused"}
                        </button>
                        <button
                          onClick={() => handleRemoveWebhook(wh.id)}
                          className="p-2 rounded-xl text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all active:scale-95"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Telegram List */}
          {activeTab === "telegram" && (
            <div className="space-y-4">
              {telegrams.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-gray-50/50 dark:bg-gray-900/30 rounded-3xl border border-dashed border-gray-200 dark:border-gray-800 text-gray-400">
                  <Bot size={40} className="opacity-30 mb-3" />
                  <p className="text-sm font-medium">No Telegram bots configured</p>
                  <p className="text-xs mt-1 text-gray-400/80">
                    Add a bot configuration to receive instant HTML notifications on your Telegram app.
                  </p>
                </div>
              ) : (
                telegrams.map((tg) => (
                  <div
                    key={tg.id}
                    className={`p-5 rounded-2xl border transition-all ${
                      tg.active
                        ? "bg-white dark:bg-gray-900 border-gray-200/80 dark:border-gray-800 shadow-sm shadow-gray-100/50 dark:shadow-none"
                        : "bg-gray-50/30 dark:bg-gray-800/10 border-gray-100 dark:border-gray-900 opacity-60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-x-4 gap-y-1 mb-1.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full ${tg.active ? "bg-green-500 animate-pulse" : "bg-gray-300"}`}
                            />
                            <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                              Bot Token
                            </span>
                            <span className="text-sm font-mono font-medium text-gray-700 dark:text-gray-200">
                              {maskToken(tg.botToken)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                              Chat ID
                            </span>
                            <span className="text-sm font-mono font-medium text-gray-700 dark:text-gray-200">
                              {tg.telegramId}
                            </span>
                            <button
                              onClick={() => copyToClipboard(tg.telegramId, tg.id)}
                              className="text-gray-300 hover:text-gray-500 shrink-0 transition-colors"
                            >
                              {copied === tg.id ? (
                                <Check size={14} className="text-green-500" />
                              ) : (
                                <Copy size={14} />
                              )}
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2.5">
                          {tg.events.map((ev) => (
                            <span
                              key={ev}
                              className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-sky-50 dark:bg-sky-950/20 text-sky-600 dark:text-sky-400 border border-sky-100/30"
                            >
                              {ev}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleToggleTelegram(tg.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                            tg.active
                              ? "bg-green-50/50 border-green-200 text-green-600 hover:bg-green-100/50 dark:bg-green-950/20 dark:border-green-800 dark:text-green-400"
                              : "bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400"
                          }`}
                        >
                          {tg.active ? "Active" : "Paused"}
                        </button>
                        <button
                          onClick={() => handleRemoveTelegram(tg.id)}
                          className="p-2 rounded-xl text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all active:scale-95"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
