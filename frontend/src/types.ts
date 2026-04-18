// frontend/src/types.ts
export type Attachment = {
  id: string;
  name: string;
  type?: string;
  size?: number;
  url?: string;
};

export type Comment = {
  id: string;
  author: string;
  body: string;
  createdAt: string;
  attachments?: Attachment[];
  clientId?: string;
  updatedAt?: string;
  isTrash?: boolean;
};

export type TaskAssignee = {
  id: string;
  name: string;
  photo?: string;
  phone?: string;
  role?: string;
};

export type Task = {
  id: string;
  title: string;
  description?: string;

  projectId?: string | null;
  workspaceId?: string | null;
  status?: "todo" | "inprogress" | "qa" | "deploy" | "done" | "blocked";

  startDate?: string | null;
  dueDate?: string | null;

  priority?: "urgent" | "medium" | "low" | string;

  labels?: { name: string; color: string }[];
  sprintId?: string | null;
  dependencies?: { taskId: string; type: "blocked_by" | "blocks" }[];
  timeEntries?: {
    memberId: string;
    memberName: string;
    start: string;
    end?: string;
    duration?: number;
  }[];
  recurrence?: {
    pattern: "daily" | "weekly" | "monthly" | "custom";
    interval?: number;
    daysOfWeek?: number[];
    nextDue?: string;
  } | null;

  // ✅ MULTI ASSIGNEE (WAJIB)
  taskAssignees?: TaskAssignee[];

  comments?: any[];

  clientId?: string;

  createdAt?: string;
  updatedAt?: string;

  createdById?: string | null;
  updatedById?: string | null;

  isTrash?: boolean;
};

export type TeamMember = {
  id: string;
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  photo?: string;
  password?: string;
  createdAt?: string;
  updatedAt?: string;
  isTrash?: boolean;
  isAdmin?: boolean;
  clientId?: string;
  workspaceId?: string;
  userId?: string;
  Task?: any;
};

export type Workspace = {
  id: string;
  name: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  isTrash?: boolean;
  clientId?: string;
};

export type Project = {
  id: string;
  name: string;
  workspaceId: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  isTrash?: boolean;
  clientId?: string;
};

export type Sprint = {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  status: "planning" | "active" | "completed";
  startDate?: string | null;
  endDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
};
