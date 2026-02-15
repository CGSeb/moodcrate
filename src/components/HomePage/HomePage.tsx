import { useState } from "react";
import { FolderOpen, Layout, Plus, ArrowRight } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import type { Collection } from "../Sidebar/Sidebar";
import type { Moodboard } from "../../App";
import NameDialog from "../NameDialog/NameDialog";
import "./HomePage.css";

interface HomePageProps {
  collections: Collection[];
  moodboards: Moodboard[];
  favorites: string[];
  onAddCollection: (collection: Collection) => void;
  onAddMoodboard: (name: string) => void;
  onSelectCollection: (collection: Collection) => void;
  onSelectMoodboard: (moodboard: Moodboard) => void;
}

export default function HomePage({
  collections,
  moodboards,
  favorites,
  onAddCollection,
  onAddMoodboard,
  onSelectCollection,
  onSelectMoodboard,
}: HomePageProps) {
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [showMoodboardDialog, setShowMoodboardDialog] = useState(false);

  const favoriteCollections = collections.filter((c) => favorites.includes(c.path));
  const favoriteMoodboards = moodboards.filter((m) => favorites.includes(m.id));
  const hasFavorites = favoriteCollections.length > 0 || favoriteMoodboards.length > 0;

  async function handleCreateCollection() {
    const selected = await open({ directory: true, multiple: false });
    if (!selected) return;
    setPendingPath(selected);
  }

  function handleConfirmName(name: string) {
    if (!pendingPath) return;
    onAddCollection({ name, path: pendingPath });
    setPendingPath(null);
  }

  return (
    <>
      <div className="home">
        <h1 className="home__title">Moodcrate</h1>

        {hasFavorites && (
          <div className="home__section">
            <h2 className="home__section-title">Favorites</h2>
            <div className="home__cards">
              {favoriteCollections.map((col) => (
                <button
                  key={col.path}
                  className="home__card home__card--nav"
                  onClick={() => onSelectCollection(col)}
                >
                  <div className="home__card-icon">
                    <FolderOpen size={24} />
                  </div>
                  <span className="home__card-label">{col.name}</span>
                  <span className="home__card-hint">Collection</span>
                  <ArrowRight size={16} className="home__card-arrow" />
                </button>
              ))}
              {favoriteMoodboards.map((mb) => (
                <button
                  key={mb.id}
                  className="home__card home__card--nav"
                  onClick={() => onSelectMoodboard(mb)}
                >
                  <div className="home__card-icon">
                    <Layout size={24} />
                  </div>
                  <span className="home__card-label">{mb.name}</span>
                  <span className="home__card-hint">Moodboard</span>
                  <ArrowRight size={16} className="home__card-arrow" />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="home__section">
          <div className="home__cards">
            <button className="home__card home__card--action" onClick={handleCreateCollection}>
              <div className="home__card-icon">
                <Plus size={24} />
              </div>
              <span className="home__card-label">Create a collection</span>
              <span className="home__card-hint">Select a folder of images</span>
            </button>

            <button
              className="home__card home__card--action"
              onClick={() => setShowMoodboardDialog(true)}
            >
              <div className="home__card-icon">
                <Plus size={24} />
              </div>
              <span className="home__card-label">Create a moodboard</span>
              <span className="home__card-hint">Arrange images on a canvas</span>
            </button>
          </div>
        </div>
      </div>

      <NameDialog
        open={pendingPath !== null}
        title="New Collection"
        placeholder="Collection name…"
        onConfirm={handleConfirmName}
        onCancel={() => setPendingPath(null)}
      />

      <NameDialog
        open={showMoodboardDialog}
        title="New Moodboard"
        placeholder="Moodboard name…"
        onConfirm={(name) => {
          setShowMoodboardDialog(false);
          onAddMoodboard(name);
        }}
        onCancel={() => setShowMoodboardDialog(false)}
      />
    </>
  );
}
