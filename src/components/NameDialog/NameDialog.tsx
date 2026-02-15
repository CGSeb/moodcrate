import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import "./NameDialog.css";

interface NameDialogProps {
  open: boolean;
  title: string;
  placeholder?: string;
  validate?: (name: string) => string | null;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

export default function NameDialog({
  open,
  title,
  placeholder = "Enter a name…",
  validate,
  onConfirm,
  onCancel,
}: NameDialogProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue("");
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    if (validate) {
      const msg = validate(trimmed);
      if (msg) {
        setError(msg);
        return;
      }
    }
    onConfirm(trimmed);
  }

  return (
    <div className="name-dialog__overlay" onClick={onCancel}>
      <div className="name-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="name-dialog__header">
          <span className="name-dialog__title">{title}</span>
          <button className="name-dialog__close" onClick={onCancel}>
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            className={`name-dialog__input ${error ? "name-dialog__input--error" : ""}`}
            type="text"
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(null); }}
            placeholder={placeholder}
          />
          {error && <div className="name-dialog__error">{error}</div>}
          <div className="name-dialog__actions">
            <button
              type="button"
              className="name-dialog__btn name-dialog__btn--cancel"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="name-dialog__btn name-dialog__btn--confirm"
              disabled={!value.trim()}
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
