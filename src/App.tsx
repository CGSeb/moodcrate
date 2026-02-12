import { useState } from "react";
import { Trash2 } from "lucide-react";
import Sidebar, { Collection } from "./components/Sidebar/Sidebar";
import ConfirmDialog from "./components/ConfirmDialog/ConfirmDialog";
import { useLocalStorage } from "./hooks/useLocalStorage";
import "./App.css";

function App() {
  const [collections, setCollections] = useLocalStorage<Collection[]>("collections", []);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  function handleDeleteCollection() {
    if (!selectedCollection) return;
    setCollections((prev) => prev.filter((c) => c.path !== selectedCollection.path));
    setSelectedCollection(null);
    setShowDeleteConfirm(false);
  }

  return (
    <div className="app-layout">
      <Sidebar
        collections={collections}
        onAddCollection={(col) => setCollections((prev) => [...prev, col])}
        selectedCollection={selectedCollection}
        onSelectCollection={setSelectedCollection}
      />
      <main className="main-content">
        {selectedCollection ? (
          <>
            <div className="main-content__header">
              <h1>{selectedCollection.name}</h1>
              <button
                className="main-content__delete-btn"
                onClick={() => setShowDeleteConfirm(true)}
                aria-label="Delete collection"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </>
        ) : (
          <h1>Moodcrate</h1>
        )}
      </main>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Collection"
        message={`Are you sure you want to delete "${selectedCollection?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDeleteCollection}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}

export default App;
