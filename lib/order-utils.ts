export function isDueSoon(dueDate: Date | null) {
  if (!dueDate) return false;
  const now = new Date();
  const diff = new Date(dueDate).getTime() - now.getTime();
  return diff > 0 && diff < 2 * 24 * 60 * 60 * 1000;
}

export function isOverdue(dueDate: Date | null) {
  if (!dueDate) return false;
  return new Date(dueDate).getTime() < Date.now();
}
