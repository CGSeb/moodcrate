import { useState, useRef, useCallback, useLayoutEffect } from "react";
import "./Tooltip.css";

interface TooltipProps {
  text: string;
  children: React.ReactElement;
  delay?: number;
}

export default function Tooltip({ text, children, delay = 400 }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [anchor, setAnchor] = useState({ x: 0, y: 0 });
  const [style, setStyle] = useState<React.CSSProperties>({ opacity: 0 });
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const show = useCallback((e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setAnchor({ x: rect.left + rect.width / 2, y: rect.top });
    timeoutRef.current = setTimeout(() => setVisible(true), delay);
  }, [delay]);

  const hide = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setVisible(false);
  }, []);

  useLayoutEffect(() => {
    if (!visible || !tooltipRef.current) return;
    const el = tooltipRef.current;
    const tw = el.offsetWidth;
    const margin = 8;
    let left = anchor.x - tw / 2;
    if (left < margin) left = margin;
    if (left + tw > window.innerWidth - margin) left = window.innerWidth - margin - tw;
    setStyle({ left, top: anchor.y - el.offsetHeight - 6, opacity: 1 });
  }, [visible, anchor, text]);

  return (
    <>
      <span
        className="tooltip-wrapper"
        onMouseEnter={show}
        onMouseLeave={hide}
      >
        {children}
      </span>
      {visible && (
        <div className="tooltip" ref={tooltipRef} style={style}>
          {text}
        </div>
      )}
    </>
  );
}
