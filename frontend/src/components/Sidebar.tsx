// frontend/src/components/Sidebar.tsx
import React, { useEffect, useState } from "react";
import { Trash2, PlusCircle, UserPlus } from "lucide-react";
import type { Project, TeamMember, Workspace } from "../types";
import { motion } from "framer-motion";
import packageJson from "../../package.json";
import Swal from "sweetalert2";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import TeamModal from "./TeamModal";
import TeamDetailModal from "./TeamDetailModal";
import CreateWorkspaceModal from "./CreateWorkspaceModal";
import * as api from "../api/projectApi";
import { playSound } from "../utils/playSound";

export default function Sidebar({
  workspaces,
  activeWorkspaceId,
  setActiveWorkspaceId,
  projects,
  activeProjectId,
  setActiveProjectId,
  addProject,
  team,
  removeTeamMember,
  addTeamMember,
  removeProject,
  onWorkspaceCreated, // optional callback supaya parent dapat update list
}: {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  setActiveWorkspaceId: (id: string) => void;
  projects: Project[];
  activeProjectId: string;
  setActiveProjectId: (id: string) => void;
  addProject: (name: string) => void;
  team: TeamMember[]; // now TeamMember[]
  removeTeamMember: (id: string) => void; // accept id
  addTeamMember: (m: TeamMember) => void; // accept TeamMember
  removeProject: (id: string) => void;
  onWorkspaceCreated?: (w: Workspace) => void;
}) {
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      return (
        typeof document !== "undefined" &&
        document.documentElement.classList.contains("dark")
      );
    } catch {
      return false;
    }
  });
  useEffect(() => {
    const check = () =>
      setIsDark(document.documentElement.classList.contains("dark"));
    try {
      const obs = new MutationObserver(() => check());
      obs.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });
      return () => obs.disconnect();
    } catch {
      return () => {};
    }
  }, []);

  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [detailMember, setDetailMember] = useState<TeamMember | null>(null);

  const [newProjectName, setNewProjectName] = useState("");
  const [addingProject, setAddingProject] = useState(false);

  // Workspace modal state + creating state
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);

  // If parent didn't set a workspace or the current id is invalid, pick first workspace and inform parent.
  useEffect(() => {
    if (!workspaces || workspaces.length === 0) return;
    const exists = workspaces.some((w) => w.id === activeWorkspaceId);
    if (!exists) {
      // choose first workspace as fallback
      setActiveWorkspaceId(workspaces[0].id);
    }
    // only run when workspaces changes or activeWorkspaceId changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaces]);

  const submitNewProject = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = newProjectName.trim();
    if (!trimmed) {
      toast.dark("Please enter a project name");
      return;
    }
    if (projects.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.dark("Project exists");
      return;
    }
    setAddingProject(true);
    addProject(trimmed);
    setNewProjectName("");
    toast.dark(`Project "${trimmed}" created`);
    setAddingProject(false);
    playSound("/sounds/send.mp3", true);
  };

  const handleRemoveProject = (id: string, name: string) => {
    Swal.fire({
      title: "Delete project?",
      text: `Project "${name}" and its tasks will be deleted.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#ef4444",
      background: "#111827",
      color: "#e5e7eb",
    }).then(async (result) => {
      if (result.isConfirmed) {
        await api.deleteProjectApi(id);
        const newActive = projects.filter((p) => p.id !== id)[0]?.id ?? "";
        setActiveProjectId(newActive);
        toast.dark(`Project "${name}" deleted`);
        Swal.fire({
          title: "Deleted!",
          text: `"${name}" has been removed.`,
          icon: "success",
          timer: 1200,
          showConfirmButton: false,
          background: "#111827",
          color: "#e5e7eb",
        });

        removeProject(id);
      }
    });
  };

  // --- create workspace handler (calls API) ---
  const handleCreateWorkspace = async (w: Workspace) => {
    // w is from modal (has id, name, description, createdAt)
    setCreatingWorkspace(true);
    try {
      // call your API; adjust payload shape if backend expects different fields
      const payload = {
        name: w.name,
        description: w.description,
      };
      const res = await api.createWorkspace(payload);
      // API response shape might be { data: workspace } or workspace directly
      const created =
        res && typeof res === "object" && "data" in res
          ? (res as any).data
          : res;

      toast.dark(`Workspace "${w.name}" created`);
      playSound("/sounds/send.mp3", true);

      // inform parent so it can update the workspace list
      if (onWorkspaceCreated) {
        onWorkspaceCreated(created ?? w);
      }

      // set as active workspace
      const idToSet = created?.id ?? w.id;
      setActiveWorkspaceId(idToSet);
      setShowCreateWorkspace(false);
      window.location.reload();
    } catch (err: any) {
      console.error("create workspace error", err);
      toast.dark(err?.message ?? "Failed to create workspace");
    } finally {
      setCreatingWorkspace(false);
    }
  };
  // --- end create workspace handler ---

  return (
    <aside className="w-72 md:w-80 flex-shrink-0 border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 h-full flex flex-col">
      <ToastContainer
        position="top-right"
        autoClose={2500}
        hideProgressBar
        closeOnClick
        pauseOnHover
        draggable
        pauseOnFocusLoss
      />

      <div className="p-6 overflow-auto flex-1">
        {/* Workspace header with add button */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Workspace</h3>
          <button
            onClick={() => setShowCreateWorkspace(true)}
            title="Create workspace"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-sky-600 hover:bg-sky-700 text-white text-xs"
          >
            <PlusCircle size={14} />
            <span className="hidden sm:inline">Add</span>
          </button>
        </div>

        {/* Workspace select */}
        <div className="mb-6">
          <div className="mt-1">
            <select
              value={activeWorkspaceId}
              onChange={(e) => setActiveWorkspaceId(e.target.value)}
              className="w-full text-sm px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 outline-none focus:ring-1 focus:ring-sky-300"
            >
              {workspaces && workspaces.length > 0 ? (
                workspaces.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))
              ) : (
                <option value="">No workspace</option>
              )}
            </select>
          </div>
        </div>

        <h3 className="text-lg font-semibold mb-4">Projects</h3>

        <div className="space-y-3 mb-6">
          {projects.map((p) => {
            const active = p.id === activeProjectId;
            return (
              <div
                key={p.id}
                className={`flex items-center justify-between gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? "bg-sky-50 text-sky-800 dark:bg-sky-700/20 dark:text-sky-200 ring-1 ring-sky-200 dark:ring-sky-700"
                    : "hover:bg-gray-100 dark:hover:bg-gray-800 hover:shadow-sm"
                }`}
              >
                <button
                  onClick={() => setActiveProjectId(p.id)}
                  className="flex-1 text-left truncate"
                >
                  {p.name}
                </button>
                <button
                  onClick={() => handleRemoveProject(p.id, p.name)}
                  title="Delete project"
                  className="p-1 rounded-md text-gray-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })}
        </div>

        <form onSubmit={submitNewProject} className="mb-6">
          <div className="mb-2 text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between">
            <span>Create project</span>
            <span className="text-xs text-gray-400">
              {projects.length} total
            </span>
          </div>
          <div className="flex gap-2 items-center">
            <input
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="New project name"
              className="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 text-sm outline-none focus:ring-1 focus:ring-sky-300"
            />
            <button
              type="submit"
              disabled={addingProject}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium shadow transition-colors"
              title="Add project"
            >
              <PlusCircle size={16} />
              <span>{addingProject ? "Adding..." : "Add"}</span>
            </button>
          </div>
        </form>

        <div className="border-t border-gray-200 dark:border-gray-800 pt-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-semibold">Team</div>
            <div className="text-xs text-gray-400">{team.length}</div>
          </div>

          <div className="space-y-3 mb-3">
            {team.map((member) => {
              const hue =
                (member.name || "a")
                  .split("")
                  .reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
              const avatarBg = isDark
                ? `hsla(${hue} 70% 50% / 0.16)`
                : `hsla(${hue} 75% 85% / 0.95)`;
              const textColor = isDark
                ? `hsl(${hue} 65% 80%)`
                : `hsl(${hue} 75% 25%)`;
              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                  onClick={() => setDetailMember(member)}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm"
                      style={{ background: avatarBg, color: textColor }}
                    >
                      {member.photo ? (
                        <img
                          src={member.photo}
                          alt={member.name}
                          className="w-full h-full object-cover rounded-full"
                        />
                      ) : (
                        member.name
                          .split(" ")
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()
                      )}
                    </div>
                    <div className="text-sm">{member.name}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3">
            <div className="mb-2 text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between">
              <span>Add member</span>
              <button
                onClick={() => setShowCreateTeam(true)}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-600 text-white text-sm"
              >
                <UserPlus size={14} /> New
              </button>
            </div>
          </div>
        </div>
      </div>

      <motion.footer
        className="text-sm text-gray-400 flex flex-col items-center gap-1 pt-4 pb-5 px-5 border-t border-gray-200 dark:border-gray-800"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        <div className="flex items-center gap-2 text-xs">
          <span className="font-medium">v{packageJson.version}</span>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline">
            Developed by{" "}
            <strong className="font-semibold text-gray-600 dark:text-gray-200">
              Getech Indonesia
            </strong>
          </span>
        </div>
        <div className="sm:hidden text-center text-xs">
          Developed by{" "}
          <strong className="font-semibold">Getech Indonesia</strong>
        </div>
      </motion.footer>

      {/* Modals */}
      <CreateWorkspaceModal
        open={showCreateWorkspace}
        onClose={() => setShowCreateWorkspace(false)}
        onCreate={handleCreateWorkspace}
      />

      <TeamModal
        open={showCreateTeam}
        onClose={() => setShowCreateTeam(false)}
        onCreate={(m) => {
          addTeamMember(m);
          setShowCreateTeam(false);
        }}
      />
      <TeamDetailModal
        open={!!detailMember}
        member={detailMember ?? undefined}
        onClose={() => setDetailMember(null)}
        onDelete={(id) => {
          removeTeamMember(id);
          setDetailMember(null);
        }}
      />
    </aside>
  );
}
