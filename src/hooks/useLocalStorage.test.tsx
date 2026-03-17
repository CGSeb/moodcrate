import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useLocalStorage } from "./useLocalStorage";

describe("useLocalStorage", () => {
  it("hydrates state from an existing stored value", () => {
    localStorage.setItem("favorites", JSON.stringify(["collection-1"]));

    const { result } = renderHook(() => useLocalStorage<string[]>("favorites", []));

    expect(result.current[0]).toEqual(["collection-1"]);
  });

  it("falls back to the initial value when stored JSON is invalid", async () => {
    localStorage.setItem("favorites", "{invalid-json");

    const { result } = renderHook(() => useLocalStorage<string[]>("favorites", ["fallback"]));

    expect(result.current[0]).toEqual(["fallback"]);
    await waitFor(() => {
      expect(localStorage.getItem("favorites")).toBe(JSON.stringify(["fallback"]));
    });
  });

  it("persists updates back to localStorage", async () => {
    const { result } = renderHook(() => useLocalStorage<string[]>("favorites", []));

    act(() => {
      result.current[1](["board-1", "board-2"]);
    });

    await waitFor(() => {
      expect(localStorage.getItem("favorites")).toBe(JSON.stringify(["board-1", "board-2"]));
    });
  });
});
