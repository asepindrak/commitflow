import { useState } from "react";
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
} from "lucide-react";
import { toast } from "react-toastify";

interface WebhookEntry {
  id: string;
  url: string;
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

export default function IntegrationsPanel({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const [webhooks, setWebhooks] = useState<WebhookEntry[]>(() => {
    try {
      return JSON.parse(
        localStorage.getItem(`webhooks_${workspaceId}`) || "[]",
      );
    } catch {
      return [];
    }
  });
  const [showAdd, setShowAdd] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  const save = (list: WebhookEntry[]) => {
    setWebhooks(list);
    localStorage.setItem(`webhooks_${workspaceId}`, JSON.stringify(list));
  };

  const addWebhook = () => {
    if (!newUrl.trim()) return toast.error("URL is required");
    if (selectedEvents.length === 0)
      return toast.error("Select at least one event");
    try {
      new URL(newUrl);
    } catch {
      return toast.error("Invalid URL");
    }
    const entry: WebhookEntry = {
      id: crypto.randomUUID(),
      url: newUrl.trim(),
      events: selectedEvents,
      active: true,
      createdAt: new Date().toISOString(),
    };
    save([...webhooks, entry]);
    setNewUrl("");
    setSelectedEvents([]);
    setShowAdd(false);
    toast.success("Webhook added");
  };

  const remove = (id: string) => {
    save(webhooks.filter((w) => w.id !== id));
    toast.info("Webhook removed");
  };

  const toggle = (id: string) => {
    save(webhooks.map((w) => (w.id === id ? { ...w, active: !w.active } : w)));
  };

  const copyUrl = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  const toggleEvent = (key: string) => {
    setSelectedEvents((prev) =>
      prev.includes(key) ? prev.filter((e) => e !== key) : [...prev, key],
    );
  };

  return (
    <div className="w-full max-w-3xl mx-auto py-6 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Webhook size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
              Integrations & Webhooks
            </h2>
            <p className="text-xs text-gray-400">
              Manage outgoing webhook endpoints for workspace events
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <Plus size={16} />
          Add Webhook
        </button>
      </div>

      {/* Add Form */}
      {showAdd && (
        <div className="mb-6 p-5 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-700">
          <div className="mb-4">
            <label className="text-xs font-semibold text-gray-500 mb-1 block">
              Payload URL
            </label>
            <div className="flex items-center gap-2">
              <Globe size={16} className="text-gray-400 shrink-0" />
              <input
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://example.com/webhook"
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="text-xs font-semibold text-gray-500 mb-2 block">
              Events
            </label>
            <div className="grid grid-cols-2 gap-2">
              {EVENT_OPTIONS.map((ev) => (
                <button
                  key={ev.key}
                  onClick={() => toggleEvent(ev.key)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors border ${
                    selectedEvents.includes(ev.key)
                      ? "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-600 text-indigo-700 dark:text-indigo-300"
                      : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  <ev.icon size={14} />
                  {ev.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={addWebhook}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Save Webhook
            </button>
            <button
              onClick={() => {
                setShowAdd(false);
                setNewUrl("");
                setSelectedEvents([]);
              }}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Webhook List */}
      {webhooks.length === 0 && !showAdd && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <Webhook size={40} className="opacity-20 mb-3" />
          <p className="text-sm font-medium">No webhooks configured</p>
          <p className="text-xs mt-1">
            Add a webhook to receive event notifications
          </p>
        </div>
      )}

      <div className="space-y-3">
        {webhooks.map((wh) => (
          <div
            key={wh.id}
            className={`p-4 rounded-xl border transition-colors ${
              wh.active
                ? "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
                : "bg-gray-50 dark:bg-gray-800/30 border-gray-100 dark:border-gray-800 opacity-60"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`w-2 h-2 rounded-full ${wh.active ? "bg-green-500" : "bg-gray-300"}`}
                  />
                  <span className="text-sm font-mono text-gray-700 dark:text-gray-200 truncate">
                    {wh.url}
                  </span>
                  <button
                    onClick={() => copyUrl(wh.url, wh.id)}
                    className="text-gray-300 hover:text-gray-500 shrink-0"
                  >
                    {copied === wh.id ? (
                      <Check size={14} className="text-green-500" />
                    ) : (
                      <Copy size={14} />
                    )}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {wh.events.map((ev) => (
                    <span
                      key={ev}
                      className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300"
                    >
                      {ev}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => toggle(wh.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    wh.active
                      ? "bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-gray-100 text-gray-400 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-500"
                  }`}
                >
                  {wh.active ? "Active" : "Paused"}
                </button>
                <button
                  onClick={() => remove(wh.id)}
                  className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
