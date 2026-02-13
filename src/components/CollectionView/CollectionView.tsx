import { useState, useEffect } from "react";
import { Trash2 } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import type { Collection } from "../Sidebar/Sidebar";
import ConfirmDialog from "../ConfirmDialog/ConfirmDialog";
import ImageViewer from "../ImageViewer/ImageViewer";
import "./CollectionView.css";

interface ImageEntry {
  path: string;
  dataUrl: string | null;
}

interface CollectionViewProps {
  collection: Collection;
  onDelete: () => void;
}

export default function CollectionView({ collection, onDelete }: CollectionViewProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [viewerPath, setViewerPath] = useState<string | null>(null);
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadImages() {
      try {
        const paths = await invoke<string[]>("list_images", { path: collection.path });
        if (cancelled) return;

        const entries: ImageEntry[] = paths.map((p) => ({ path: p, dataUrl: null }));
        setImages(entries);

        // Load each image in parallel
        const results = await Promise.all(
          paths.map((p) => invoke<string>("read_image", { path: p }).catch(() => null))
        );
        if (cancelled) return;

        setImages(paths.map((p, i) => ({ path: p, dataUrl: results[i] })));
      } catch {
        setImages([]);
      }
    }

    loadImages();
    return () => { cancelled = true; };
  }, [collection.path]);

  async function handleOpenViewer(path: string) {
    setViewerPath(path);
    // Check if we already have it cached
    const cached = images.find((img) => img.path === path);
    if (cached?.dataUrl) {
      setViewerSrc(cached.dataUrl);
      return;
    }
    try {
      const dataUrl = await invoke<string>("read_image", { path });
      setViewerSrc(dataUrl);
    } catch {
      setViewerSrc(null);
    }
  }

  function handleCloseViewer() {
    setViewerPath(null);
    setViewerSrc(null);
  }

  function handleConfirmDelete() {
    setShowDeleteConfirm(false);
    onDelete();
  }

  return (
    <div className="collection-view">
      <div className="collection-view__header">
        <h1>{collection.name}</h1>
        <button
          className="collection-view__delete-btn"
          onClick={() => setShowDeleteConfirm(true)}
          aria-label="Delete collection"
        >
          <Trash2 size={18} />
        </button>
      </div>

      <div className="collection-view__grid">
        {images.map((img) => (
          <button
            key={img.path}
            className="collection-view__tile"
            onClick={() => handleOpenViewer(img.path)}
          >
            {img.dataUrl ? (
              <img src={img.dataUrl} alt="" className="collection-view__img" />
            ) : (
              <div className="collection-view__placeholder" />
            )}
          </button>
        ))}
      </div>

      {viewerPath && viewerSrc && (
        <ImageViewer src={viewerSrc} onClose={handleCloseViewer} />
      )}

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Collection"
        message={`Are you sure you want to delete "${collection.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
