import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Tag } from "../App";

interface TagsData {
  tags: Tag[];
  imageTags: Record<string, string[]>;
}

export function useTagsStorage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [imageTags, setImageTags] = useState<Record<string, string[]>>({});
  const loadedRef = useRef(false);

  // Load tags from Documents/Moodcrate/tags.json on mount,
  // migrating from localStorage if no file exists yet.
  useEffect(() => {
    invoke<string>("load_tags_data")
      .then((json) => {
        if (json) {
          try {
            const data: TagsData = JSON.parse(json);
            setTags(data.tags ?? []);
            setImageTags(data.imageTags ?? {});
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
      const storedTags = localStorage.getItem("tags");
      const storedImageTags = localStorage.getItem("imageTags");
      if (storedTags) setTags(JSON.parse(storedTags));
      if (storedImageTags) setImageTags(JSON.parse(storedImageTags));
    } catch {
      // ignore parse errors
    }
  }

  // Persist to file whenever tags or imageTags change (after initial load).
  useEffect(() => {
    if (!loadedRef.current) return;
    const data: TagsData = { tags, imageTags };
    invoke("save_tags_data", { data: JSON.stringify(data) }).catch(console.error);
  }, [tags, imageTags]);

  return { tags, setTags, imageTags, setImageTags };
}
