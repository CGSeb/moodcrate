import { useState } from "react";
import Titlebar from "./components/Titlebar/Titlebar";
import Sidebar, { Collection } from "./components/Sidebar/Sidebar";
import CollectionView from "./components/CollectionView/CollectionView";
import MoodboardView from "./components/MoodboardView/MoodboardView";
import { useLocalStorage } from "./hooks/useLocalStorage";
import "./App.css";

export interface Tag {
  id: string;
  name: string;
}

export interface Moodboard {
  id: string;
  name: string;
}

export interface MoodboardImage {
  id: string;
  path: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

function App() {
  const [collections, setCollections] = useLocalStorage<Collection[]>("collections", []);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [moodboards, setMoodboards] = useLocalStorage<Moodboard[]>("moodboards", []);
  const [selectedMoodboard, setSelectedMoodboard] = useState<Moodboard | null>(null);
  const [moodboardImages, setMoodboardImages] = useLocalStorage<Record<string, MoodboardImage[]>>("moodboardImages", {});
  const [tags, setTags] = useLocalStorage<Tag[]>("tags", []);
  const [imageTags, setImageTags] = useLocalStorage<Record<string, string[]>>("imageTags", {});

  function handleDeleteCollection() {
    if (!selectedCollection) return;
    setCollections((prev) => prev.filter((c) => c.path !== selectedCollection.path));
    setSelectedCollection(null);
  }

  function handleAddMoodboard(name: string) {
    const mb: Moodboard = { id: crypto.randomUUID(), name };
    setMoodboards((prev) => [...prev, mb]);
    setSelectedMoodboard(mb);
    setSelectedCollection(null);
  }

  function handleDeleteMoodboard() {
    if (!selectedMoodboard) return;
    setMoodboards((prev) => prev.filter((m) => m.id !== selectedMoodboard.id));
    setMoodboardImages((prev) => {
      const next = { ...prev };
      delete next[selectedMoodboard.id];
      return next;
    });
    setSelectedMoodboard(null);
  }

  function handleAddImageToMoodboard(moodboardId: string, imagePath: string) {
    setMoodboardImages((prev) => {
      const current = prev[moodboardId] || [];
      if (current.some((img) => img.path === imagePath)) return prev;
      const entry: MoodboardImage = {
        id: crypto.randomUUID(),
        path: imagePath,
        x: 300,
        y: 200,
        width: 200,
        height: 200,
      };
      return { ...prev, [moodboardId]: [...current, entry] };
    });
    const mb = moodboards.find((m) => m.id === moodboardId);
    if (mb) {
      setSelectedMoodboard(mb);
      setSelectedCollection(null);
    }
  }

  function handleRemoveImageFromMoodboard(moodboardId: string, imageId: string) {
    setMoodboardImages((prev) => {
      const current = prev[moodboardId] || [];
      const filtered = current.filter((img) => img.id !== imageId);
      if (filtered.length === current.length) return prev;
      const next = { ...prev };
      if (filtered.length > 0) next[moodboardId] = filtered;
      else delete next[moodboardId];
      return next;
    });
  }

  function handleUpdateMoodboardImage(moodboardId: string, imageId: string, updates: Partial<Pick<MoodboardImage, "x" | "y" | "width">>) {
    setMoodboardImages((prev) => {
      const current = prev[moodboardId];
      if (!current) return prev;
      return {
        ...prev,
        [moodboardId]: current.map((img) =>
          img.id === imageId ? { ...img, ...updates } : img
        ),
      };
    });
  }

  function handleAddTag(name: string) {
    const id = crypto.randomUUID();
    setTags((prev) => [...prev, { id, name }]);
  }

  function handleDeleteTag(tagId: string) {
    setTags((prev) => prev.filter((t) => t.id !== tagId));
    setImageTags((prev) => {
      const next: Record<string, string[]> = {};
      for (const [path, ids] of Object.entries(prev)) {
        const filtered = ids.filter((id) => id !== tagId);
        if (filtered.length > 0) next[path] = filtered;
      }
      return next;
    });
  }

  function handleAddTagToImage(imagePath: string, tagId: string) {
    setImageTags((prev) => {
      const current = prev[imagePath] || [];
      if (current.includes(tagId)) return prev;
      return { ...prev, [imagePath]: [...current, tagId] };
    });
  }

  function handleRemoveTagFromImage(imagePath: string, tagId: string) {
    setImageTags((prev) => {
      const current = prev[imagePath] || [];
      const filtered = current.filter((id) => id !== tagId);
      if (filtered.length === current.length) return prev;
      const next = { ...prev };
      if (filtered.length > 0) next[imagePath] = filtered;
      else delete next[imagePath];
      return next;
    });
  }

  return (
    <div className="app-container">
      <Titlebar />
      <div className="app-layout">
        <Sidebar
          collections={collections}
          onAddCollection={(col) => {
            setCollections((prev) => [...prev, col]);
            setSelectedCollection(col);
            setSelectedMoodboard(null);
          }}
          selectedCollection={selectedCollection}
          onSelectCollection={(col) => {
            setSelectedCollection(col);
            setSelectedMoodboard(null);
          }}
          moodboards={moodboards}
          onAddMoodboard={handleAddMoodboard}
          selectedMoodboard={selectedMoodboard}
          onSelectMoodboard={(mb) => {
            setSelectedMoodboard(mb);
            setSelectedCollection(null);
          }}
          onHome={() => {
            setSelectedCollection(null);
            setSelectedMoodboard(null);
          }}
        />
        <main className="main-content">
          {selectedCollection ? (
            <CollectionView
              collection={selectedCollection}
              onDelete={handleDeleteCollection}
              tags={tags}
              imageTags={imageTags}
              onAddTag={handleAddTag}
              onDeleteTag={handleDeleteTag}
              onAddTagToImage={handleAddTagToImage}
              onRemoveTagFromImage={handleRemoveTagFromImage}
              moodboards={moodboards}
              onAddImageToMoodboard={handleAddImageToMoodboard}
            />
          ) : selectedMoodboard ? (
            <MoodboardView
              moodboard={selectedMoodboard}
              images={moodboardImages[selectedMoodboard.id] || []}
              onDelete={handleDeleteMoodboard}
              onRemoveImage={(imageId: string) => handleRemoveImageFromMoodboard(selectedMoodboard.id, imageId)}
              onUpdateImage={(imageId: string, updates: Partial<Pick<MoodboardImage, "x" | "y" | "width">>) => handleUpdateMoodboardImage(selectedMoodboard.id, imageId, updates)}
            />
          ) : (
            <h1>Moodcrate</h1>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
