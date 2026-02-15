import { useState, useRef } from "react";
import { Plus, X, GripVertical, PanelRightOpen, Tags, Search, ChevronRight } from "lucide-react";
import type { Tag } from "../../App";
import { flattenTagTree, buildChildrenMap, wouldCreateCycle } from "../../utils/tagTree";
import NameDialog from "../NameDialog/NameDialog";
import ConfirmDialog from "../ConfirmDialog/ConfirmDialog";
import Tooltip from "../Tooltip/Tooltip";
import "./TagSidebar.css";

interface TagSidebarProps {
  tags: Tag[];
  filterTagIds: Set<string>;
  onToggleFilter: (tagId: string) => void;
  onAddTag: (name: string, parentId?: string | null) => boolean;
  onDeleteTag: (tagId: string) => void;
  onSetTagParent: (tagId: string, newParentId: string | null) => void;
}

export default function TagSidebar({
  tags,
  filterTagIds,
  onToggleFilter,
  onAddTag,
  onDeleteTag,
  onSetTagParent,
}: TagSidebarProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [pendingDeleteTag, setPendingDeleteTag] = useState<Tag | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [dragOverTagId, setDragOverTagId] = useState<string | null>(null);
  const dragTagIdRef = useRef<string | null>(null);

  const flatTree = flattenTagTree(tags);
  const childrenMap = buildChildrenMap(tags);

  // Filter visible items — parents are expanded by default, hidden only if collapsed
  const visibleItems = flatTree.filter(({ tag, depth }) => {
    if (depth === 0) return true;
    let current = tag.parentId;
    while (current) {
      if (collapsedIds.has(current)) return false;
      const parent = tags.find((t) => t.id === current);
      current = parent?.parentId ?? null;
    }
    return true;
  });

  function toggleExpand(tagId: string) {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  }

  function handleDragStart(e: React.DragEvent, tagId: string) {
    e.dataTransfer.setData("application/tag-id", tagId);
    e.dataTransfer.effectAllowed = "copyMove";
    dragTagIdRef.current = tagId;
  }

  function handleDragEnd() {
    dragTagIdRef.current = null;
    setDragOverTagId(null);
  }

  function handleTagDragOver(e: React.DragEvent, targetTagId: string) {
    if (!e.dataTransfer.types.includes("application/tag-id")) return;
    // Only accept as nest target if dragging a different tag
    if (dragTagIdRef.current && dragTagIdRef.current !== targetTagId) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOverTagId(targetTagId);
    }
  }

  function handleTagDragLeave(e: React.DragEvent, targetTagId: string) {
    const related = e.relatedTarget as Node | null;
    const current = e.currentTarget as Node;
    if (related && current.contains(related)) return;
    if (dragOverTagId === targetTagId) setDragOverTagId(null);
  }

  function handleTagDrop(e: React.DragEvent, targetTagId: string) {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTagId(null);
    const draggedTagId = e.dataTransfer.getData("application/tag-id");
    if (draggedTagId && draggedTagId !== targetTagId) {
      if (!wouldCreateCycle(draggedTagId, targetTagId, tags)) {
        onSetTagParent(draggedTagId, targetTagId);
        setCollapsedIds((prev) => {
          if (!prev.has(targetTagId)) return prev;
          const next = new Set(prev);
          next.delete(targetTagId);
          return next;
        });
      }
    }
  }

  function handleRootDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOverTagId(null);
    const draggedTagId = e.dataTransfer.getData("application/tag-id");
    if (draggedTagId) {
      onSetTagParent(draggedTagId, null);
    }
  }

  function handleRootDragOver(e: React.DragEvent) {
    if (e.dataTransfer.types.includes("application/tag-id")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOverTagId("__root__");
    }
  }

  function handleConfirmDelete() {
    if (pendingDeleteTag) {
      onDeleteTag(pendingDeleteTag.id);
      setPendingDeleteTag(null);
    }
  }

  function openCreateDialog(parentId: string | null) {
    setCreateParentId(parentId);
    setShowCreateDialog(true);
  }

  const pendingHasChildren = pendingDeleteTag
    ? tags.some((t) => t.parentId === pendingDeleteTag.id)
    : false;

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
                  onClick={() => openCreateDialog(null)}
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
            {visibleItems.length === 0 ? (
              <div className="tag-sidebar__empty">No tags yet</div>
            ) : (
              <ul className="tag-sidebar__list">
                <li
                  className={`tag-sidebar__root-drop ${dragOverTagId === "__root__" ? "tag-sidebar__root-drop--active" : ""}`}
                  onDragOver={handleRootDragOver}
                  onDrop={handleRootDrop}
                  onDragLeave={() => { if (dragOverTagId === "__root__") setDragOverTagId(null); }}
                >
                </li>
                {visibleItems.map(({ tag, depth }) => {
                  const isFiltering = filterTagIds.has(tag.id);
                  const hasChildTags = childrenMap.has(tag.id);
                  const isExpanded = !collapsedIds.has(tag.id);
                  const isDragTarget = dragOverTagId === tag.id;
                  return (
                    <li
                      key={tag.id}
                      className={`tag-sidebar__item ${isFiltering ? "tag-sidebar__item--filtering" : ""} ${isDragTarget ? "tag-sidebar__item--drag-target" : ""}`}
                      style={{ paddingLeft: `${14 + depth * 16}px` }}
                      draggable
                      onDragStart={(e) => handleDragStart(e, tag.id)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => handleTagDragOver(e, tag.id)}
                      onDragLeave={(e) => handleTagDragLeave(e, tag.id)}
                      onDrop={(e) => handleTagDrop(e, tag.id)}
                    >
                      {hasChildTags ? (
                        <button
                          className="tag-sidebar__expand-btn"
                          onClick={() => toggleExpand(tag.id)}
                          aria-label={isExpanded ? "Collapse" : "Expand"}
                        >
                          <ChevronRight
                            size={12}
                            className={`tag-sidebar__chevron ${isExpanded ? "tag-sidebar__chevron--open" : ""}`}
                          />
                        </button>
                      ) : (
                        <span className="tag-sidebar__expand-spacer" />
                      )}
                      <GripVertical size={12} className="tag-sidebar__grip" />
                      <span className="tag-sidebar__tag-name">{tag.name}</span>
                      <Tooltip text="Add sub-tag">
                        <button
                          className="tag-sidebar__child-btn"
                          onClick={() => openCreateDialog(tag.id)}
                          aria-label={`Add sub-tag to ${tag.name}`}
                        >
                          <Plus size={10} />
                        </button>
                      </Tooltip>
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
        title={createParentId ? `New sub-tag of "${tags.find((t) => t.id === createParentId)?.name}"` : "New Tag"}
        placeholder="Tag name..."
        validate={(name) => {
          const nameLower = name.toLowerCase();
          const duplicate = tags.some(
            (t) => t.name.toLowerCase() === nameLower && (t.parentId ?? null) === createParentId
          );
          return duplicate ? "A tag with this name already exists" : null;
        }}
        onConfirm={(name) => {
          onAddTag(name, createParentId);
          setShowCreateDialog(false);
          if (createParentId) {
            setCollapsedIds((prev) => {
              if (!prev.has(createParentId)) return prev;
              const next = new Set(prev);
              next.delete(createParentId);
              return next;
            });
          }
          setCreateParentId(null);
        }}
        onCancel={() => {
          setShowCreateDialog(false);
          setCreateParentId(null);
        }}
      />

      <ConfirmDialog
        open={pendingDeleteTag !== null}
        title="Delete Tag"
        message={
          pendingDeleteTag
            ? pendingHasChildren
              ? `Delete "${pendingDeleteTag.name}"? Its sub-tags will be moved up one level. The tag will be removed from all images.`
              : `Delete "${pendingDeleteTag.name}"? It will be removed from all images.`
            : ""
        }
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDeleteTag(null)}
      />
    </>
  );
}
