import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Moodboard, MoodboardImage, MoodboardText } from "../App";
import { useMoodboardsStorage } from "./useMoodboardsStorage";
import { invoke } from "@tauri-apps/api/core";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const invokeMock = vi.mocked(invoke);

describe("useMoodboardsStorage", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue("");
  });

  it("loads moodboards, images, and texts from the backend file", async () => {
    const data = {
      moodboards: [{ id: "board-1", name: "Board One" }] satisfies Moodboard[],
      moodboardImages: {
        "board-1": [{ id: "image-1", path: "D:/refs/a.png", x: 0, y: 0, width: 200, height: 200 }] satisfies MoodboardImage[],
      },
      moodboardTexts: {
        "board-1": [{ id: "text-1", text: "Notes", x: 20, y: 30, width: 180, height: 60, fontSize: 14 }] satisfies MoodboardText[],
      },
    };
    invokeMock.mockResolvedValueOnce(JSON.stringify(data));

    const { result } = renderHook(() => useMoodboardsStorage());

    await waitFor(() => {
      expect(result.current.moodboards).toEqual(data.moodboards);
    });
    expect(result.current.moodboardImages).toEqual(data.moodboardImages);
    expect(result.current.moodboardTexts).toEqual(data.moodboardTexts);
    expect(invokeMock).toHaveBeenCalledWith("load_moodboards_data");
  });

  it("migrates from localStorage when the backend data is unavailable", async () => {
    const fallbackMoodboards: Moodboard[] = [{ id: "board-2", name: "Local Board" }];
    const fallbackImages: Record<string, MoodboardImage[]> = {
      "board-2": [{ id: "image-2", path: "D:/refs/b.png", x: 10, y: 15, width: 200, height: 200 }],
    };
    const fallbackTexts: Record<string, MoodboardText[]> = {
      "board-2": [{ id: "text-2", text: "Local text", x: 5, y: 8, width: 160, height: 50, fontSize: 16 }],
    };
    localStorage.setItem("moodboards", JSON.stringify(fallbackMoodboards));
    localStorage.setItem("moodboardImages", JSON.stringify(fallbackImages));
    localStorage.setItem("moodboardTexts", JSON.stringify(fallbackTexts));
    invokeMock.mockRejectedValueOnce(new Error("missing file"));

    const { result } = renderHook(() => useMoodboardsStorage());

    await waitFor(() => {
      expect(result.current.moodboards).toEqual(fallbackMoodboards);
    });
    expect(result.current.moodboardImages).toEqual(fallbackImages);
    expect(result.current.moodboardTexts).toEqual(fallbackTexts);
  });

  it("persists state changes through the backend once hydrated", async () => {
    const nextMoodboards: Moodboard[] = [{ id: "board-3", name: "Next Board" }];
    const nextImages: Record<string, MoodboardImage[]> = {
      "board-3": [{ id: "image-3", path: "D:/refs/c.png", x: 25, y: 40, width: 200, height: 200 }],
    };
    const nextTexts: Record<string, MoodboardText[]> = {
      "board-3": [{ id: "text-3", text: "Caption", x: 12, y: 16, width: 170, height: 55, fontSize: 18 }],
    };
    const { result } = renderHook(() => useMoodboardsStorage());

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("load_moodboards_data");
    });

    act(() => {
      result.current.setMoodboards(nextMoodboards);
      result.current.setMoodboardImages(nextImages);
      result.current.setMoodboardTexts(nextTexts);
    });

    await waitFor(() => {
      expect(invokeMock).toHaveBeenLastCalledWith("save_moodboards_data", {
        data: JSON.stringify({
          moodboards: nextMoodboards,
          moodboardImages: nextImages,
          moodboardTexts: nextTexts,
        }),
      });
    });
  });
});
