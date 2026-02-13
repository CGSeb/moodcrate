import { useState } from "react";
import Titlebar from "./components/Titlebar/Titlebar";
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
    <div className="app-container">
      <Titlebar />
      <div className="app-layout">
        <Sidebar
          collections={collections}
          onAddCollection={(col) => {
            setCollections((prev) => [...prev, col]);
            setSelectedCollection(col);
          }}
          selectedCollection={selectedCollection}
          onSelectCollection={setSelectedCollection}
          onHome={() => setSelectedCollection(null)}
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
    </div>
  );
}

export default App;
