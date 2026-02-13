import { useState } from "react";
import { Plus, X, GripVertical, PanelRightOpen, Tags, Search } from "lucide-react";
import type { Tag } from "../../App";
import NameDialog from "../NameDialog/NameDialog";
import ConfirmDialog from "../ConfirmDialog/ConfirmDialog";
import "./TagSidebar.css";

interface TagSidebarProps {
  tags: Tag[];
  filterTagIds: Set<string>;
  onToggleFilter: (tagId: string) => void;
  onAddTag: (name: string) => void;
  onDeleteTag: (tagId: string) => void;
}

export default function TagSidebar({
  tags,
  filterTagIds,
  onToggleFilter,
  onAddTag,
  onDeleteTag,
}: TagSidebarProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [pendingDeleteTag, setPendingDeleteTag] = useState<Tag | null>(null);
  const sorted = [...tags].sort((a, b) => a.name.localeCompare(b.name));

  function handleDragStart(e: React.DragEvent, tagId: string) {
    e.dataTransfer.setData("application/tag-id", tagId);
    e.dataTransfer.effectAllowed = "copy";
  }

  function handleConfirmDelete() {
    if (pendingDeleteTag) {
      onDeleteTag(pendingDeleteTag.id);
      setPendingDeleteTag(null);
    }
  }

  return (
    <>
      <aside className={`tag-sidebar ${collapsed ? "tag-sidebar--collapsed" : ""}`}>
        <div className="tag-sidebar__header">
          {collapsed ? (
            <button
              className="tag-sidebar__toggle-btn"
              onClick={() => setCollapsed(false)}
              aria-label="Expand tags"
            >
              <Tags size={18} />
            </button>
          ) : (
            <>
              <span className="tag-sidebar__title">
                <Tags size={16} />
                Tags
              </span>
              <div className="tag-sidebar__header-actions">
                <button
                  className="tag-sidebar__add-btn"
                  onClick={() => setShowCreateDialog(true)}
                  aria-label="Create tag"
                >
                  <Plus size={15} />
                </button>
                <button
                  className="tag-sidebar__toggle-btn"
                  onClick={() => setCollapsed(true)}
                  aria-label="Collapse tags"
                >
                  <PanelRightOpen size={16} />
                </button>
              </div>
            </>
          )}
        </div>

        {!collapsed && (
          <>
            {sorted.length === 0 ? (
              <div className="tag-sidebar__empty">No tags yet</div>
            ) : (
              <ul className="tag-sidebar__list">
                {sorted.map((tag) => {
                  const isFiltering = filterTagIds.has(tag.id);
                  return (
                    <li
                      key={tag.id}
                      className={`tag-sidebar__item ${isFiltering ? "tag-sidebar__item--filtering" : ""}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, tag.id)}
                    >
                      <GripVertical size={12} className="tag-sidebar__grip" />
                      <span className="tag-sidebar__tag-name">{tag.name}</span>
                      <button
                        className={`tag-sidebar__filter-btn ${isFiltering ? "tag-sidebar__filter-btn--active" : ""}`}
                        onClick={() => onToggleFilter(tag.id)}
                        aria-label={`Filter by ${tag.name}`}
                      >
                        <Search size={12} />
                      </button>
                      <button
                        className="tag-sidebar__delete-btn"
                        onClick={() => setPendingDeleteTag(tag)}
                        aria-label={`Delete tag ${tag.name}`}
                      >
                        <X size={12} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </aside>

      <NameDialog
        open={showCreateDialog}
        title="New Tag"
        placeholder="Tag name..."
        onConfirm={(name) => {
          onAddTag(name);
          setShowCreateDialog(false);
        }}
        onCancel={() => setShowCreateDialog(false)}
      />

      <ConfirmDialog
        open={pendingDeleteTag !== null}
        title="Delete Tag"
        message={pendingDeleteTag ? `Delete "${pendingDeleteTag.name}"? It will be removed from all images.` : ""}
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDeleteTag(null)}
      />
    </>
  );
}
