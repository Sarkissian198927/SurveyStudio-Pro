export const PROJECT_ROLES = ['owner', 'editor', 'viewer', 'analyst', 'guest'] as const;
export type ProjectRole = typeof PROJECT_ROLES[number];
export type ProjectAction = 'read' | 'write' | 'manage';
export function isProjectRole(role: unknown): role is ProjectRole {
  return PROJECT_ROLES.some(value => value === role);
}
export function permits(role: unknown, action: ProjectAction): boolean {
  if (!isProjectRole(role)) return false;
  return action === 'read' || role === 'owner' || (action === 'write' && role === 'editor');
}
