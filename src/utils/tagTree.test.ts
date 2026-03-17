import { describe, expect, it } from "vitest";
import type { Tag } from "../App";
import {
  buildChildrenMap,
  flattenTagTree,
  getDescendantIds,
  hasChildren,
  wouldCreateCycle,
} from "./tagTree";

const tags: Tag[] = [
  { id: "root-b", name: "Lighting", parentId: null },
  { id: "root-a", name: "Characters", parentId: null },
  { id: "child-a", name: "Armor", parentId: "root-a" },
  { id: "child-b", name: "Faces", parentId: "root-a" },
  { id: "grandchild-a", name: "Helmets", parentId: "child-a" },
];

describe("tagTree utilities", () => {
  it("builds a parent-to-children lookup including root items", () => {
    const childrenMap = buildChildrenMap(tags);

    expect(childrenMap.get("__root__")?.map((tag) => tag.id)).toEqual(["root-b", "root-a"]);
    expect(childrenMap.get("root-a")?.map((tag) => tag.id)).toEqual(["child-a", "child-b"]);
  });

  it("collects descendants recursively and includes the starting tag", () => {
    expect([...getDescendantIds("root-a", tags)]).toEqual(["root-a", "child-b", "child-a", "grandchild-a"]);
    expect([...getDescendantIds("child-a", tags)]).toEqual(["child-a", "grandchild-a"]);
  });

  it("detects parent cycles before reparenting a tag", () => {
    expect(wouldCreateCycle("root-a", "grandchild-a", tags)).toBe(true);
    expect(wouldCreateCycle("child-b", "root-b", tags)).toBe(false);
  });

  it("flattens the tree depth-first with alphabetical sibling ordering", () => {
    expect(flattenTagTree(tags)).toEqual([
      { tag: tags[1], depth: 0 },
      { tag: tags[2], depth: 1 },
      { tag: tags[4], depth: 2 },
      { tag: tags[3], depth: 1 },
      { tag: tags[0], depth: 0 },
    ]);
  });

  it("reports whether a tag currently has children", () => {
    expect(hasChildren("root-a", tags)).toBe(true);
    expect(hasChildren("child-b", tags)).toBe(false);
  });
});
