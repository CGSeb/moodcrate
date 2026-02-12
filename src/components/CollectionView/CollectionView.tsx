import { Trash2 } from "lucide-react";
import type { Collection } from "../Sidebar/Sidebar";
import "./CollectionView.css";

interface CollectionViewProps {
  collection: Collection;
  onDelete: () => void;
}

export default function CollectionView({ collection, onDelete }: CollectionViewProps) {
  return (
    <div className="collection-view">
      <div className="collection-view__header">
        <h1>{collection.name}</h1>
        <button
          className="collection-view__delete-btn"
          onClick={onDelete}
          aria-label="Delete collection"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
}
