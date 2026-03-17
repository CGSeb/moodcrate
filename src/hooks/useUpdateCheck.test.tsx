import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUpdateCheck } from "./useUpdateCheck";
import { getVersion } from "@tauri-apps/api/app";
import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";

vi.mock("@tauri-apps/api/app", () => ({
  getVersion: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-updater", () => ({
  check: vi.fn(),
}));

const getVersionMock = vi.mocked(getVersion);
const relaunchMock = vi.mocked(relaunch);
const checkMock = vi.mocked(check);

describe("useUpdateCheck", () => {
  beforeEach(() => {
    getVersionMock.mockReset();
    relaunchMock.mockReset();
    checkMock.mockReset();
    getVersionMock.mockResolvedValue("1.3.2");
    relaunchMock.mockResolvedValue(undefined);
  });

  it("marks the app as up to date when no update is available", async () => {
    checkMock.mockResolvedValueOnce(null);

    const { result } = renderHook(() => useUpdateCheck());

    await waitFor(() => {
      expect(result.current.updateState.status).toBe("up-to-date");
    });

    expect(result.current.updateState.currentVersion).toBe("1.3.2");
  });

  it("stores an available update and installs it with progress", async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const downloadAndInstall = vi.fn(async (onEvent: (event: any) => void) => {
      onEvent({ event: "Started", data: { contentLength: 100 } });
      onEvent({ event: "Progress", data: { chunkLength: 40 } });
      onEvent({ event: "Progress", data: { chunkLength: 60 } });
      onEvent({ event: "Finished", data: {} });
    });
    const update = {
      version: "1.4.0",
      currentVersion: "1.3.2",
      close,
      downloadAndInstall,
    };
    checkMock.mockResolvedValueOnce(update as any);

    const { result, unmount } = renderHook(() => useUpdateCheck());

    await waitFor(() => {
      expect(result.current.updateState.status).toBe("available");
    });
    expect(result.current.updateState.latestVersion).toBe("1.4.0");

    await act(async () => {
      await result.current.installUpdate();
    });

    expect(downloadAndInstall).toHaveBeenCalledTimes(1);
    expect(result.current.updateState.progress).toBe(100);
    expect(result.current.updateState.downloadedBytes).toBe(100);
    expect(relaunchMock).toHaveBeenCalledTimes(1);

    unmount();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("returns an error state when checking for updates fails", async () => {
    checkMock.mockRejectedValueOnce(new Error("Cannot reach server"));

    const { result } = renderHook(() => useUpdateCheck());

    await waitFor(() => {
      expect(result.current.updateState.status).toBe("error");
    });

    expect(result.current.updateState.error).toBe("Cannot reach server");
  });

  it("falls back to a generic error for unknown check errors", async () => {
    checkMock.mockRejectedValueOnce("boom");

    const { result } = renderHook(() => useUpdateCheck());

    await waitFor(() => {
      expect(result.current.updateState.status).toBe("error");
    });

    expect(result.current.updateState.error).toBe("Failed to check for updates.");
  });

  it("restores the available state when installation fails", async () => {
    const update = {
      version: "1.4.0",
      currentVersion: "1.3.2",
      close: vi.fn().mockResolvedValue(undefined),
      downloadAndInstall: vi.fn().mockRejectedValue(new Error("Install failed")),
    };
    checkMock.mockResolvedValueOnce(update as any);

    const { result } = renderHook(() => useUpdateCheck());

    await waitFor(() => {
      expect(result.current.updateState.status).toBe("available");
    });

    await act(async () => {
      await result.current.installUpdate();
    });

    expect(result.current.updateState.status).toBe("available");
    expect(result.current.updateState.error).toBe("Install failed");
  });

  it("closes the previous update handle when a new check returns a different update", async () => {
    const firstUpdate = {
      version: "1.4.0",
      currentVersion: "1.3.2",
      close: vi.fn().mockResolvedValue(undefined),
      downloadAndInstall: vi.fn(),
    };
    const secondUpdate = {
      version: "1.5.0",
      currentVersion: "1.3.2",
      close: vi.fn().mockResolvedValue(undefined),
      downloadAndInstall: vi.fn(),
    };
    checkMock.mockResolvedValueOnce(firstUpdate as any).mockResolvedValueOnce(secondUpdate as any);

    const { result } = renderHook(() => useUpdateCheck());

    await waitFor(() => {
      expect(result.current.updateState.latestVersion).toBe("1.4.0");
    });

    await act(async () => {
      await result.current.checkForUpdates();
    });

    expect(firstUpdate.close).toHaveBeenCalledTimes(1);
    expect(result.current.updateState.latestVersion).toBe("1.5.0");
  });

  it("does nothing when installUpdate is called without an available update", async () => {
    checkMock.mockResolvedValueOnce(null);

    const { result } = renderHook(() => useUpdateCheck());

    await waitFor(() => {
      expect(result.current.updateState.status).toBe("up-to-date");
    });

    await act(async () => {
      await result.current.installUpdate();
    });

    expect(relaunchMock).not.toHaveBeenCalled();
  });

  it("handles installs without a reported content length", async () => {
    const update = {
      version: "1.4.0",
      currentVersion: "",
      close: vi.fn().mockResolvedValue(undefined),
      downloadAndInstall: vi.fn(async (onEvent: (event: any) => void) => {
        onEvent({ event: "Started", data: { contentLength: null } });
        onEvent({ event: "Progress", data: { chunkLength: 10 } });
      }),
    };
    checkMock.mockResolvedValueOnce(update as any);

    const { result } = renderHook(() => useUpdateCheck());

    await waitFor(() => {
      expect(result.current.updateState.status).toBe("available");
    });

    await act(async () => {
      await result.current.installUpdate();
    });

    expect(result.current.updateState.currentVersion).toBe("1.3.2");
    expect(result.current.updateState.progress).toBeNull();
  });
});
