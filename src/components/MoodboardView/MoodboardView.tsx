import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { Moodboard } from "../../App";
import ConfirmDialog from "../ConfirmDialog/ConfirmDialog";
import "./MoodboardView.css";

interface MoodboardViewProps {
  moodboard: Moodboard;
  onDelete: () => void;
}

export default function MoodboardView({ moodboard, onDelete }: MoodboardViewProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  function handleConfirmDelete() {
    setShowDeleteConfirm(false);
    onDelete();
  }

  return (
    <div className="moodboard-view">
      <div className="moodboard-view__header">
        <h1>{moodboard.name}</h1>
        <button
          className="moodboard-view__delete-btn"
          onClick={() => setShowDeleteConfirm(true)}
          aria-label="Delete moodboard"
        >
          <Trash2 size={18} />
        </button>
      </div>

      <div className="moodboard-view__canvas">
        <p className="moodboard-view__empty">
          This moodboard is empty. Drag images here to get started.
        </p>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Moodboard"
        message={`Are you sure you want to delete "${moodboard.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
