import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { Collection } from "../Sidebar/Sidebar";
import ConfirmDialog from "../ConfirmDialog/ConfirmDialog";
import "./CollectionView.css";

interface CollectionViewProps {
  collection: Collection;
  onDelete: () => void;
}

export default function CollectionView({ collection, onDelete }: CollectionViewProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
