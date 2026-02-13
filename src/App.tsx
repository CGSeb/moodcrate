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

function App() {
  const [collections, setCollections] = useLocalStorage<Collection[]>("collections", []);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [moodboards, setMoodboards] = useLocalStorage<Moodboard[]>("moodboards", []);
  const [selectedMoodboard, setSelectedMoodboard] = useState<Moodboard | null>(null);
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
    setSelectedMoodboard(null);
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
            />
          ) : selectedMoodboard ? (
            <MoodboardView
              moodboard={selectedMoodboard}
              onDelete={handleDeleteMoodboard}
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
