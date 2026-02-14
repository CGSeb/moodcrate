import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Trash2, ImagePlus, Import, ClipboardPaste } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { readImage } from "@tauri-apps/plugin-clipboard-manager";
import type { Collection } from "../Sidebar/Sidebar";
import type { Tag, Moodboard } from "../../App";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import ConfirmDialog from "../ConfirmDialog/ConfirmDialog";
import ImportDialog from "../ImportDialog/ImportDialog";
import type { ImportMode } from "../ImportDialog/ImportDialog";
import ImageViewer from "../ImageViewer/ImageViewer";
import TagSidebar from "../TagSidebar/TagSidebar";
import Tooltip from "../Tooltip/Tooltip";
import { getDescendantIds } from "../../utils/tagTree";
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
  onAddTag: (name: string, parentId?: string | null) => void;
  onDeleteTag: (tagId: string) => void;
  onSetTagParent: (tagId: string, newParentId: string | null) => void;
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
  onSetTagParent,
  onAddTagToImage,
  onRemoveTagFromImage,
  moodboards,
  onAddImageToMoodboard,
}: CollectionViewProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteImagePath, setDeleteImagePath] = useState<string | null>(null);
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [viewerPath, setViewerPath] = useState<string | null>(null);
  const [viewerSrc, setViewerSrc] = useState<string | null>(null);
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);
  const [filterTagIds, setFilterTagIds] = useState<Set<string>>(new Set());
  const [moodboardPickerPath, setMoodboardPickerPath] = useState<string | null>(null);
  const [importDialogFiles, setImportDialogFiles] = useState<string[] | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [rememberedImportMode, setRememberedImportMode] = useLocalStorage<ImportMode | null>("importMode", null);
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
  }, [collection.path, refreshKey]);

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

  async function doImport(files: string[], mode: ImportMode) {
    try {
      await invoke<string[]>("import_files", {
        sources: files,
        targetDir: collection.path,
        mode,
      });
      setRefreshKey((k) => k + 1);
    } catch (err) {
      console.error("Import failed:", err);
    }
  }

  async function handleImportFromDisk() {
    const selected = await open({
      multiple: true,
      filters: [{
        name: "Images",
        extensions: ["png", "jpg", "jpeg", "gif", "bmp", "webp", "svg", "tiff", "tif", "avif"],
      }],
    });

    if (!selected || selected.length === 0) return;

    if (rememberedImportMode) {
      await doImport(selected, rememberedImportMode);
    } else {
      setImportDialogFiles(selected);
    }
  }

  function handleImportDialogConfirm(mode: ImportMode, remember: boolean) {
    if (remember) {
      setRememberedImportMode(mode);
    }
    if (importDialogFiles) {
      doImport(importDialogFiles, mode);
    }
    setImportDialogFiles(null);
  }

  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const clipImage = await readImage();
      const rgba = await clipImage.rgba();
      const { width, height } = await clipImage.size();

      await invoke<string>("save_clipboard_image", {
        rgbaData: Array.from(rgba),
        width,
        height,
        targetDir: collection.path,
      });

      setRefreshKey((k) => k + 1);
    } catch (err) {
      console.error("Clipboard paste failed:", err);
    }
  }, [collection.path]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey && e.key === "v") {
        e.preventDefault();
        handlePasteFromClipboard();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlePasteFromClipboard]);

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

  async function handleConfirmDeleteImage() {
    if (!deleteImagePath) return;
    try {
      await invoke("delete_image", { path: deleteImagePath });
      setDeleteImagePath(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      console.error("Delete image failed:", err);
      setDeleteImagePath(null);
    }
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

  const expandedFilterIds = useMemo(() => {
    if (filterTagIds.size === 0) return new Set<string>();
    const expanded = new Set<string>();
    for (const fid of filterTagIds) {
      for (const did of getDescendantIds(fid, tags)) expanded.add(did);
    }
    return expanded;
  }, [filterTagIds, tags]);

  const filteredImages = expandedFilterIds.size === 0
    ? images
    : images.filter((img) => {
        const ids = imageTags[img.path] || [];
        return ids.some((id) => expandedFilterIds.has(id));
      });

  return (
    <div className="collection-view">
      <div className="collection-view__header">
        <h1>{collection.name} <span className="collection-view__count">({filteredImages.length})</span></h1>
        <div className="collection-view__toolbar">
          <Tooltip text="Import images">
            <button
              className="collection-view__toolbar-btn"
              onClick={handleImportFromDisk}
              aria-label="Import images from disk"
            >
              <Import size={18} />
            </button>
          </Tooltip>
          <Tooltip text="Paste from clipboard (Ctrl+V)">
            <button
              className="collection-view__toolbar-btn"
              onClick={handlePasteFromClipboard}
              aria-label="Paste image from clipboard"
            >
              <ClipboardPaste size={18} />
            </button>
          </Tooltip>
          <button
            className="collection-view__delete-btn"
            onClick={() => setShowDeleteConfirm(true)}
            aria-label="Delete collection"
          >
            <Trash2 size={18} />
          </button>
        </div>
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
                  <div className="collection-view__tile-actions">
                    {moodboards.length > 0 && (
                      <Tooltip text="Add to moodboard">
                        <span
                          className="collection-view__tile-action-btn"
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            setMoodboardPickerPath(moodboardPickerPath === img.path ? null : img.path);
                          }}
                        >
                          <ImagePlus size={16} />
                        </span>
                      </Tooltip>
                    )}
                    <Tooltip text="Delete image">
                      <span
                        className="collection-view__tile-action-btn collection-view__tile-action-btn--danger"
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteImagePath(img.path);
                        }}
                      >
                        <Trash2 size={16} />
                      </span>
                    </Tooltip>
                  </div>
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
                  {imgTags.length > 0 && (
                    <div className="collection-view__tags">
                      {imgTags.slice(0, 3).map((tag) => (
                        <Tooltip key={tag.id} text={`Remove "${tag.name}"`}>
                          <span
                            className="collection-view__tag-badge"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveTagFromImage(img.path, tag.id);
                            }}
                          >
                            {tag.name}
                          </span>
                        </Tooltip>
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
          onSetTagParent={onSetTagParent}
        />
      </div>

      {viewerPath && viewerSrc && (
        <ImageViewer src={viewerSrc} onClose={handleCloseViewer} />
      )}

      <ImportDialog
        open={importDialogFiles !== null}
        fileCount={importDialogFiles?.length ?? 0}
        onConfirm={handleImportDialogConfirm}
        onCancel={() => setImportDialogFiles(null)}
      />

      <ConfirmDialog
        open={deleteImagePath !== null}
        title="Delete Image"
        message="Are you sure you want to delete this image from disk? This cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleConfirmDeleteImage}
        onCancel={() => setDeleteImagePath(null)}
      />

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
