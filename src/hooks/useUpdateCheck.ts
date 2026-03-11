import { useCallback, useEffect, useRef, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";

type UpdateStatus = "checking" | "available" | "up-to-date" | "installing" | "error";

export interface UpdateState {
  status: UpdateStatus;
  currentVersion: string;
  latestVersion: string | null;
  error: string | null;
  progress: number | null;
  downloadedBytes: number;
  totalBytes: number | null;
}

const initialState: UpdateState = {
  status: "checking",
  currentVersion: "",
  latestVersion: null,
  error: null,
  progress: null,
  downloadedBytes: 0,
  totalBytes: null,
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Failed to check for updates.";
}

export function useUpdateCheck() {
  const [updateState, setUpdateState] = useState<UpdateState>(initialState);
  const updateRef = useRef<Update | null>(null);
  const hasCheckedRef = useRef(false);

  const cacheUpdate = useCallback((nextUpdate: Update | null) => {
    const previousUpdate = updateRef.current;
    updateRef.current = nextUpdate;

    if (previousUpdate && previousUpdate !== nextUpdate) {
      void previousUpdate.close().catch(() => undefined);
    }
  }, []);

  const checkForUpdates = useCallback(async () => {
    let currentVersion = "";

    setUpdateState((previous) => ({
      ...previous,
      status: "checking",
      error: null,
      progress: null,
      downloadedBytes: 0,
      totalBytes: null,
    }));

    try {
      currentVersion = await getVersion();
      const update = await check();
      cacheUpdate(update);

      if (update) {
        setUpdateState({
          status: "available",
          currentVersion: update.currentVersion || currentVersion,
          latestVersion: update.version,
          error: null,
          progress: null,
          downloadedBytes: 0,
          totalBytes: null,
        });
        return;
      }

      setUpdateState({
        status: "up-to-date",
        currentVersion,
        latestVersion: null,
        error: null,
        progress: null,
        downloadedBytes: 0,
        totalBytes: null,
      });
    } catch (error) {
      cacheUpdate(null);
      setUpdateState((previous) => ({
        ...previous,
        currentVersion: currentVersion || previous.currentVersion,
        status: "error",
        error: getErrorMessage(error),
        progress: null,
        downloadedBytes: 0,
        totalBytes: null,
      }));
    }
  }, [cacheUpdate]);

  const installUpdate = useCallback(async () => {
    const update = updateRef.current;
    if (!update) return;

    let downloadedBytes = 0;
    let totalBytes: number | null = null;

    setUpdateState((previous) => ({
      ...previous,
      status: "installing",
      error: null,
      progress: 0,
      downloadedBytes: 0,
      totalBytes: null,
    }));

    try {
      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            totalBytes = event.data.contentLength ?? null;
            downloadedBytes = 0;
            setUpdateState((previous) => ({
              ...previous,
              status: "installing",
              progress: totalBytes ? 0 : null,
              downloadedBytes,
              totalBytes,
            }));
            break;
          case "Progress":
            downloadedBytes += event.data.chunkLength;
            setUpdateState((previous) => ({
              ...previous,
              status: "installing",
              progress: totalBytes ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)) : null,
              downloadedBytes,
              totalBytes,
            }));
            break;
          case "Finished":
            setUpdateState((previous) => ({
              ...previous,
              status: "installing",
              progress: 100,
              downloadedBytes,
              totalBytes,
            }));
            break;
        }
      });

      await relaunch();
    } catch (error) {
      setUpdateState((previous) => ({
        ...previous,
        status: updateRef.current ? "available" : "error",
        error: getErrorMessage(error),
        progress: null,
        downloadedBytes: 0,
        totalBytes: null,
      }));
    }
  }, []);

  useEffect(() => {
    if (hasCheckedRef.current) return;
    hasCheckedRef.current = true;
    void checkForUpdates();
  }, [checkForUpdates]);

  useEffect(() => {
    return () => {
      const update = updateRef.current;
      if (update) {
        void update.close().catch(() => undefined);
      }
    };
  }, []);

  return { updateState, checkForUpdates, installUpdate };
}