// frontend/src/components/ExportImportControls.tsx
import React, { useRef } from "react";
import * as XLSX from "xlsx";
import { toast } from "react-toastify";
import { Download, UploadCloud } from "lucide-react";
import type { Project, Task, TeamMember } from "../types";

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

  const safeString = (v: any) =>
    v === null || typeof v === "undefined" ? "" : String(v);
  const tryParseJSON = (s: string) => {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  };

  function exportXlsx() {
    try {
      // Determine tasks to export (per-project if selected)
      const filteredTasks = selectedProjectId
        ? tasks.filter((t) => t.projectId === selectedProjectId)
        : tasks.slice();

      // Build set of assigneeIds referenced by those tasks
      const assigneeIds = new Set<string>();
      for (const t of filteredTasks) {
        if ((t as any).assigneeId)
          assigneeIds.add(String((t as any).assigneeId));
      }

      // Try to find project's workspaceId for broader team inclusion (optional)
      const project = projects?.find((p) => p.id === selectedProjectId);
      const projectWorkspaceId = project?.workspaceId;

      // Team rows: include members referenced by tasks OR members belonging to same workspace (if known)
      const tmRows = team
        .filter((m) => {
          if (assigneeIds.size > 0 && assigneeIds.has(m.id)) return true;
          if (projectWorkspaceId && m.workspaceId === projectWorkspaceId)
            return true;
          // if no project selected, include all
          return !selectedProjectId;
        })
        .map((m) => ({
          id: m.id,
          clientId: (m as any).clientId ?? "",
          userId: m.userId ?? "",
          workspaceId: m.workspaceId ?? "",
          name: m.name,
          role: m.role ?? "",
          email: m.email ?? "",
          photo: m.photo ?? "",
          phone: m.phone ?? "",
          isTrash:
            typeof m.isTrash !== "undefined" ? Boolean(m.isTrash) : false,
          createdAt: (m as any).createdAt ? String((m as any).createdAt) : "",
          updatedAt: (m as any).updatedAt ? String((m as any).updatedAt) : "",
        }));

      // Tasks rows: include comments serialized
      const tkRows = filteredTasks.map((t) => ({
        id: t.id,
        clientId: (t as any).clientId ?? "",
        projectId: (t as any).projectId ?? "",
        title: t.title,
        description: t.description ?? "",
        status: t.status ?? "todo",
        assigneeId: t.assigneeId ?? "",
        priority: t.priority ?? "",
        startDate: t.startDate ?? "",
        dueDate: t.dueDate ?? "",
        isTrash:
          typeof (t as any).isTrash !== "undefined"
            ? Boolean((t as any).isTrash)
            : false,
        comments: JSON.stringify((t as any).comments ?? []),
        createdAt: (t as any).createdAt ? String((t as any).createdAt) : "",
        updatedAt: (t as any).updatedAt ? String((t as any).updatedAt) : "",
      }));

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

      toast.dark(
        `Exported ${tkRows.length} task(s) and ${tmRows.length} member(s) to Excel`
      );
    } catch (err) {
      console.error("Export failed", err);
      toast.dark("Export failed");
    }
  }

  function findSheetName(wb: XLSX.WorkBook, name: string) {
    return wb.SheetNames.find((n) => n.toLowerCase() === name.toLowerCase());
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
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

        onImport(out);
      } catch (err) {
        console.error("Import failed", err);
        toast.dark("Failed to import Excel file");
      } finally {
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
        <span>{selectedProjectId ? "Export project" : "Export all"}</span>
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
        <span>Import</span>

        <input
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
