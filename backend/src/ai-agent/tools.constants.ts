export const tools = [
  /**
   * ============================================
   * GITHUB REPOSITORY TOOLS
   * ============================================
   */
  {
    name: "getRepos",
    description:
      "Ambil daftar repository GitHub. Gunakan fungsi ini ketika pengguna bertanya tentang nama repo, pilihan repo, atau repo yang tersedia.",
    type: "function",
    function: {
      name: "getRepos",
    },
  },
  {
    name: "getContributors",
    description:
      "Gunakan fungsi ini ketika pengguna bertanya tentang kontributor, jumlah commit, kontribusi terbanyak, atau aktivitas developer pada sebuah repository. Fungsi ini membutuhkan nama repo.",
    type: "function",
    function: {
      name: "getContributors",
      parameters: {
        type: "object",
        properties: {
          repo: {
            type: "string",
            description:
              "Nama repository target, harus cocok dengan salah satu yang dikembalikan oleh getRepos.",
          },
        },
        required: ["repo"],
      },
    },
  },

  /**
   * ============================================
   * PROJECT MANAGEMENT TOOLS
   * ============================================
   */
  {
    name: "getProjects",
    description:
      "Ambil daftar project aktif beserta statistik task (todo, inprogress, done). Gunakan fungsi ini ketika pengguna bertanya tentang daftar project, detail project, atau ingin mengetahui project mana yang memiliki task tertentu.",
    type: "function",
    function: {
      name: "getProjects",
    },
  },

  {
    name: "getMembers",
    description:
      "Ambil daftar anggota tim beserta statistik tugas yang mereka miliki. Gunakan fungsi ini ketika pengguna bertanya tentang assignee, workload anggota, atau ingin mencocokkan assigneeId.",
    type: "function",
    function: {
      name: "getMembers",
    },
  },

  {
    name: "getAllTasks",
    description:
      "Ambil semua task (filtered by projectId bila tersedia). Gunakan fungsi ini ketika pengguna meminta daftar task tanpa filter status.",
    type: "function",
    function: {
      name: "getAllTasks",
      parameters: {
        type: "object",
        properties: {
          projectId: {
            type: "string",
            description:
              "ID project (opsional). Jika diberikan, kembalikan task yang hanya berasal dari project tersebut.",
          },
        },
      },
    },
  },

  {
    name: "getTodoTasks",
    description:
      "Ambil task dengan status 'todo'. Dapat difilter berdasarkan projectId.",
    type: "function",
    function: {
      name: "getTodoTasks",
      parameters: {
        type: "object",
        properties: {
          projectId: {
            type: "string",
            description: "ID project (opsional).",
          },
        },
      },
    },
  },

  {
    name: "getInProgressTasks",
    description:
      "Ambil task dengan status 'inprogress'. Dapat difilter berdasarkan projectId.",
    type: "function",
    function: {
      name: "getInProgressTasks",
      parameters: {
        type: "object",
        properties: {
          projectId: {
            type: "string",
            description: "ID project (opsional).",
          },
        },
      },
    },
  },

  {
    name: "getDoneTasks",
    description:
      "Ambil task dengan status 'done'. Dapat difilter berdasarkan projectId.",
    type: "function",
    function: {
      name: "getDoneTasks",
      parameters: {
        type: "object",
        properties: {
          projectId: {
            type: "string",
            description: "ID project (opsional).",
          },
        },
      },
    },
  },
  {
    name: "getUnassignedTasks",
    description:
      "Ambil semua task yang belum memiliki assignee. Bisa difilter berdasarkan projectId.",
    type: "function",
    function: {
      name: "getUnassignedTasks",
      parameters: {
        type: "object",
        properties: {
          projectId: {
            type: "string",
            description: "ID project (opsional).",
          },
        },
      },
    },
  },
  {
    name: "getUrgentTasks",
    description:
      "Ambil semua task dengan priority 'urgent'. Bisa difilter berdasarkan projectId.",
    type: "function",
    function: {
      name: "getUrgentTasks",
      parameters: {
        type: "object",
        properties: {
          projectId: {
            type: "string",
            description: "ID project (opsional).",
          },
        },
      },
    },
  },
  {
    name: "getLowTasks",
    description:
      "Ambil semua task dengan priority 'low'. Bisa difilter berdasarkan projectId.",
    type: "function",
    function: {
      name: "getLowTasks",
      parameters: {
        type: "object",
        properties: {
          projectId: {
            type: "string",
            description: "ID project (opsional).",
          },
        },
      },
    },
  },
  {
    name: "getMediumTasks",
    description:
      "Ambil semua task dengan priority 'medium'. Bisa difilter berdasarkan projectId.",
    type: "function",
    function: {
      name: "getMediumTasks",
      parameters: {
        type: "object",
        properties: {
          projectId: {
            type: "string",
            description: "ID project (opsional).",
          },
        },
      },
    },
  },
];
