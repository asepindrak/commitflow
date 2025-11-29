export const tools = [
  /**
   * ============================================
   * GITHUB REPOSITORY TOOLS
   * ============================================
   */
  {
    name: "getRepos",
    description:
      "Retrieve the list of GitHub repositories. Use this function when the user asks about repository names, available repositories, or repo options. The result should include actionable insights for each repo: recent activity (last commit date), open issues/PR counts, active contributors count, primary language, CI status (if available), and a short recommendation (e.g., 'needs PR review', 'archived candidate').",
    type: "function",
    function: {
      name: "getRepos",
    },
    // Hint for the assistant / backend on what to include in results
    outputFormat: {
      perRepo: {
        id: "string",
        name: "string",
        description: "string",
        primaryLanguage: "string",
        lastCommitDate: "ISO8601 string",
        openPRCount: "number",
        openIssueCount: "number",
        activeContributorsLast30Days: "number",
        ciStatus: "string (passing/failed/unknown)",
        recommendedAction: "string (short)",
      },
      summary: {
        totalRepos: "number",
        activeRepoCount30d: "number",
        reposNeedingAttention: "number",
      },
    },
  },

  {
    name: "getContributors",
    description:
      "Use this function when the user asks about contributors, commit counts, top contributors, or developer activity for a specific repository. This function requires the repository name. The result should provide contributor-level metrics and insights: total commits, commits in the last 30/90 days, PRs opened/merged, issues opened, lines added/removed (if available), recent activity timestamp, and a short note identifying top contributors and potential areas for recognition or triage.",
    type: "function",
    function: {
      name: "getContributors",
      parameters: {
        type: "object",
        properties: {
          repo: {
            type: "string",
            description:
              "The target repository name. Must match one of the repositories returned by getRepos.",
          },
        },
        required: ["repo"],
      },
    },
    outputFormat: {
      repo: "string",
      contributors: [
        {
          id: "string",
          username: "string",
          totalCommits: "number",
          commitsLast30Days: "number",
          prsOpened: "number",
          prsMerged: "number",
          issuesOpened: "number",
          lastActivity: "ISO8601 string",
          linesAdded: "number | null",
          linesRemoved: "number | null",
          suggestedRecognition: "string (e.g., 'Top committer this month')",
        },
      ],
      summary: {
        topContributors: "array of usernames (top 3)",
        activeContributorCount30d: "number",
        trend: "string (increasing/decreasing/stable)",
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
      "Retrieve the list of active projects along with task statistics (todo, inprogress, done). The response should include per-project insights: task breakdown by status, completion rate (%), overdue task count, blocked tasks count, recent activity, risk level (low/medium/high) and recommended next steps (e.g., 'reassign overdue tasks', 'prioritize critical bugfixes'). Use this function when the user asks about project lists, project details, or which project contains certain tasks.",
    type: "function",
    function: {
      name: "getProjects",
    },
    outputFormat: {
      projects: [
        {
          id: "string",
          name: "string",
          description: "string",
          counts: {
            todo: "number",
            inprogress: "number",
            done: "number",
            blocked: "number",
            overdue: "number",
          },
          completionRatePercent: "number",
          lastActivity: "ISO8601 string",
          riskLevel: "string (low|medium|high)",
          topIssues: ["string"],
          recommendedActions: ["string"],
        },
      ],
      summary: {
        totalProjects: "number",
        projectsAtRisk: "number",
      },
    },
  },

  {
    name: "getMembers",
    description:
      "Retrieve the list of team members along with their task statistics and workload insights. Response should include tasks assigned, tasks by status, overdue counts, recent activity, and a short workload recommendation (e.g., 'overloaded — reassign', 'underutilized — assign new tasks'). Use this when the user asks about assignees, workload distribution, or matching an assigneeId.",
    type: "function",
    function: {
      name: "getMembers",
    },
    outputFormat: {
      members: [
        {
          id: "string",
          name: "string",
          role: "string",
          assignedTaskCount: "number",
          todoCount: "number",
          inprogressCount: "number",
          doneCount: "number",
          overdueCount: "number",
          lastActivity: "ISO8601 string",
          utilizationPercent: "number (estimated)",
          recommendation: "string",
        },
      ],
      summary: {
        mostLoadedMember: "string",
        leastLoadedMember: "string",
        averageUtilizationPercent: "number",
      },
    },
  },

  {
    name: "getAllTasks",
    description:
      "Retrieve all tasks (filtered by projectId if provided). Results should be detailed and actionable: include id, title, description snippet, status, priority, assignee (if any), createdAt, updatedAt, dueDate, age (days open), linked PR/issue IDs, dependencies, blocker flag, commentsCount, and suggested next action (e.g., 'assign', 'review PR', 'change priority'). Use this when the user requests a list of tasks without a status filter.",
    type: "function",
    function: {
      name: "getAllTasks",
      parameters: {
        type: "object",
        properties: {
          projectId: {
            type: "string",
            description:
              "Optional project ID. If provided, return only tasks from that project.",
          },
        },
      },
    },
    outputFormat: {
      tasks: [
        {
          id: "string",
          title: "string",
          description: "string",
          status: "string (todo|inprogress|done|blocked)",
          priority: "string (urgent|medium|low)",
          assigneeId: "string | null",
          assigneeName: "string | null",
          createdAt: "ISO8601 string",
          updatedAt: "ISO8601 string",
          dueDate: "ISO8601 string | null",
          ageDays: "number",
          linkedPRs: ["string"],
          linkedIssues: ["string"],
          dependencies: ["taskId"],
          blocker: "boolean",
          commentsCount: "number",
          suggestedAction: "string",
        },
      ],
      summary: {
        totalTasks: "number",
        overdueTasks: "number",
        blockedTasks: "number",
      },
    },
  },

  {
    name: "getTodoTasks",
    description:
      "Retrieve tasks with the 'todo' status. Include the same detailed fields as getAllTasks plus suggestions for prioritization (e.g., 'start next week', 'urgent: reassign'). Can be filtered by projectId.",
    type: "function",
    function: {
      name: "getTodoTasks",
      parameters: {
        type: "object",
        properties: {
          projectId: {
            type: "string",
            description: "Optional project ID.",
          },
        },
      },
    },
    outputFormat: {
      tasks: "same schema as getAllTasks.tasks",
      summary: {
        todoCount: "number",
        highPriorityTodoCount: "number",
      },
    },
  },

  {
    name: "getInProgressTasks",
    description:
      "Retrieve tasks with the 'inprogress' status. Provide details including blockers, time-in-progress (age), PR links, assignees, and recommended next steps to complete (e.g., 'needs QA', 'awaiting review'). Can be filtered by projectId.",
    type: "function",
    function: {
      name: "getInProgressTasks",
      parameters: {
        type: "object",
        properties: {
          projectId: {
            type: "string",
            description: "Optional project ID.",
          },
        },
      },
    },
    outputFormat: {
      tasks: "same schema as getAllTasks.tasks",
      summary: {
        inprogressCount: "number",
        stalledCount: "number (inprogress > X days)",
      },
    },
  },

  {
    name: "getDoneTasks",
    description:
      "Retrieve tasks with the 'done' status. Include completion date, time-to-complete (days), who completed it, and link to PR or merge if applicable. Useful for trend analysis and velocity estimation. Can be filtered by projectId.",
    type: "function",
    function: {
      name: "getDoneTasks",
      parameters: {
        type: "object",
        properties: {
          projectId: {
            type: "string",
            description: "Optional project ID.",
          },
        },
      },
    },
    outputFormat: {
      tasks: [
        {
          id: "string",
          title: "string",
          completedAt: "ISO8601 string",
          completedBy: "string",
          timeToCompleteDays: "number",
          linkedPR: "string | null",
        },
      ],
      summary: {
        doneCount: "number",
        averageTimeToCompleteDays: "number",
      },
    },
  },

  {
    name: "getUnassignedTasks",
    description:
      "Retrieve all tasks that do not have an assignee. Response should highlight priority, age, project, and suggested assignees (based on workload/skill matching if available). Can be filtered by projectId.",
    type: "function",
    function: {
      name: "getUnassignedTasks",
      parameters: {
        type: "object",
        properties: {
          projectId: {
            type: "string",
            description: "Optional project ID.",
          },
        },
      },
    },
    outputFormat: {
      tasks: "same schema as getAllTasks.tasks (assigneeId null)",
      summary: {
        totalUnassigned: "number",
        highPriorityUnassigned: "number",
        recommendedAssigneeSuggestions: ["{memberId, reason}"],
      },
    },
  },

  {
    name: "getUrgentTasks",
    description:
      "Retrieve all tasks with 'urgent' priority. Include context: why urgent (deadline / blocker / severity), assignee (if any), dueDate, and suggested immediate actions. Can be filtered by projectId.",
    type: "function",
    function: {
      name: "getUrgentTasks",
      parameters: {
        type: "object",
        properties: {
          projectId: {
            type: "string",
            description: "Optional project ID.",
          },
        },
      },
    },
    outputFormat: {
      tasks: "same schema as getAllTasks.tasks",
      summary: {
        totalUrgent: "number",
        urgentByProject: "{projectId: count}",
      },
    },
  },

  {
    name: "getLowTasks",
    description:
      "Retrieve all tasks with 'low' priority. Include time-since-creation and recommendation whether to keep for backlog grooming or archive. Can be filtered by projectId.",
    type: "function",
    function: {
      name: "getLowTasks",
      parameters: {
        type: "object",
        properties: {
          projectId: {
            type: "string",
            description: "Optional project ID.",
          },
        },
      },
    },
    outputFormat: {
      tasks: "same schema as getAllTasks.tasks",
      summary: {
        lowPriorityCount: "number",
        suggestedBacklogCandidates: ["taskId"],
      },
    },
  },

  {
    name: "getMediumTasks",
    description:
      "Retrieve all tasks with 'medium' priority. Include estimated effort (if available), dependencies, and recommended scheduling windows. Can be filtered by projectId.",
    type: "function",
    function: {
      name: "getMediumTasks",
      parameters: {
        type: "object",
        properties: {
          projectId: {
            type: "string",
            description: "Optional project ID.",
          },
        },
      },
    },
    outputFormat: {
      tasks: "same schema as getAllTasks.tasks",
      summary: {
        mediumPriorityCount: "number",
      },
    },
  },
];
