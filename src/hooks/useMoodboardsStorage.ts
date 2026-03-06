import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Moodboard, MoodboardImage, MoodboardText } from "../App";

interface MoodboardsData {
  moodboards: Moodboard[];
  moodboardImages: Record<string, MoodboardImage[]>;
  moodboardTexts: Record<string, MoodboardText[]>;
}

export function useMoodboardsStorage() {
  const [moodboards, setMoodboards] = useState<Moodboard[]>([]);
  const [moodboardImages, setMoodboardImages] = useState<Record<string, MoodboardImage[]>>({});
  const [moodboardTexts, setMoodboardTexts] = useState<Record<string, MoodboardText[]>>({});
  const loadedRef = useRef(false);

  // Load from Documents/Moodcrate/moodboards.json on mount,
  // migrating from localStorage if no file exists yet.
  useEffect(() => {
    invoke<string>("load_moodboards_data")
      .then((json) => {
        if (json) {
          try {
            const data: MoodboardsData = JSON.parse(json);
            setMoodboards(data.moodboards ?? []);
            setMoodboardImages(data.moodboardImages ?? {});
            setMoodboardTexts(data.moodboardTexts ?? {});
          } catch {
            migrateFromLocalStorage();
          }
        } else {
          migrateFromLocalStorage();
        }
      })
      .catch(() => {
        migrateFromLocalStorage();
      })
      .finally(() => {
        loadedRef.current = true;
      });
  }, []);

  function migrateFromLocalStorage() {
    try {
      const storedMoodboards = localStorage.getItem("moodboards");
      const storedImages = localStorage.getItem("moodboardImages");
      const storedTexts = localStorage.getItem("moodboardTexts");
      if (storedMoodboards) setMoodboards(JSON.parse(storedMoodboards));
      if (storedImages) setMoodboardImages(JSON.parse(storedImages));
      if (storedTexts) setMoodboardTexts(JSON.parse(storedTexts));
    } catch {
      // ignore parse errors
    }
  }

  // Persist to file whenever state changes (after initial load).
  useEffect(() => {
    if (!loadedRef.current) return;
    const data: MoodboardsData = { moodboards, moodboardImages, moodboardTexts };
    invoke("save_moodboards_data", { data: JSON.stringify(data) }).catch(console.error);
  }, [moodboards, moodboardImages, moodboardTexts]);

  return { moodboards, setMoodboards, moodboardImages, setMoodboardImages, moodboardTexts, setMoodboardTexts };
}
