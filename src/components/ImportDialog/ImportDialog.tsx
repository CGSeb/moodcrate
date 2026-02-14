import { useState, useEffect } from "react";
import { X, Copy, Scissors } from "lucide-react";
import "./ImportDialog.css";

export type ImportMode = "copy" | "move";

interface ImportDialogProps {
  open: boolean;
  fileCount: number;
  onConfirm: (mode: ImportMode, remember: boolean) => void;
  onCancel: () => void;
}

export default function ImportDialog({
  open,
  fileCount,
  onConfirm,
  onCancel,
}: ImportDialogProps) {
  const [remember, setRemember] = useState(false);

  useEffect(() => {
    if (open) setRemember(false);
  }, [open]);

  if (!open) return null;

  return (
    <div className="import-dialog__overlay" onClick={onCancel}>
      <div className="import-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="import-dialog__header">
          <span className="import-dialog__title">
            Import {fileCount} image{fileCount !== 1 ? "s" : ""}
          </span>
          <button className="import-dialog__close" onClick={onCancel}>
            <X size={16} />
          </button>
        </div>
        <p className="import-dialog__message">
          How would you like to import the selected files?
        </p>
        <div className="import-dialog__options">
          <button
            className="import-dialog__option"
            onClick={() => onConfirm("copy", remember)}
          >
            <Copy size={20} />
            <div>
              <div className="import-dialog__option-label">Copy</div>
              <div className="import-dialog__option-desc">Keep originals in place</div>
            </div>
          </button>
          <button
            className="import-dialog__option"
            onClick={() => onConfirm("move", remember)}
          >
            <Scissors size={20} />
            <div>
              <div className="import-dialog__option-label">Move</div>
              <div className="import-dialog__option-desc">Remove originals after import</div>
            </div>
          </button>
        </div>
        <label className="import-dialog__remember">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          Remember my choice
        </label>
      </div>
    </div>
  );
}
