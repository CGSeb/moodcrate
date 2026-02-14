import type { Tag } from "../App";

/** Build a lookup from parent key to its direct children */
export function buildChildrenMap(tags: Tag[]): Map<string, Tag[]> {
  const map = new Map<string, Tag[]>();
  for (const tag of tags) {
    const parentKey = tag.parentId ?? "__root__";
    const children = map.get(parentKey) ?? [];
    children.push(tag);
    map.set(parentKey, children);
  }
  return map;
}

/** Get all descendant IDs of a given tag (inclusive of the tag itself) */
export function getDescendantIds(tagId: string, tags: Tag[]): Set<string> {
  const childrenMap = buildChildrenMap(tags);
  const result = new Set<string>();
  const stack = [tagId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    result.add(current);
    const children = childrenMap.get(current) ?? [];
    for (const child of children) {
      stack.push(child.id);
    }
  }
  return result;
}

/** Check if making tagId a child of newParentId would create a cycle */
export function wouldCreateCycle(
  tagId: string,
  newParentId: string,
  tags: Tag[]
): boolean {
  let current: string | null = newParentId;
  while (current) {
    if (current === tagId) return true;
    const tag = tags.find((t) => t.id === current);
    current = tag?.parentId ?? null;
  }
  return false;
}

/** Flatten the tag tree into display order (depth-first, alphabetical siblings) */
export function flattenTagTree(tags: Tag[]): Array<{ tag: Tag; depth: number }> {
  const childrenMap = buildChildrenMap(tags);
  const result: Array<{ tag: Tag; depth: number }> = [];

  function walk(parentKey: string, depth: number) {
    const children = (childrenMap.get(parentKey) ?? [])
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const child of children) {
      result.push({ tag: child, depth });
      walk(child.id, depth + 1);
    }
  }

  walk("__root__", 0);
  return result;
}

/** Check if a tag has any children */
export function hasChildren(tagId: string, tags: Tag[]): boolean {
  return tags.some((t) => t.parentId === tagId);
}
