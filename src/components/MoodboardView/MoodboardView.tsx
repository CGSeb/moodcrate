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

interface DragState {
  startX: number;
  startY: number;
  items: { id: string; imgStartX: number; imgStartY: number }[];
}

interface MarqueeState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const ZOOM_SPEED = 0.001;

function rectsIntersect(
  a: { left: number; top: number; right: number; bottom: number },
  b: { left: number; top: number; right: number; bottom: number },
) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

export default function MoodboardView({
  moodboard,
  images,
  onDelete,
  onRemoveImage,
  onUpdateImage,
}: MoodboardViewProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [loadedImages, setLoadedImages] = useState<LoadedImage[]>([]);
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [resizing, setResizing] = useState<{ id: string; startX: number; startWidth: number } | null>(null);
  const [panning, setPanning] = useState<{ startX: number; startY: number; panStartX: number; panStartY: number } | null>(null);
  const [marquee, setMarquee] = useState<MarqueeState | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [zoom, setZoom] = useState(1);
  const canvasRef = useRef<HTMLDivElement>(null);
  const panXRef = useRef(panX);
  const panYRef = useRef(panY);
  const zoomRef = useRef(zoom);
  panXRef.current = panX;
  panYRef.current = panY;
  zoomRef.current = zoom;

  function clientToCanvas(clientX: number, clientY: number) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: (clientX - rect.left - panXRef.current) / zoomRef.current,
      y: (clientY - rect.top - panYRef.current) / zoomRef.current,
    };
  }

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

  // Clear selection when images change (e.g. image removed)
  useEffect(() => {
    setSelectedIds((prev) => {
      const imageIdSet = new Set(images.map((i) => i.id));
      const filtered = new Set([...prev].filter((id) => imageIdSet.has(id)));
      return filtered.size === prev.size ? prev : filtered;
    });
  }, [images]);

  // Escape key clears selection
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setSelectedIds(new Set());
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function handleConfirmDelete() {
    setShowDeleteConfirm(false);
    onDelete();
  }

  // --- Image dragging (left click on an image) ---
  function handleImageMouseDown(e: React.MouseEvent, imgId: string) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const isSelected = selectedIds.has(imgId);

    if (e.shiftKey) {
      // Shift+click: toggle selection
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(imgId)) next.delete(imgId);
        else next.add(imgId);
        return next;
      });
      return;
    }

    if (isSelected) {
      // Drag all selected images
      const items = images
        .filter((i) => selectedIds.has(i.id))
        .map((i) => ({ id: i.id, imgStartX: i.x, imgStartY: i.y }));
      setDragging({ startX: e.clientX, startY: e.clientY, items });
    } else {
      // Click on unselected image: select only this one and start dragging it
      setSelectedIds(new Set([imgId]));
      const img = images.find((i) => i.id === imgId);
      if (!img) return;
      setDragging({
        startX: e.clientX,
        startY: e.clientY,
        items: [{ id: imgId, imgStartX: img.x, imgStartY: img.y }],
      });
    }
  }

  function handleResizeMouseDown(e: React.MouseEvent, imgId: string) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const img = images.find((i) => i.id === imgId);
    if (!img) return;
    setResizing({ id: imgId, startX: e.clientX, startWidth: img.width });
  }

  // --- Canvas mouse down: middle = pan, left = marquee ---
  function handleCanvasMouseDown(e: React.MouseEvent) {
    if (e.button === 1) {
      e.preventDefault();
      setPanning({
        startX: e.clientX,
        startY: e.clientY,
        panStartX: panX,
        panStartY: panY,
      });
    } else if (e.button === 0) {
      // Left-click on empty canvas area: start marquee
      const pos = clientToCanvas(e.clientX, e.clientY);
      setMarquee({ startX: pos.x, startY: pos.y, currentX: pos.x, currentY: pos.y });
    }
  }

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (dragging) {
      const dx = (e.clientX - dragging.startX) / zoomRef.current;
      const dy = (e.clientY - dragging.startY) / zoomRef.current;
      for (const item of dragging.items) {
        onUpdateImage(item.id, {
          x: item.imgStartX + dx,
          y: item.imgStartY + dy,
        });
      }
    }
    if (resizing) {
      const dx = (e.clientX - resizing.startX) / zoomRef.current;
      const newWidth = Math.max(50, resizing.startWidth + dx);
      onUpdateImage(resizing.id, { width: newWidth });
    }
    if (panning) {
      setPanX(panning.panStartX + (e.clientX - panning.startX));
      setPanY(panning.panStartY + (e.clientY - panning.startY));
    }
    if (marquee) {
      const pos = clientToCanvas(e.clientX, e.clientY);
      setMarquee((prev) => prev ? { ...prev, currentX: pos.x, currentY: pos.y } : null);
    }
  }, [dragging, resizing, panning, marquee, onUpdateImage]);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (dragging && e.button === 0) setDragging(null);
    if (resizing && e.button === 0) setResizing(null);
    if (panning && e.button === 1) setPanning(null);
    if (marquee && e.button === 0) {
      // Compute selection from marquee
      const left = Math.min(marquee.startX, marquee.currentX);
      const top = Math.min(marquee.startY, marquee.currentY);
      const right = Math.max(marquee.startX, marquee.currentX);
      const bottom = Math.max(marquee.startY, marquee.currentY);
      const marqueeWidth = right - left;
      const marqueeHeight = bottom - top;

      if (marqueeWidth > 3 || marqueeHeight > 3) {
        // Real marquee drag: select intersecting images
        const marqueeRect = { left, top, right, bottom };
        const newSelected = new Set<string>();
        for (const img of images) {
          const imgRect = {
            left: img.x,
            top: img.y,
            right: img.x + img.width,
            bottom: img.y + img.width, // approximate height as width for square-ish check
          };
          // Use loaded image to get actual rendered height if possible
          const loaded = loadedImages.find((l) => l.id === img.id);
          if (loaded) {
            const el = document.querySelector(`[data-img-id="${img.id}"] img`) as HTMLImageElement | null;
            if (el && el.naturalHeight && el.naturalWidth) {
              imgRect.bottom = img.y + (img.width * el.naturalHeight) / el.naturalWidth;
            }
          }
          if (rectsIntersect(marqueeRect, imgRect)) {
            newSelected.add(img.id);
          }
        }
        setSelectedIds(newSelected);
      } else {
        // Tiny drag = click on empty space: clear selection
        setSelectedIds(new Set());
      }
      setMarquee(null);
    }
  }, [dragging, resizing, panning, marquee, images, loadedImages]);

  useEffect(() => {
    if (!dragging && !resizing && !panning && !marquee) return;
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging, resizing, panning, marquee, handleMouseMove, handleMouseUp]);

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

  // Marquee rect for rendering
  const marqueeStyle = marquee ? {
    left: Math.min(marquee.startX, marquee.currentX),
    top: Math.min(marquee.startY, marquee.currentY),
    width: Math.abs(marquee.currentX - marquee.startX),
    height: Math.abs(marquee.currentY - marquee.startY),
  } : null;

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
            const isSelected = selectedIds.has(img.id);
            const isDragging = dragging?.items.some((d) => d.id === img.id) ?? false;
            return (
              <div
                key={img.id}
                data-img-id={img.id}
                className={`moodboard-view__item ${isDragging ? "moodboard-view__item--dragging" : ""} ${isSelected ? "moodboard-view__item--selected" : ""}`}
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
          {marqueeStyle && (
            <div
              className="moodboard-view__marquee"
              style={marqueeStyle}
            />
          )}
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
