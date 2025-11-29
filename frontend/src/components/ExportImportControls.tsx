// frontend/src/components/ExportImportControls.tsx
import React, { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "react-toastify";
import { Download, Loader2, Save, UploadCloud } from "lucide-react";
import type { Project, Task, TeamMember } from "../types";
import {
  findDataUrisInHtml,
  replaceDataUrisInCommentsAndUpload,
  replaceDataUrisInHtmlAndUpload,
} from "../utils/dataURItoFile";

/**
 * ExportImportControls (per-project)
 *
 * Props:
 * - projects: Project[] (used only to resolve project -> workspaceId if selectedProjectId provided)
 * - tasks: Task[]
 * - team: TeamMember[]
 * - selectedProjectId?: string  // when provided, export only tasks for this project (and related members)
 * - onImport: (payload: { tasks?: Task[]; team?: TeamMember[] }) => void
 *
 * Exports sheets:
 *  - tasks  (comments embedded as JSON string)
 *  - team   (filtered to members related to exported tasks / workspace)
 *
 * Imports: reads tasks and team, parses comments into arrays, then calls onImport.
 */

export default function ExportImportControls({
  projects,
  tasks,
  team,
  selectedProjectId,
  onImport,
}: {
  projects?: Project[];
  tasks: Task[];
  team: TeamMember[];
  selectedProjectId?: string;
  onImport: (payload: { tasks?: Task[]; team?: TeamMember[] }) => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const safeString = (v: any) =>
    v === null || typeof v === "undefined" ? "" : String(v);
  const tryParseJSON = (s: string) => {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  };

  async function exportXlsx() {
    try {
      setIsLoading(true);
      const MAX_EXCEL_CELL = 32767; // Excel limit for a single cell
      const truncations: string[] = [];

      const truncateForExcel = (value: any, ctx: string) => {
        const s =
          value === null || typeof value === "undefined" ? "" : String(value);
        if (s.length > MAX_EXCEL_CELL) {
          const kept = s.slice(0, MAX_EXCEL_CELL - 13);
          truncations.push(`${ctx} (original ${s.length} chars)`);
          return `${kept}...[truncated]`;
        }
        return s;
      };

      // Determine tasks to export (per-project if selected)
      const filteredTasks = selectedProjectId
        ? tasks.filter((t) => t.projectId === selectedProjectId)
        : tasks.slice();

      // ---------------------------
      // Preprocess comments per-task (existing)
      // ---------------------------
      const taskIndexToUpdatedComments: Map<string, any[]> = new Map();

      const tasksWithComments = filteredTasks
        .map((t, idx) => ({ t, idx }))
        .filter(
          ({ t }) =>
            Array.isArray((t as any).comments) && (t as any).comments.length > 0
        );

      for (const { t, idx } of tasksWithComments) {
        try {
          const originalComments = (t as any).comments ?? [];
          const updatedComments = await replaceDataUrisInCommentsAndUpload(
            originalComments
          );
          taskIndexToUpdatedComments.set(t.id ?? String(idx), updatedComments);
        } catch (err) {
          console.error(
            "Failed uploading embedded files for task (comments)",
            t.id,
            err
          );
          toast.dark(
            `Warning: failed uploading embedded files for comments on task ${
              t.id ?? ""
            }`
          );
        }
      }

      // ---------------------------
      // Preprocess descriptions per-task (NEW)
      // ---------------------------
      const taskIndexToUpdatedDescription: Map<
        string,
        { html: string; attachments?: any[] }
      > = new Map();

      const tasksWithDescriptionHtml = filteredTasks
        .map((t, idx) => ({ t, idx }))
        .filter(({ t }) => {
          const desc = (t as any).description;
          return (
            desc &&
            typeof desc === "string" &&
            findDataUrisInHtml(desc).length > 0
          );
        });

      // Process descriptions (one by one). Optionally you can batch all files for efficiency.
      for (const { t, idx } of tasksWithDescriptionHtml) {
        try {
          const originalDesc = (t as any).description ?? "";
          const { html: updatedHtml, attachments } =
            await replaceDataUrisInHtmlAndUpload(originalDesc);
          taskIndexToUpdatedDescription.set(t.id ?? String(idx), {
            html: updatedHtml,
            attachments,
          });
        } catch (err) {
          console.error(
            "Failed uploading embedded files for task (description)",
            t.id,
            err
          );
          toast.dark(
            `Warning: failed uploading embedded files for description on task ${
              t.id ?? ""
            }`
          );
          // keep original description if upload fails (don't block export)
        }
      }

      // Build set of assigneeIds referenced by those tasks
      const assigneeIds = new Set<string>();
      for (const t of filteredTasks) {
        if ((t as any).assigneeId)
          assigneeIds.add(String((t as any).assigneeId));
      }

      // Try to find project's workspaceId for broader team inclusion (optional)
      const project = projects?.find((p) => p.id === selectedProjectId);
      const projectWorkspaceId = project?.workspaceId;

      // Build a map for quick lookup of member email by id
      const memberEmailById: Map<string, string> = new Map(
        (team || []).map((m) => [String(m.id), String(m.email ?? "")])
      );

      // Team rows
      const tmRows = team
        .filter((m) => {
          if (assigneeIds.size > 0 && assigneeIds.has(m.id)) return true;
          if (projectWorkspaceId && m.workspaceId === projectWorkspaceId)
            return true;
          return !selectedProjectId;
        })
        .map((m) => ({
          id: truncateForExcel(m.id ?? "", `team.id:${m.id ?? ""}`),
          clientId: truncateForExcel(
            (m as any).clientId ?? "",
            `team.clientId:${m.id ?? ""}`
          ),
          userId: truncateForExcel(m.userId ?? "", `team.userId:${m.id ?? ""}`),
          workspaceId: truncateForExcel(
            m.workspaceId ?? "",
            `team.workspaceId:${m.id ?? ""}`
          ),
          name: truncateForExcel(m.name ?? "", `team.name:${m.id ?? ""}`),
          role: truncateForExcel(m.role ?? "", `team.role:${m.id ?? ""}`),
          email: truncateForExcel(m.email ?? "", `team.email:${m.id ?? ""}`),
          photo: truncateForExcel(m.photo ?? "", `team.photo:${m.id ?? ""}`),
          phone: truncateForExcel(m.phone ?? "", `team.phone:${m.id ?? ""}`),
          isTrash:
            typeof m.isTrash !== "undefined" ? Boolean(m.isTrash) : false,
          createdAt: truncateForExcel(
            (m as any).createdAt ? String((m as any).createdAt) : "",
            `team.createdAt:${m.id ?? ""}`
          ),
          updatedAt: truncateForExcel(
            (m as any).updatedAt ? String((m as any).updatedAt) : "",
            `team.updatedAt:${m.id ?? ""}`
          ),
        }));

      // Tasks rows: include comments serialized (and truncated if necessary) and updated descriptions
      const tkRows = filteredTasks.map((t) => {
        const taskId = t.id ?? "";
        const updatedComments =
          taskIndexToUpdatedComments.get(taskId) ?? (t as any).comments ?? [];
        const commentsJson = JSON.stringify(updatedComments);

        const descInfo = taskIndexToUpdatedDescription.get(taskId);
        const updatedDescription =
          descInfo?.html ?? (t as any).description ?? "";

        // find assignee email if available
        const assigneeIdStr = t.assigneeId ? String(t.assigneeId) : "";
        const assigneeEmail = assigneeIdStr
          ? memberEmailById.get(assigneeIdStr) ?? ""
          : "";

        return {
          id: truncateForExcel(t.id ?? "", `task.id:${t.id ?? ""}`),
          clientId: truncateForExcel(
            (t as any).clientId ?? "",
            `task.clientId:${t.id ?? ""}`
          ),
          projectId: truncateForExcel(
            (t as any).projectId ?? "",
            `task.projectId:${t.id ?? ""}`
          ),
          title: truncateForExcel(t.title ?? "", `task.title:${t.id ?? ""}`),
          description: truncateForExcel(
            updatedDescription,
            `task.description:${t.id ?? ""}`
          ),
          status: truncateForExcel(
            t.status ?? "todo",
            `task.status:${t.id ?? ""}`
          ),
          assigneeId: truncateForExcel(
            t.assigneeId ?? "",
            `task.assigneeId:${t.id ?? ""}`
          ),
          // NEW: add assigneeEmail column
          assigneeEmail: truncateForExcel(
            assigneeEmail,
            `task.assigneeEmail:${t.id ?? ""}`
          ),
          priority: truncateForExcel(
            t.priority ?? "",
            `task.priority:${t.id ?? ""}`
          ),
          startDate: truncateForExcel(
            t.startDate ?? "",
            `task.startDate:${t.id ?? ""}`
          ),
          dueDate: truncateForExcel(
            t.dueDate ?? "",
            `task.dueDate:${t.id ?? ""}`
          ),
          isTrash:
            typeof (t as any).isTrash !== "undefined"
              ? Boolean((t as any).isTrash)
              : false,
          comments: truncateForExcel(
            commentsJson,
            `task.comments:${t.id ?? ""}`
          ),
          createdAt: truncateForExcel(
            (t as any).createdAt ? String((t as any).createdAt) : "",
            `task.createdAt:${t.id ?? ""}`
          ),
          updatedAt: truncateForExcel(
            (t as any).updatedAt ? String((t as any).updatedAt) : "",
            `task.updatedAt:${t.id ?? ""}`
          ),
        };
      });

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(tkRows),
        "tasks"
      );
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(tmRows),
        "team"
      );

      const projectTag = selectedProjectId ? `_${selectedProjectId}` : "";
      const filename = `commitflow_export${projectTag}_${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, filename);

      // Toast feedback
      if (truncations.length > 0) {
        const sample = truncations.slice(0, 6).join(", ");
        toast.dark(
          `Exported ${tkRows.length} task(s) and ${tmRows.length} member(s) to Excel — note: some fields were truncated (${truncations.length} total). See: ${sample}`
        );
      } else {
        toast.dark(
          `Exported ${tkRows.length} task(s) and ${tmRows.length} member(s) to Excel`
        );
      }
    } catch (err) {
      console.error("Export failed", err);
      toast.dark("Export failed");
    } finally {
      setIsLoading(false);
    }
  }

  function findSheetName(wb: XLSX.WorkBook, name: string) {
    return wb.SheetNames.find((n) => n.toLowerCase() === name.toLowerCase());
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = ev.target?.result;
        const wb = XLSX.read(data as any, { type: "binary" });
        const out: any = {};

        // tasks (with comments parsing)
        const tkName = findSheetName(wb, "tasks");
        if (tkName) {
          const raw = XLSX.utils.sheet_to_json(wb.Sheets[tkName], {
            defval: "",
          });
          out.tasks = raw
            .map((r: any) => {
              const commentsRaw = safeString(
                r.comments ?? r.Comments ?? r.COMMENT ?? ""
              );
              let commentsArr: any[] = [];
              if (commentsRaw) {
                const parsed = tryParseJSON(commentsRaw);
                if (Array.isArray(parsed)) commentsArr = parsed;
                else commentsArr = [];
              }
              return {
                id: safeString(r.id ?? r.ID ?? r.Id ?? "").trim(),
                clientId:
                  safeString(r.clientId ?? r.clientid ?? "").trim() ||
                  undefined,
                projectId:
                  safeString(
                    r.projectId ?? r.projectid ?? r.project ?? ""
                  ).trim() || undefined,
                title: safeString(r.title ?? r.Title ?? "").trim(),
                description:
                  safeString(r.description ?? r.Description ?? "").trim() ||
                  undefined,
                status:
                  safeString(r.status ?? r.Status ?? "todo").trim() || "todo",
                assigneeId:
                  safeString(
                    r.assigneeId ?? r.assigneeid ?? r.assignee ?? ""
                  ).trim() || undefined,
                priority:
                  safeString(r.priority ?? r.Priority ?? "").trim() ||
                  undefined,
                startDate:
                  safeString(r.startDate ?? r.StartDate ?? "").trim() ||
                  undefined,
                dueDate:
                  safeString(r.dueDate ?? r.DueDate ?? "").trim() || undefined,
                isTrash:
                  String(r.isTrash ?? r.IsTrash ?? r.istrash ?? "")
                    .toLowerCase()
                    .trim() === "true",
                comments: commentsArr,
                createdAt:
                  safeString(r.createdAt ?? r.CreatedAt ?? "").trim() ||
                  undefined,
                updatedAt:
                  safeString(r.updatedAt ?? r.UpdatedAt ?? "").trim() ||
                  undefined,
              } as Task;
            })
            .filter((t: any) => t.id && t.title);
        }

        // team
        const tmName = findSheetName(wb, "team");
        if (tmName) {
          const raw = XLSX.utils.sheet_to_json(wb.Sheets[tmName], {
            defval: "",
          });
          out.team = raw
            .map((r: any) => ({
              id: safeString(r.id ?? r.ID ?? r.Id ?? "").trim(),
              clientId:
                safeString(r.clientId ?? r.clientid ?? "").trim() || undefined,
              userId:
                safeString(r.userId ?? r.userid ?? r.user ?? "").trim() ||
                undefined,
              workspaceId:
                safeString(
                  r.workspaceId ?? r.workspaceid ?? r.workspace ?? ""
                ).trim() || undefined,
              name: safeString(r.name ?? r.Name ?? r.username ?? "").trim(),
              role: safeString(r.role ?? r.Role ?? "").trim() || undefined,
              email: safeString(r.email ?? r.Email ?? "").trim() || undefined,
              photo: safeString(r.photo ?? r.Photo ?? "").trim() || undefined,
              phone: safeString(r.phone ?? r.Phone ?? "").trim() || undefined,
              isTrash:
                String(r.isTrash ?? r.IsTrash ?? r.istrash ?? "")
                  .toLowerCase()
                  .trim() === "true",
              createdAt:
                safeString(r.createdAt ?? r.CreatedAt ?? "").trim() ||
                undefined,
              updatedAt:
                safeString(r.updatedAt ?? r.UpdatedAt ?? "").trim() ||
                undefined,
            }))
            .filter((m: any) => m.name);
        }

        await onImport(out);
      } catch (err) {
        console.error("Import failed", err);
        toast.dark("Failed to import Excel file");
      } finally {
        setIsLoading(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    };

    reader.readAsBinaryString(f);
  }

  return (
    <div className="flex items-center gap-3">
      {/* Export button */}
      <button
        onClick={exportXlsx}
        disabled={isLoading}
        title="Export project to Excel"
        aria-label="Export to Excel"
        className={`group inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
              bg-gradient-to-r from-sky-500 to-sky-600 text-white
              hover:from-sky-600 hover:to-sky-700
              active:scale-95 transition-all duration-300
              dark:from-sky-600 dark:to-sky-700 dark:hover:from-sky-700 dark:hover:to-sky-800`}
      >
        <Download
          size={16}
          className="transition-transform duration-300 group-hover:-rotate-6"
          aria-hidden="true"
        />
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            <span>Export Project</span>
          </>
        )}
      </button>

      <label
        htmlFor="cf-import-xlsx"
        title="Import from Excel"
        className="group inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
             bg-white border border-gray-200 text-gray-700 cursor-pointer
             hover:bg-gray-50 active:scale-95 transition-all duration-300
             dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
      >
        <UploadCloud
          className="w-4 h-4 transition-transform duration-300 
               group-hover:-rotate-6 group-hover:translate-y-0.5"
        />
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            <span>Import Project</span>
          </>
        )}

        <input
          disabled={isLoading}
          id="cf-import-xlsx"
          ref={fileRef}
          onChange={onFileChange}
          accept=".xlsx,.xls"
          type="file"
          className="hidden"
        />
      </label>
    </div>
  );
}
