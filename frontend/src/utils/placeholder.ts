const messagePlaceholders: string[] = [
  // 🔹 GitHub Analysis
  "list all repositories",
  "show contributors in the commitflow repo",
  "who contributed the most in the commitflow repository?",
  "show contribution stats for all members",
  "which repo has the highest activity?",
  "find inactive repositories",
  "compare contributions between members",
  "show commit history for the commitflow repo",
  "which files changed the most in commitflow?",
  "list all PRs in commitflow",
  "who opened the most PRs?",
  "show issues for commitflow",
  "which contributors are most active this week?",
  "find repositories owned by Bob",
  "show recent commits for all repos",

  // 🔹 Task & Project Management
  "list all active projects",
  "show all tasks in the commitflow project",
  "which tasks are in progress?",
  "what tasks are still in todo?",
  "show completed tasks in commitflow",
  "which project has the most tasks?",
  "list tasks assigned to Bob",
  "who has the most overdue tasks?",
  "which member is overloaded?",
  "show unassigned tasks",
  "compare task counts across all projects",
  "which tasks are due this week?",
  "show tasks grouped by status",
  "who has the most in-progress tasks?",
  "list tasks with high priority",
  "show project summary for commitflow",
  "find tasks created today",
  "show tasks assigned to me",
  "which members have no tasks?",
  "list projects with overdue deadlines",
];

function getRandomPlaceholder(): string {
  const index = Math.floor(Math.random() * messagePlaceholders.length);
  return messagePlaceholders[index];
}
export { getRandomPlaceholder };
