import { useState, useEffect, useRef, useCallback } from "react";
import { Trash2, X } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import type { Moodboard, MoodboardImage } from "../../App";
import ConfirmDialog from "../ConfirmDialog/ConfirmDialog";
import "./MoodboardView.css";

interface MoodboardViewProps {
  moodboard: Moodboard;
  images: MoodboardImage[];
  onDelete: () => void;
  onRemoveImage: (imageId: string) => void;
  onUpdateImage: (imageId: string, updates: Partial<Pick<MoodboardImage, "x" | "y" | "width">>) => void;
}

interface LoadedImage {
  id: string;
  dataUrl: string;
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const ZOOM_SPEED = 0.001;

export default function MoodboardView({
  moodboard,
  images,
  onDelete,
  onRemoveImage,
  onUpdateImage,
}: MoodboardViewProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [loadedImages, setLoadedImages] = useState<LoadedImage[]>([]);
  const [dragging, setDragging] = useState<{ id: string; startX: number; startY: number; imgStartX: number; imgStartY: number } | null>(null);
  const [resizing, setResizing] = useState<{ id: string; startX: number; startWidth: number } | null>(null);
  const [panning, setPanning] = useState<{ startX: number; startY: number; panStartX: number; panStartY: number } | null>(null);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [zoom, setZoom] = useState(1);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const results: LoadedImage[] = [];
      for (const img of images) {
        const already = loadedImages.find((l) => l.id === img.id);
        if (already) {
          results.push(already);
          continue;
        }
        try {
          const dataUrl = await invoke<string>("read_image", { path: img.path });
          if (cancelled) return;
          results.push({ id: img.id, dataUrl });
        } catch {
          // skip images that fail to load
        }
      }
      if (!cancelled) setLoadedImages(results);
    }
    load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images]);

  function handleConfirmDelete() {
    setShowDeleteConfirm(false);
    onDelete();
  }

  // --- Image dragging (left click on an image) ---
  function handleImageMouseDown(e: React.MouseEvent, imgId: string) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const img = images.find((i) => i.id === imgId);
    if (!img) return;
    setDragging({
      id: imgId,
      startX: e.clientX,
      startY: e.clientY,
      imgStartX: img.x,
      imgStartY: img.y,
    });
  }

  function handleResizeMouseDown(e: React.MouseEvent, imgId: string) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const img = images.find((i) => i.id === imgId);
    if (!img) return;
    setResizing({ id: imgId, startX: e.clientX, startWidth: img.width });
  }

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (dragging) {
      const dx = (e.clientX - dragging.startX) / zoom;
      const dy = (e.clientY - dragging.startY) / zoom;
      onUpdateImage(dragging.id, {
        x: dragging.imgStartX + dx,
        y: dragging.imgStartY + dy,
      });
    }
    if (resizing) {
      const dx = (e.clientX - resizing.startX) / zoom;
      const newWidth = Math.max(50, resizing.startWidth + dx);
      onUpdateImage(resizing.id, { width: newWidth });
    }
    if (panning) {
      setPanX(panning.panStartX + (e.clientX - panning.startX));
      setPanY(panning.panStartY + (e.clientY - panning.startY));
    }
  }, [dragging, resizing, panning, zoom, onUpdateImage]);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (dragging && e.button === 0) setDragging(null);
    if (resizing && e.button === 0) setResizing(null);
    if (panning && e.button === 1) setPanning(null);
  }, [dragging, resizing, panning]);

  useEffect(() => {
    if (!dragging && !resizing && !panning) return;
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging, resizing, panning, handleMouseMove, handleMouseUp]);

  // --- Canvas panning (middle mouse button) ---
  function handleCanvasMouseDown(e: React.MouseEvent) {
    if (e.button !== 1) return;
    e.preventDefault();
    setPanning({
      startX: e.clientX,
      startY: e.clientY,
      panStartX: panX,
      panStartY: panY,
    });
  }

  // --- Zoom (scroll wheel, toward cursor) ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function handleWheel(e: WheelEvent) {
      e.preventDefault();
      const rect = canvas!.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      const delta = -e.deltaY * ZOOM_SPEED;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * (1 + delta)));
      const scale = newZoom / zoom;

      setPanX((prev) => cursorX - scale * (cursorX - prev));
      setPanY((prev) => cursorY - scale * (cursorY - prev));
      setZoom(newZoom);
    }

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, [zoom]);

  // Dot grid background style
  const dotSpacing = 24 * zoom;
  const bgStyle = {
    backgroundImage: `radial-gradient(circle, #444 ${Math.max(0.8, zoom * 0.8)}px, transparent ${Math.max(0.8, zoom * 0.8)}px)`,
    backgroundSize: `${dotSpacing}px ${dotSpacing}px`,
    backgroundPosition: `${panX}px ${panY}px`,
  };

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

      <div
        className={`moodboard-view__canvas ${panning ? "moodboard-view__canvas--panning" : ""}`}
        ref={canvasRef}
        style={bgStyle}
        onMouseDown={handleCanvasMouseDown}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div
          className="moodboard-view__layer"
          style={{
            transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
          }}
        >
          {images.length === 0 && (
            <p className="moodboard-view__empty">
              This moodboard is empty. Add images from a collection to get started.
            </p>
          )}
          {images.map((img) => {
            const loaded = loadedImages.find((l) => l.id === img.id);
            return (
              <div
                key={img.id}
                className={`moodboard-view__item ${dragging?.id === img.id ? "moodboard-view__item--dragging" : ""}`}
                style={{
                  left: img.x,
                  top: img.y,
                  width: img.width,
                }}
                onMouseDown={(e) => handleImageMouseDown(e, img.id)}
              >
                {loaded ? (
                  <img src={loaded.dataUrl} alt="" className="moodboard-view__item-img" draggable={false} />
                ) : (
                  <div className="moodboard-view__item-placeholder" />
                )}
                <button
                  className="moodboard-view__item-remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveImage(img.id);
                  }}
                  aria-label="Remove from moodboard"
                >
                  <X size={14} />
                </button>
                <div
                  className="moodboard-view__item-resize"
                  onMouseDown={(e) => handleResizeMouseDown(e, img.id)}
                />
              </div>
            );
          })}
        </div>
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
