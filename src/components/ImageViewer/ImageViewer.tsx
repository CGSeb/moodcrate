import { useEffect } from "react";
import { X } from "lucide-react";
import "./ImageViewer.css";

interface ImageViewerProps {
  src: string;
  onClose: () => void;
}

export default function ImageViewer({ src, onClose }: ImageViewerProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="image-viewer" onClick={onClose}>
      <button className="image-viewer__close" aria-label="Close">
        <X size={24} />
      </button>
      <img
        className="image-viewer__img"
        src={src}
        alt=""
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
