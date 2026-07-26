export function reorderItems<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex)) return items;
  if (fromIndex < 0 || toIndex < 0) return items;
  if (fromIndex >= items.length || toIndex >= items.length) return items;
  if (fromIndex === toIndex) return items;

  const next = [...items];
  const [movedItem] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, movedItem);
  return next;
}
