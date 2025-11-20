import React, { useRef } from "react";
import * as XLSX from "xlsx";
import { toast } from "react-toastify";
import { Download, UploadCloud } from "lucide-react";
import type { Project, Task, TeamMember } from "../types";

/**
 * ExportImportControls
 * - Exports projects, tasks (including comments & attachments), and team to XLSX
 * - Imports XLSX and maps sheets back to projects/tasks/team. Tasks.comments is parsed from JSON.
 *
 * Usage:
 * <ExportImportControls projects={projects} tasks={tasks} team={team} onImport={handleImport} />
 */

export default function ExportImportControls({
  projects,
  tasks,
  team,
  onImport,
}: {
  projects: Project[];
  tasks: Task[];
  team: TeamMember[];
  onImport: (payload: {
    projects?: Project[];
    tasks?: Task[];
    team?: string[];
  }) => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);

  function exportXlsx() {
    try {
      // Prepare data
      const pj = projects.map((p) => ({
        id: p.id,
        name: p.name,
        description: (p as any).description ?? "",
        createdAt: (p as any).createdAt ?? "",
        updatedAt: (p as any).updatedAt ?? "",
      }));

      // prepare team sheet rows (full objects)
      const tmRows = team.map((m) => ({
        id: m.id,
        name: m.name,
        role: m.role ?? "",
        email: m.email ?? "",
        photo: m.photo ?? "",
      }));

      // build quick map from team id -> name for assigneeName resolution
      const teamById = new Map<string, TeamMember>();
      for (const m of team) teamById.set(m.id, m);

      const tk = tasks.map((t) => {
        // resolve assigneeName: prefer explicit field, otherwise lookup by id
        const assigneeName =
          (t as any).assigneeName ??
          (t.assigneeId ? teamById.get(t.assigneeId)?.name : undefined) ??
          "";
        return {
          id: t.id,
          title: t.title,
          description: t.description ?? "",
          status: t.status ?? "todo",
          projectId: t.projectId ?? "",
          assigneeId: t.assigneeId ?? "",
          assigneeName,
          priority: (t as any).priority ?? "",
          startDate: t.startDate ?? "",
          dueDate: t.dueDate ?? "",
          // comments stored as JSON string so they survive roundtrip
          comments: JSON.stringify(t.comments || []),
          createdAt: (t as any).createdAt ?? "",
          updatedAt: (t as any).updatedAt ?? "",
        };
      });

      const wb = XLSX.utils.book_new();
      // Use consistent sheet names lowercase for compatibility with existing import code
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(pj),
        "projects"
      );
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tk), "tasks");
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(tmRows),
        "team"
      );

      const filename = `commitflow_export_${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`;

      // write & download
      XLSX.writeFile(wb, filename);

      toast.dark("Exported project data to Excel (includes comments)");
    } catch (err) {
      console.error("Export failed", err);
      toast.dark("Export failed");
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = ev.target?.result;
        // prefer 'binary' for compatibility
        const wb = XLSX.read(data as any, { type: "binary" });
        const out: any = {};

        // --- projects ---
        if (wb.SheetNames.some((n) => n.toLowerCase() === "projects")) {
          const name = wb.SheetNames.find(
            (n) => n.toLowerCase() === "projects"
          )!;
          const pjRaw = XLSX.utils.sheet_to_json(wb.Sheets[name], {
            defval: "",
          });
          out.projects = pjRaw
            .map((r: any) => ({
              id: String(r.id ?? r.ID ?? r.Id ?? "").trim(),
              name: String(r.name ?? r.Name ?? "").trim(),
              description: String(r.description ?? r.Description ?? ""),
              createdAt: String(r.createdAt ?? r.CreatedAt ?? ""),
              updatedAt: String(r.updatedAt ?? r.UpdatedAt ?? ""),
            }))
            .filter((p: any) => p.id && p.name);
        }

        // --- tasks (with comments parsing) ---
        if (wb.SheetNames.some((n) => n.toLowerCase() === "tasks")) {
          const name = wb.SheetNames.find((n) => n.toLowerCase() === "tasks")!;
          const tkRaw = XLSX.utils.sheet_to_json(wb.Sheets[name], {
            defval: "",
          });
          out.tasks = tkRaw
            .map((r: any) => {
              // parse comments column if present and valid JSON
              let comments = [] as any[];
              const commentsRaw = (
                r.comments ??
                r.Comments ??
                r.COMMENT ??
                ""
              ).toString();
              if (commentsRaw) {
                try {
                  const parsed = JSON.parse(commentsRaw);
                  if (Array.isArray(parsed)) comments = parsed;
                } catch {
                  comments = [];
                }
              }

              return {
                id: String(r.id ?? r.ID ?? r.Id ?? "").trim(),
                title: String(r.title ?? r.Title ?? "").trim(),
                description: r.description ?? r.Description ?? "",
                status: r.status ?? r.Status ?? "todo",
                projectId: String(
                  r.projectId ?? r.projectID ?? r.project ?? ""
                ).trim(),
                assigneeId:
                  (r.assigneeId ?? r.AssigneeId ?? r.assignee ?? "")
                    .toString()
                    .trim() || undefined,
                assigneeName:
                  (r.assigneeName ?? r.AssigneeName ?? r.assignee_name ?? "")
                    .toString()
                    .trim() || undefined,
                priority:
                  (r.priority ?? r.Priority ?? "").toString().trim() ||
                  undefined,
                startDate: (r.startDate ?? r.StartDate ?? "").toString() || "",
                dueDate: (r.dueDate ?? r.DueDate ?? "").toString() || "",
                comments,
                createdAt:
                  String(
                    r.createdAt ?? r.CreatedAt ?? r.createdAt ?? ""
                  ).trim() || undefined,
                updatedAt:
                  String(
                    r.updatedAt ?? r.UpdatedAt ?? r.updatedAt ?? ""
                  ).trim() || undefined,
              };
            })
            .filter((t: any) => t.id && t.title);
        }

        // --- team ---
        if (wb.SheetNames.some((n) => n.toLowerCase() === "team")) {
          const name = wb.SheetNames.find((n) => n.toLowerCase() === "team")!;
          const tmRaw = XLSX.utils.sheet_to_json(wb.Sheets[name], {
            defval: "",
          });
          // out.team for onImport expects string[] of names (existing code expects name list)
          out.team = tmRaw
            .map((r: any) => {
              // prefer name column; if id present we still return name (for create/update team upstream)
              const nm = r.name ?? r.Name ?? r.username ?? r.Username ?? "";
              return String(nm).trim();
            })
            .filter((n: string) => !!n);
        }

        onImport(out);
        toast.dark(
          "Imported Excel file successfully (comments included if present)"
        );
      } catch (err: any) {
        console.error("Import failed", err);
        toast.dark("Failed to import Excel file");
      } finally {
        if (fileRef.current) fileRef.current.value = "";
      }
    };

    // read file as binary string (SheetJS compatible)
    reader.readAsBinaryString(f);
  }

  return (
    <div className="flex items-center gap-3">
      {/* Export button: gradient, prominent */}
      <button
        onClick={exportXlsx}
        title="Export to Excel"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                   bg-gradient-to-r from-sky-500 to-sky-600 text-white shadow-md
                   hover:from-sky-600 hover:to-sky-700 active:scale-95 transition-transform
                   dark:from-sky-600 dark:to-sky-700"
        aria-label="Export to Excel"
      >
        <Download className="w-4 h-4" />
        <span>Export</span>
      </button>

      {/* Import button: lighter, supports dark */}
      <label
        htmlFor="cf-import-xlsx"
        title="Import from Excel"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                   bg-white border border-gray-200 text-gray-700 cursor-pointer
                   hover:bg-gray-50 active:scale-95 transition-colors
                   dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
      >
        <UploadCloud className="w-4 h-4" />
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
