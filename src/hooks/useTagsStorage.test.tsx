import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Tag } from "../App";
import { useTagsStorage } from "./useTagsStorage";
import { invoke } from "@tauri-apps/api/core";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const invokeMock = vi.mocked(invoke);

describe("useTagsStorage", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue("");
  });

  it("loads saved tags data from the backend file", async () => {
    const data = {
      tags: [{ id: "tag-1", name: "Portrait", parentId: null }] satisfies Tag[],
      imageTags: { "D:/refs/a.png": ["tag-1"] },
    };
    invokeMock.mockResolvedValueOnce(JSON.stringify(data));

    const { result } = renderHook(() => useTagsStorage());

    await waitFor(() => {
      expect(result.current.tags).toEqual(data.tags);
    });
    expect(result.current.imageTags).toEqual(data.imageTags);
    expect(invokeMock).toHaveBeenCalledWith("load_tags_data");
  });

  it("migrates from localStorage when the backend load fails", async () => {
    const fallbackTags: Tag[] = [{ id: "tag-2", name: "Color", parentId: null }];
    const fallbackImageTags = { "D:/refs/b.png": ["tag-2"] };
    localStorage.setItem("tags", JSON.stringify(fallbackTags));
    localStorage.setItem("imageTags", JSON.stringify(fallbackImageTags));
    invokeMock.mockRejectedValueOnce(new Error("missing file"));

    const { result } = renderHook(() => useTagsStorage());

    await waitFor(() => {
      expect(result.current.tags).toEqual(fallbackTags);
    });
    expect(result.current.imageTags).toEqual(fallbackImageTags);
  });

  it("persists changes back through the backend once loading is complete", async () => {
    const nextTags: Tag[] = [{ id: "tag-3", name: "Environment", parentId: null }];
    const nextImageTags = { "D:/refs/c.png": ["tag-3"] };
    const { result } = renderHook(() => useTagsStorage());

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("load_tags_data");
    });

    act(() => {
      result.current.setTags(nextTags);
      result.current.setImageTags(nextImageTags);
    });

    await waitFor(() => {
      expect(invokeMock).toHaveBeenLastCalledWith("save_tags_data", {
        data: JSON.stringify({ tags: nextTags, imageTags: nextImageTags }),
      });
    });
  });
});
