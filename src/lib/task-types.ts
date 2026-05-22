export const TASK_TYPE_OPTIONS = [
  "Debugging",
  "Code writing",
  "Code review",
  "Exploration & learning",
  "Maintenance & ops tooling",
  "Planning & requirements",
  "Design",
  "Testing",
  "Deployment & infra",
  "Communication",
] as const;

export type TaskType = (typeof TASK_TYPE_OPTIONS)[number];

export function isTaskType(value: string): value is TaskType {
  return (TASK_TYPE_OPTIONS as readonly string[]).includes(value);
}
