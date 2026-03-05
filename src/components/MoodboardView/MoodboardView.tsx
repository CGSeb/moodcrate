import { useState, useEffect, useRef, useCallback } from "react";
import { Trash2, X, Type, Heading1, Heading2, List } from "lucide-react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { marked } from "marked";
import type { Moodboard, MoodboardImage, MoodboardText } from "../../App";
import ConfirmDialog from "../ConfirmDialog/ConfirmDialog";
import "./MoodboardView.css";

interface MoodboardViewProps {
  moodboard: Moodboard;
  images: MoodboardImage[];
  texts: MoodboardText[];
  onDelete: () => void;
  onRemoveImage: (imageId: string) => void;
  onUpdateImage: (imageId: string, updates: Partial<Pick<MoodboardImage, "x" | "y" | "width">>) => void;
  onAddText: (id: string, x: number, y: number) => void;
  onRemoveText: (textId: string) => void;
  onUpdateText: (textId: string, updates: Partial<Pick<MoodboardText, "x" | "y" | "width" | "height" | "text" | "fontSize">>) => void;
  initialSelectedIds?: string[];
  onConsumeSelection?: () => void;
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
  texts,
  onDelete,
  onRemoveImage,
  onUpdateImage,
  onAddText,
  onRemoveText,
  onUpdateText,
  initialSelectedIds,
  onConsumeSelection,
}: MoodboardViewProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [loadedImages, setLoadedImages] = useState<LoadedImage[]>([]);
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [resizing, setResizing] = useState<{ id: string; startX: number; startY: number; startWidth: number; startHeight: number } | null>(null);
  const [panning, setPanning] = useState<{ startX: number; startY: number; panStartX: number; panStartY: number } | null>(null);
  const [marquee, setMarquee] = useState<MarqueeState | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(initialSelectedIds ?? []));
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [activePrefixes, setActivePrefixes] = useState<Set<string>>(new Set());
  const canvasRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const panXRef = useRef(panX);
  const panYRef = useRef(panY);
  const zoomRef = useRef(zoom);
  const textsRef = useRef(texts);
  const onUpdateImageRef = useRef(onUpdateImage);
  const onUpdateTextRef = useRef(onUpdateText);
  panXRef.current = panX;
  panYRef.current = panY;
  zoomRef.current = zoom;
  textsRef.current = texts;
  onUpdateImageRef.current = onUpdateImage;
  onUpdateTextRef.current = onUpdateText;

  function clientToCanvas(clientX: number, clientY: number) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: (clientX - rect.left - panXRef.current) / zoomRef.current,
      y: (clientY - rect.top - panYRef.current) / zoomRef.current,
    };
  }

  useEffect(() => {
    onConsumeSelection?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLoadedImages(
      images.map((img) => ({ id: img.id, dataUrl: convertFileSrc(img.path) }))
    );
  }, [images]);

  // Zoom-to-fit when opening a moodboard
  const hasFittedRef = useRef<string | null>(null);
  useEffect(() => {
    const hasContent = images.length > 0 || texts.length > 0;
    if (!hasContent) return;
    if (images.length > 0 && loadedImages.length === 0) return;
    if (hasFittedRef.current === moodboard.id) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    requestAnimationFrame(() => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const img of images) {
        const left = img.x;
        const top = img.y;
        const right = img.x + img.width;
        const el = canvas.querySelector(`[data-img-id="${img.id}"] img`) as HTMLImageElement | null;
        let imgHeight = img.width;
        if (el && el.naturalHeight && el.naturalWidth) {
          imgHeight = (img.width * el.naturalHeight) / el.naturalWidth;
        }
        const bottom = top + imgHeight;
        if (left < minX) minX = left;
        if (top < minY) minY = top;
        if (right > maxX) maxX = right;
        if (bottom > maxY) maxY = bottom;
      }
      for (const txt of texts) {
        if (txt.x < minX) minX = txt.x;
        if (txt.y < minY) minY = txt.y;
        if (txt.x + txt.width > maxX) maxX = txt.x + txt.width;
        if (txt.y + txt.height > maxY) maxY = txt.y + txt.height;
      }

      const contentW = maxX - minX;
      const contentH = maxY - minY;
      if (contentW <= 0 || contentH <= 0) return;

      const padding = 40;
      const availW = rect.width - padding * 2;
      const availH = rect.height - padding * 2;
      const fitZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(availW / contentW, availH / contentH)));

      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const newPanX = rect.width / 2 - centerX * fitZoom;
      const newPanY = rect.height / 2 - centerY * fitZoom;

      setPanX(newPanX);
      setPanY(newPanY);
      setZoom(fitZoom);
      hasFittedRef.current = moodboard.id;
    });
  }, [moodboard.id, images, texts, loadedImages]);

  // Clear selection when items change
  useEffect(() => {
    setSelectedIds((prev) => {
      const allIds = new Set([...images.map((i) => i.id), ...texts.map((t) => t.id)]);
      const filtered = new Set([...prev].filter((id) => allIds.has(id)));
      return filtered.size === prev.size ? prev : filtered;
    });
  }, [images, texts]);

  // Escape: exit editing (and remove if empty) or clear selection
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (editingTextId) {
          const editingText = textsRef.current.find((t) => t.id === editingTextId);
          setEditingTextId(null);
          if (editingText && !editingText.text.trim()) {
            onRemoveText(editingTextId);
          }
        } else {
          setSelectedIds(new Set());
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editingTextId, onRemoveText]);

  // Reset active prefixes when exiting edit mode
  useEffect(() => {
    if (!editingTextId) setActivePrefixes(new Set());
  }, [editingTextId]);

  function updateActivePrefixes(textarea: HTMLTextAreaElement) {
    const text = textarea.value;
    const pos = textarea.selectionStart;
    const lineStart = text.lastIndexOf("\n", pos - 1) + 1;
    const lineEndIdx = text.indexOf("\n", pos);
    const line = text.slice(lineStart, lineEndIdx === -1 ? text.length : lineEndIdx);
    const next = new Set<string>();
    if (line.startsWith("# ")) next.add("# ");
    if (line.startsWith("## ")) next.add("## ");
    if (line.startsWith("- ")) next.add("- ");
    setActivePrefixes(next);
  }

  function handleConfirmDelete() {
    setShowDeleteConfirm(false);
    onDelete();
  }

  // Unified mousedown for both images and text items
  function handleItemMouseDown(e: React.MouseEvent, itemId: string) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    if (editingTextId === itemId) return;

    const isSelected = selectedIds.has(itemId);

    if (e.shiftKey) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(itemId)) next.delete(itemId);
        else next.add(itemId);
        return next;
      });
      return;
    }

    if (isSelected) {
      const imageItems = images
        .filter((i) => selectedIds.has(i.id))
        .map((i) => ({ id: i.id, imgStartX: i.x, imgStartY: i.y }));
      const textItems = texts
        .filter((t) => selectedIds.has(t.id))
        .map((t) => ({ id: t.id, imgStartX: t.x, imgStartY: t.y }));
      setDragging({ startX: e.clientX, startY: e.clientY, items: [...imageItems, ...textItems] });
    } else {
      setSelectedIds(new Set([itemId]));
      const item = images.find((i) => i.id === itemId) ?? texts.find((t) => t.id === itemId);
      if (!item) return;
      setDragging({
        startX: e.clientX,
        startY: e.clientY,
        items: [{ id: itemId, imgStartX: item.x, imgStartY: item.y }],
      });
    }
  }

  function handleResizeMouseDown(e: React.MouseEvent, id: string) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const item = images.find((i) => i.id === id) ?? texts.find((t) => t.id === id);
    if (!item) return;
    setResizing({ id, startX: e.clientX, startY: e.clientY, startWidth: item.width, startHeight: item.height });
  }

  function handleTextDoubleClick(e: React.MouseEvent, textId: string) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(null);
    setEditingTextId(textId);
  }

  function handleAddText() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const centerX = (rect.width / 2 - panX) / zoom;
    const centerY = (rect.height / 2 - panY) / zoom;
    const newId = crypto.randomUUID();
    onAddText(newId, centerX - 100, centerY - 40);
    setEditingTextId(newId);
  }

  function toggleLinePrefix(textId: string, prefix: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const currentText = textarea.value;
    const selStart = textarea.selectionStart;
    const selEnd = textarea.selectionEnd;
    const lineStart = currentText.lastIndexOf("\n", selStart - 1) + 1;
    const lineEndIdx = currentText.indexOf("\n", selStart);
    const lineEnd = lineEndIdx === -1 ? currentText.length : lineEndIdx;
    const currentLine = currentText.slice(lineStart, lineEnd);
    let newText: string;
    let offsetDelta: number;
    if (currentLine.startsWith(prefix)) {
      newText = currentText.slice(0, lineStart) + currentLine.slice(prefix.length) + currentText.slice(lineEnd);
      offsetDelta = -prefix.length;
    } else {
      newText = currentText.slice(0, lineStart) + prefix + currentLine + currentText.slice(lineEnd);
      offsetDelta = prefix.length;
    }
    onUpdateText(textId, { text: newText });
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.setSelectionRange(
          Math.max(lineStart, selStart + offsetDelta),
          Math.max(lineStart, selEnd + offsetDelta),
        );
      }
    });
  }

  function handleCanvasMouseDown(e: React.MouseEvent) {
    if (e.button === 1) {
      e.preventDefault();
      setPanning({ startX: e.clientX, startY: e.clientY, panStartX: panX, panStartY: panY });
    } else if (e.button === 0) {
      const pos = clientToCanvas(e.clientX, e.clientY);
      setMarquee({ startX: pos.x, startY: pos.y, currentX: pos.x, currentY: pos.y });
    }
  }

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (dragging) {
      const dx = (e.clientX - dragging.startX) / zoomRef.current;
      const dy = (e.clientY - dragging.startY) / zoomRef.current;
      for (const item of dragging.items) {
        if (textsRef.current.some((t) => t.id === item.id)) {
          onUpdateTextRef.current(item.id, { x: item.imgStartX + dx, y: item.imgStartY + dy });
        } else {
          onUpdateImageRef.current(item.id, { x: item.imgStartX + dx, y: item.imgStartY + dy });
        }
      }
    }
    if (resizing) {
      const dx = (e.clientX - resizing.startX) / zoomRef.current;
      const newWidth = Math.max(50, resizing.startWidth + dx);
      if (textsRef.current.some((t) => t.id === resizing.id)) {
        const dy = (e.clientY - resizing.startY) / zoomRef.current;
        const newHeight = Math.max(30, resizing.startHeight + dy);
        onUpdateTextRef.current(resizing.id, { width: newWidth, height: newHeight });
      } else {
        onUpdateImageRef.current(resizing.id, { width: newWidth });
      }
    }
    if (panning) {
      setPanX(panning.panStartX + (e.clientX - panning.startX));
      setPanY(panning.panStartY + (e.clientY - panning.startY));
    }
    if (marquee) {
      const pos = clientToCanvas(e.clientX, e.clientY);
      setMarquee((prev) => prev ? { ...prev, currentX: pos.x, currentY: pos.y } : null);
    }
  }, [dragging, resizing, panning, marquee]);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (dragging && e.button === 0) setDragging(null);
    if (resizing && e.button === 0) setResizing(null);
    if (panning && e.button === 1) setPanning(null);
    if (marquee && e.button === 0) {
      const left = Math.min(marquee.startX, marquee.currentX);
      const top = Math.min(marquee.startY, marquee.currentY);
      const right = Math.max(marquee.startX, marquee.currentX);
      const bottom = Math.max(marquee.startY, marquee.currentY);
      const marqueeWidth = right - left;
      const marqueeHeight = bottom - top;

      if (marqueeWidth > 3 || marqueeHeight > 3) {
        const marqueeRect = { left, top, right, bottom };
        const newSelected = new Set<string>();
        for (const img of images) {
          const imgRect = {
            left: img.x,
            top: img.y,
            right: img.x + img.width,
            bottom: img.y + img.width,
          };
          const el = document.querySelector(`[data-img-id="${img.id}"] img`) as HTMLImageElement | null;
          if (el && el.naturalHeight && el.naturalWidth) {
            imgRect.bottom = img.y + (img.width * el.naturalHeight) / el.naturalWidth;
          }
          if (rectsIntersect(marqueeRect, imgRect)) {
            newSelected.add(img.id);
          }
        }
        for (const txt of textsRef.current) {
          if (rectsIntersect(marqueeRect, { left: txt.x, top: txt.y, right: txt.x + txt.width, bottom: txt.y + txt.height })) {
            newSelected.add(txt.id);
          }
        }
        setSelectedIds(newSelected);
      } else {
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

  // Zoom (scroll wheel, toward cursor)
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

  const dotSpacing = 24 * zoom;
  const bgStyle = {
    backgroundImage: `radial-gradient(circle, #444 ${Math.max(0.8, zoom * 0.8)}px, transparent ${Math.max(0.8, zoom * 0.8)}px)`,
    backgroundSize: `${dotSpacing}px ${dotSpacing}px`,
    backgroundPosition: `${panX}px ${panY}px`,
  };

  const marqueeStyle = marquee ? {
    left: Math.min(marquee.startX, marquee.currentX),
    top: Math.min(marquee.startY, marquee.currentY),
    width: Math.abs(marquee.currentX - marquee.startX),
    height: Math.abs(marquee.currentY - marquee.startY),
  } : null;

  const hasContent = images.length > 0 || texts.length > 0;

  return (
    <div className="moodboard-view">
      <div className="moodboard-view__header">
        <h1>{moodboard.name}</h1>
        <div className="moodboard-view__header-actions">
          <button
            className="moodboard-view__add-text-btn"
            onClick={handleAddText}
          >
            <Type size={15} />
            <span>Add Text</span>
          </button>
          <button
            className="moodboard-view__delete-btn"
            onClick={() => setShowDeleteConfirm(true)}
            aria-label="Delete moodboard"
          >
            <Trash2 size={18} />
          </button>
        </div>
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
          style={{ transform: `translate(${panX}px, ${panY}px) scale(${zoom})` }}
        >
          {!hasContent && (
            <p className="moodboard-view__empty">
              This moodboard is empty. Add images from a collection or click "Add Text" to get started.
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
                style={{ left: img.x, top: img.y, width: img.width }}
                onMouseDown={(e) => handleItemMouseDown(e, img.id)}
              >
                {loaded ? (
                  <img src={loaded.dataUrl} alt="" className="moodboard-view__item-img" draggable={false} />
                ) : (
                  <div className="moodboard-view__item-placeholder" />
                )}
                <button
                  className="moodboard-view__item-remove"
                  onClick={(e) => { e.stopPropagation(); onRemoveImage(img.id); }}
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
          {texts.map((txt) => {
            const isSelected = selectedIds.has(txt.id);
            const isDragging = dragging?.items.some((d) => d.id === txt.id) ?? false;
            const isEditing = editingTextId === txt.id;
            const fontSize = txt.fontSize ?? 14;
            return (
              <div key={txt.id}>
                {isEditing && (
                  <div
                    className="moodboard-view__text-font-controls"
                    style={{ left: txt.x, top: txt.y - 46 }}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <button
                      className="moodboard-view__text-font-btn"
                      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onClick={(e) => { e.stopPropagation(); onUpdateText(txt.id, { fontSize: Math.max(8, fontSize - 2) }); }}
                    >−</button>
                    <span className="moodboard-view__text-font-size">{fontSize}px</span>
                    <button
                      className="moodboard-view__text-font-btn"
                      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onClick={(e) => { e.stopPropagation(); onUpdateText(txt.id, { fontSize: Math.min(96, fontSize + 2) }); }}
                    >+</button>
                    <div className="moodboard-view__text-toolbar-sep" />
                    <button
                      className={`moodboard-view__text-font-btn ${activePrefixes.has("# ") ? "moodboard-view__text-font-btn--active" : ""}`}
                      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onClick={(e) => { e.stopPropagation(); toggleLinePrefix(txt.id, "# "); }}
                      title="Heading 1"
                    ><Heading1 size={14} /></button>
                    <button
                      className={`moodboard-view__text-font-btn ${activePrefixes.has("## ") ? "moodboard-view__text-font-btn--active" : ""}`}
                      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onClick={(e) => { e.stopPropagation(); toggleLinePrefix(txt.id, "## "); }}
                      title="Heading 2"
                    ><Heading2 size={14} /></button>
                    <button
                      className={`moodboard-view__text-font-btn ${activePrefixes.has("- ") ? "moodboard-view__text-font-btn--active" : ""}`}
                      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onClick={(e) => { e.stopPropagation(); toggleLinePrefix(txt.id, "- "); }}
                      title="Bullet list"
                    ><List size={14} /></button>
                  </div>
                )}
                <div
                  className={`moodboard-view__text-item ${isDragging ? "moodboard-view__item--dragging" : ""} ${isSelected ? "moodboard-view__item--selected" : ""} ${isEditing ? "moodboard-view__text-item--editing" : ""}`}
                  style={{ left: txt.x, top: txt.y, width: txt.width, height: txt.height }}
                  onMouseDown={(e) => handleItemMouseDown(e, txt.id)}
                  onDoubleClick={(e) => handleTextDoubleClick(e, txt.id)}
                >
                  {isEditing ? (
                    <textarea
                      ref={textareaRef}
                      className="moodboard-view__text-textarea"
                      value={txt.text}
                      style={{ fontSize }}
                      onChange={(e) => { onUpdateText(txt.id, { text: e.target.value }); updateActivePrefixes(e.currentTarget); }}
                      onSelect={(e) => updateActivePrefixes(e.currentTarget)}
                      onKeyUp={(e) => updateActivePrefixes(e.currentTarget)}
                      onBlur={() => {
                        setEditingTextId(null);
                        if (!txt.text.trim()) onRemoveText(txt.id);
                      }}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                    />
                  ) : txt.text ? (
                    <div
                      className="moodboard-view__text-content"
                      style={{ fontSize }}
                      dangerouslySetInnerHTML={{ __html: marked.parse(txt.text, { async: false }) as string }}
                    />
                  ) : (
                    <div className="moodboard-view__text-content moodboard-view__text-content--empty" style={{ fontSize }}>
                      Double-click to edit...
                    </div>
                  )}
                  <button
                    className="moodboard-view__item-remove"
                    onClick={(e) => { e.stopPropagation(); onRemoveText(txt.id); }}
                    aria-label="Remove text"
                  >
                    <X size={14} />
                  </button>
                  <div
                    className="moodboard-view__item-resize"
                    onMouseDown={(e) => handleResizeMouseDown(e, txt.id)}
                  />
                </div>
              </div>
            );
          })}
          {marqueeStyle && (
            <div className="moodboard-view__marquee" style={marqueeStyle} />
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
