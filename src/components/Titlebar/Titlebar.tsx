import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, Copy, X } from "lucide-react";
import appIcon from "../../assets/icon.svg";
import "./Titlebar.css";

const appWindow = getCurrentWindow();

function Titlebar() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    appWindow.isMaximized().then(setMaximized);

    const unlisten = appWindow.onResized(() => {
      appWindow.isMaximized().then(setMaximized);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  return (
    <div className="titlebar" data-tauri-drag-region>
      <div className="titlebar__left" data-tauri-drag-region>
        <img src={appIcon} alt="Moodcrate" className="titlebar__icon" draggable={false} />
        <span className="titlebar__title" data-tauri-drag-region>Moodcrate</span>
      </div>
      <div className="titlebar__controls">
        <button
          className="titlebar__btn"
          onClick={() => appWindow.minimize()}
          aria-label="Minimize"
        >
          <Minus size={14} />
        </button>
        <button
          className="titlebar__btn"
          onClick={() => appWindow.toggleMaximize()}
          aria-label={maximized ? "Restore" : "Maximize"}
        >
          {maximized ? <Copy size={12} /> : <Square size={12} />}
        </button>
        <button
          className="titlebar__btn titlebar__btn--close"
          onClick={() => appWindow.close()}
          aria-label="Close"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

export default Titlebar;
