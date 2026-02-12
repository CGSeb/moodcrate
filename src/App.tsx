import { useState } from "react";
import Sidebar, { Collection } from "./components/Sidebar/Sidebar";
import CollectionView from "./components/CollectionView/CollectionView";
import { useLocalStorage } from "./hooks/useLocalStorage";
import "./App.css";

function App() {
  const [collections, setCollections] = useLocalStorage<Collection[]>("collections", []);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);

  function handleDeleteCollection() {
    if (!selectedCollection) return;
    setCollections((prev) => prev.filter((c) => c.path !== selectedCollection.path));
    setSelectedCollection(null);
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
          <CollectionView
            collection={selectedCollection}
            onDelete={handleDeleteCollection}
          />
        ) : (
          <h1>Moodcrate</h1>
        )}
      </main>
    </div>
  );
}

export default App;
