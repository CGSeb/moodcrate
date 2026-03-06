import { useState, useRef } from "react";
import Titlebar from "./components/Titlebar/Titlebar";
import Sidebar, { Collection } from "./components/Sidebar/Sidebar";
import CollectionView from "./components/CollectionView/CollectionView";
import MoodboardView from "./components/MoodboardView/MoodboardView";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { useTagsStorage } from "./hooks/useTagsStorage";
import { useMoodboardsStorage } from "./hooks/useMoodboardsStorage";
import { wouldCreateCycle } from "./utils/tagTree";
import HomePage from "./components/HomePage/HomePage";
import "./App.css";

export interface Tag {
  id: string;
  name: string;
  parentId: string | null;
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

export interface MoodboardText {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
}

function App() {
  const [collections, setCollections] = useLocalStorage<Collection[]>("collections", []);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const { moodboards, setMoodboards, moodboardImages, setMoodboardImages, moodboardTexts, setMoodboardTexts } = useMoodboardsStorage();
  const [selectedMoodboard, setSelectedMoodboard] = useState<Moodboard | null>(null);
  const { tags, setTags, imageTags, setImageTags } = useTagsStorage();
  const [favorites, setFavorites] = useLocalStorage<string[]>("favorites", []);
  const [pendingMoodboardSelection, setPendingMoodboardSelection] = useState<string[]>([]);
  const [toast, setToast] = useState<{ message: string; variant: "success" | "warning" } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(message: string, variant: "success" | "warning" = "success") {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, variant });
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }

  function handleToggleFavorite(id: string) {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  }

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

  function handleCreateMoodboardWithImage(name: string, imagePath: string) {
    const mb: Moodboard = { id: crypto.randomUUID(), name };
    setMoodboards((prev) => [...prev, mb]);
    const entry: MoodboardImage = {
      id: crypto.randomUUID(),
      path: imagePath,
      x: 300,
      y: 200,
      width: 200,
      height: 200,
    };
    setMoodboardImages((prev) => ({ ...prev, [mb.id]: [entry] }));
    setSelectedMoodboard(mb);
    setSelectedCollection(null);
  }

  function handleAddImagesToMoodboard(moodboardId: string, imagePaths: string[]): { added: number; skipped: number } {
    const current = moodboardImages[moodboardId] || [];
    const existingPaths = new Set(current.map((img) => img.path));
    const newEntries: MoodboardImage[] = imagePaths
      .filter((p) => !existingPaths.has(p))
      .map((path, i) => ({
        id: crypto.randomUUID(),
        path,
        x: 300 + (i % 4) * 220,
        y: 200 + Math.floor(i / 4) * 220,
        width: 200,
        height: 200,
      }));
    setMoodboardImages((prev) => {
      const prevCurrent = prev[moodboardId] || [];
      const prevExisting = new Set(prevCurrent.map((img) => img.path));
      const filtered = newEntries.filter((e) => !prevExisting.has(e.path));
      return { ...prev, [moodboardId]: [...prevCurrent, ...filtered] };
    });
    setPendingMoodboardSelection(newEntries.map((e) => e.id));
    const mb = moodboards.find((m) => m.id === moodboardId);
    if (mb) {
      setSelectedMoodboard(mb);
      setSelectedCollection(null);
    }
    return { added: newEntries.length, skipped: imagePaths.length - newEntries.length };
  }

  function handleCreateMoodboardWithImages(name: string, imagePaths: string[]) {
    const mb: Moodboard = { id: crypto.randomUUID(), name };
    setMoodboards((prev) => [...prev, mb]);
    const entries: MoodboardImage[] = imagePaths.map((path, i) => ({
      id: crypto.randomUUID(),
      path,
      x: 300 + (i % 4) * 220,
      y: 200 + Math.floor(i / 4) * 220,
      width: 200,
      height: 200,
    }));
    setMoodboardImages((prev) => ({ ...prev, [mb.id]: entries }));
    setPendingMoodboardSelection(entries.map((e) => e.id));
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
    setMoodboardTexts((prev) => {
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

  function handleAddTextToMoodboard(moodboardId: string, id: string, x: number, y: number) {
    const entry: MoodboardText = { id, text: "", x, y, width: 200, height: 80, fontSize: 14 };
    setMoodboardTexts((prev) => ({
      ...prev,
      [moodboardId]: [...(prev[moodboardId] || []), entry],
    }));
  }

  function handleRemoveTextFromMoodboard(moodboardId: string, textId: string) {
    setMoodboardTexts((prev) => {
      const current = prev[moodboardId] || [];
      const filtered = current.filter((t) => t.id !== textId);
      if (filtered.length === current.length) return prev;
      const next = { ...prev };
      if (filtered.length > 0) next[moodboardId] = filtered;
      else delete next[moodboardId];
      return next;
    });
  }

  function handleUpdateMoodboardText(moodboardId: string, textId: string, updates: Partial<Pick<MoodboardText, "x" | "y" | "width" | "height" | "text" | "fontSize">>) {
    setMoodboardTexts((prev) => {
      const current = prev[moodboardId];
      if (!current) return prev;
      return {
        ...prev,
        [moodboardId]: current.map((t) => t.id === textId ? { ...t, ...updates } : t),
      };
    });
  }

  function handleAddTag(name: string, parentId?: string | null): boolean {
    const normalizedParent = parentId ?? null;
    const nameLower = name.trim().toLowerCase();
    const duplicate = tags.some(
      (t) => t.name.toLowerCase() === nameLower
    );
    if (duplicate) return false;
    const id = crypto.randomUUID();
    setTags((prev) => [...prev, { id, name, parentId: normalizedParent }]);
    return true;
  }

  function handleDeleteTag(tagId: string) {
    setTags((prev) => {
      const tag = prev.find((t) => t.id === tagId);
      const parentOfDeleted = tag?.parentId ?? null;
      return prev
        .filter((t) => t.id !== tagId)
        .map((t) => t.parentId === tagId ? { ...t, parentId: parentOfDeleted } : t);
    });
    setImageTags((prev) => {
      const next: Record<string, string[]> = {};
      for (const [path, ids] of Object.entries(prev)) {
        const filtered = ids.filter((id) => id !== tagId);
        if (filtered.length > 0) next[path] = filtered;
      }
      return next;
    });
  }

  function handleSetTagParent(tagId: string, newParentId: string | null) {
    setTags((prev) => {
      if (newParentId && wouldCreateCycle(tagId, newParentId, prev)) return prev;
      const tag = prev.find((t) => t.id === tagId);
      if (!tag || (tag.parentId ?? null) === newParentId) return prev;
      return prev.map((t) =>
        t.id === tagId ? { ...t, parentId: newParentId } : t
      );
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
          favorites={favorites}
          onToggleFavorite={handleToggleFavorite}
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
              onSetTagParent={handleSetTagParent}
              onAddTagToImage={handleAddTagToImage}
              onRemoveTagFromImage={handleRemoveTagFromImage}
              moodboards={moodboards}
              moodboardImages={moodboardImages}
              onAddImageToMoodboard={handleAddImageToMoodboard}
              onCreateMoodboardWithImage={handleCreateMoodboardWithImage}
              onAddImagesToMoodboard={handleAddImagesToMoodboard}
              onCreateMoodboardWithImages={handleCreateMoodboardWithImages}
              onShowToast={showToast}
            />
          ) : selectedMoodboard ? (
            <MoodboardView
              moodboard={selectedMoodboard}
              images={moodboardImages[selectedMoodboard.id] || []}
              texts={moodboardTexts[selectedMoodboard.id] || []}
              onDelete={handleDeleteMoodboard}
              onRemoveImage={(imageId: string) => handleRemoveImageFromMoodboard(selectedMoodboard.id, imageId)}
              onUpdateImage={(imageId: string, updates: Partial<Pick<MoodboardImage, "x" | "y" | "width">>) => handleUpdateMoodboardImage(selectedMoodboard.id, imageId, updates)}
              onAddText={(id: string, x: number, y: number) => handleAddTextToMoodboard(selectedMoodboard.id, id, x, y)}
              onRemoveText={(textId: string) => handleRemoveTextFromMoodboard(selectedMoodboard.id, textId)}
              onUpdateText={(textId: string, updates: Partial<Pick<MoodboardText, "x" | "y" | "width" | "height" | "text" | "fontSize">>) => handleUpdateMoodboardText(selectedMoodboard.id, textId, updates)}
              initialSelectedIds={pendingMoodboardSelection}
              onConsumeSelection={() => setPendingMoodboardSelection([])}
            />
          ) : (
            <HomePage
              collections={collections}
              moodboards={moodboards}
              favorites={favorites}
              onAddCollection={(col) => {
                setCollections((prev) => [...prev, col]);
                setSelectedCollection(col);
                setSelectedMoodboard(null);
              }}
              onAddMoodboard={handleAddMoodboard}
              onSelectCollection={(col) => {
                setSelectedCollection(col);
                setSelectedMoodboard(null);
              }}
              onSelectMoodboard={(mb) => {
                setSelectedMoodboard(mb);
                setSelectedCollection(null);
              }}
            />
          )}
        </main>
      </div>
      {toast && <div className={`app-toast app-toast--${toast.variant}`}>{toast.message}</div>}
    </div>
  );
}

export default App;
