import { useState, useEffect, useRef } from "react";
import { Trash2, ImagePlus } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import type { Collection } from "../Sidebar/Sidebar";
import type { Tag, Moodboard } from "../../App";
import ConfirmDialog from "../ConfirmDialog/ConfirmDialog";
import ImageViewer from "../ImageViewer/ImageViewer";
import TagSidebar from "../TagSidebar/TagSidebar";
import "./CollectionView.css";

interface ImageEntry {
  path: string;
  dataUrl: string | null;
}

interface CollectionViewProps {
  collection: Collection;
  onDelete: () => void;
  tags: Tag[];
  imageTags: Record<string, string[]>;
  onAddTag: (name: string) => void;
  onDeleteTag: (tagId: string) => void;
  onAddTagToImage: (imagePath: string, tagId: string) => void;
  onRemoveTagFromImage: (imagePath: string, tagId: string) => void;
  moodboards: Moodboard[];
  onAddImageToMoodboard: (moodboardId: string, imagePath: string) => void;
}

export default function CollectionView({
  collection,
  onDelete,
  tags,
  imageTags,
  onAddTag,
  onDeleteTag,
  onAddTagToImage,
  onRemoveTagFromImage,
  moodboards,
  onAddImageToMoodboard,
}: CollectionViewProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [viewerPath, setViewerPath] = useState<string | null>(null);
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);
  const [filterTagIds, setFilterTagIds] = useState<Set<string>>(new Set());
  const [moodboardPickerPath, setMoodboardPickerPath] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadImages() {
      try {
        const paths = await invoke<string[]>("list_images", { path: collection.path });
        if (cancelled) return;

        const entries: ImageEntry[] = paths.map((p) => ({ path: p, dataUrl: null }));
        setImages(entries);

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

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setMoodboardPickerPath(null);
      }
    }
    if (moodboardPickerPath) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [moodboardPickerPath]);

  useEffect(() => {
    const validIds = new Set(tags.map((t) => t.id));
    setFilterTagIds((prev) => {
      const next = new Set(Array.from(prev).filter((id) => validIds.has(id)));
      if (next.size === prev.size) return prev;
      return next;
    });
  }, [tags]);

  async function handleOpenViewer(path: string) {
    setViewerPath(path);
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

  function handleDragOver(e: React.DragEvent, path: string) {
    if (e.dataTransfer.types.includes("application/tag-id")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      setDragOverPath(path);
    }
  }

  function handleDragLeave(e: React.DragEvent, path: string) {
    const related = e.relatedTarget as Node | null;
    const current = e.currentTarget as Node;
    if (related && current.contains(related)) return;
    if (dragOverPath === path) setDragOverPath(null);
  }

  function handleDrop(e: React.DragEvent, imagePath: string) {
    e.preventDefault();
    setDragOverPath(null);
    const tagId = e.dataTransfer.getData("application/tag-id");
    if (tagId) onAddTagToImage(imagePath, tagId);
  }

  function handleToggleFilter(tagId: string) {
    setFilterTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  }

  function getImageTags(path: string): Tag[] {
    const ids = imageTags[path] || [];
    return tags.filter((t) => ids.includes(t.id));
  }

  const filteredImages = filterTagIds.size === 0
    ? images
    : images.filter((img) => {
        const ids = imageTags[img.path] || [];
        return Array.from(filterTagIds).some((fid) => ids.includes(fid));
      });

  return (
    <div className="collection-view">
      <div className="collection-view__header">
        <h1>{collection.name} <span className="collection-view__count">({filteredImages.length})</span></h1>
        <button
          className="collection-view__delete-btn"
          onClick={() => setShowDeleteConfirm(true)}
          aria-label="Delete collection"
        >
          <Trash2 size={18} />
        </button>
      </div>

      <div className="collection-view__body">
        <div className="collection-view__grid-area">
          <div className="collection-view__grid">
            {filteredImages.map((img) => {
              const imgTags = getImageTags(img.path);
              const isDragOver = dragOverPath === img.path;
              return (
                <button
                  key={img.path}
                  className={`collection-view__tile ${isDragOver ? "collection-view__tile--drag-over" : ""}`}
                  onClick={() => handleOpenViewer(img.path)}
                  onDragOver={(e) => handleDragOver(e, img.path)}
                  onDragLeave={(e) => handleDragLeave(e, img.path)}
                  onDrop={(e) => handleDrop(e, img.path)}
                >
                  {img.dataUrl ? (
                    <img src={img.dataUrl} alt="" className="collection-view__img" />
                  ) : (
                    <div className="collection-view__placeholder" />
                  )}
                  {moodboards.length > 0 && (
                    <div className="collection-view__add-to-mb">
                      <span
                        className="collection-view__add-to-mb-btn"
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          setMoodboardPickerPath(moodboardPickerPath === img.path ? null : img.path);
                        }}
                        title="Add to moodboard"
                      >
                        <ImagePlus size={16} />
                      </span>
                      {moodboardPickerPath === img.path && (
                        <div className="collection-view__mb-picker" ref={pickerRef}>
                          {moodboards.map((mb) => (
                            <button
                              key={mb.id}
                              className="collection-view__mb-picker-item"
                              onClick={(e) => {
                                e.stopPropagation();
                                onAddImageToMoodboard(mb.id, img.path);
                                setMoodboardPickerPath(null);
                              }}
                            >
                              {mb.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {imgTags.length > 0 && (
                    <div className="collection-view__tags">
                      {imgTags.slice(0, 3).map((tag) => (
                        <span
                          key={tag.id}
                          className="collection-view__tag-badge"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveTagFromImage(img.path, tag.id);
                          }}
                          title={`Remove "${tag.name}"`}
                        >
                          {tag.name}
                        </span>
                      ))}
                      {imgTags.length > 3 && (
                        <span className="collection-view__tag-badge collection-view__tag-badge--more">
                          +{imgTags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <TagSidebar
          tags={tags}
          filterTagIds={filterTagIds}
          onToggleFilter={handleToggleFilter}
          onAddTag={onAddTag}
          onDeleteTag={onDeleteTag}
        />
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
