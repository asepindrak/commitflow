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
};

export type Task = {
  id: string;
  title: string;
  description?: string;
  projectId?: string | null;
  status?: "todo" | "inprogress" | "done" | string;
  startDate?: string | null;
  dueDate?: string | null;
  priority?: string | null;
  comments?: any[];
  assigneeId?: string | null; // <--- new
  // optional: cached assignee name if you like
  assigneeName?: string | null;
  clientId?: string;
  // ...
};

export type TeamMember = {
  id: string;
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  photo?: string;
  password?: string;
};

export type Workspace = {
  id: string;
  name: string;
  description?: string;
  createdAt?: string;
};

export type Project = {
  id: string;
  name: string;
  description?: string;
  createdAt?: string;
};
