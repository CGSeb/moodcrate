import { useState } from "react";
import {
  Download,
  PanelLeftClose,
  PanelLeftOpen,
  House,
  FolderOpen,
  Layout,
  ChevronRight,
  Plus,
  RefreshCw,
  Star,
} from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import type { Moodboard } from "../../App";
import type { UpdateState } from "../../hooks/useUpdateCheck";
import NameDialog from "../NameDialog/NameDialog";
import Tooltip from "../Tooltip/Tooltip";
import "./Sidebar.css";

export interface Collection {
  name: string;
  path: string;
}

interface SidebarProps {
  collections: Collection[];
  onAddCollection: (collection: Collection) => void;
  selectedCollection: Collection | null;
  onSelectCollection: (collection: Collection) => void;
  moodboards: Moodboard[];
  onAddMoodboard: (name: string) => void;
  selectedMoodboard: Moodboard | null;
  onSelectMoodboard: (moodboard: Moodboard) => void;
  onHome: () => void;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  updateState: UpdateState;
  onCheckForUpdates: () => void;
  onInstallUpdate: () => void;
}

export default function Sidebar({
  collections,
  onAddCollection,
  selectedCollection,
  onSelectCollection,
  moodboards,
  onAddMoodboard,
  selectedMoodboard,
  onSelectMoodboard,
  onHome,
  favorites,
  onToggleFavorite,
  updateState,
  onCheckForUpdates,
  onInstallUpdate,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    Collections: true,
    Moodboards: true,
  });
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [showMoodboardDialog, setShowMoodboardDialog] = useState(false);

  function toggleSection(label: string) {
    setOpenSections((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  async function handleAddCollection(e: React.MouseEvent) {
    e.stopPropagation();

    const selected = await open({ directory: true, multiple: false });
    if (!selected) return;

    setPendingPath(selected);
  }

  function handleConfirmName(name: string) {
    if (!pendingPath) return;
    onAddCollection({ name, path: pendingPath });
    setPendingPath(null);
  }

  function handleCollapsedIndicatorClick() {
    if (updateState.status === "available") {
      setCollapsed(false);
      return;
    }

    if (updateState.status === "checking" || updateState.status === "installing") {
      return;
    }

    onCheckForUpdates();
  }

  const currentVersionLabel = updateState.currentVersion
    ? `v${updateState.currentVersion}`
    : "Version unavailable";

  const installProgressLabel = updateState.progress !== null
    ? `Installing ${updateState.progress}%`
    : "Installing";

  const updateStatusLabel = (() => {
    switch (updateState.status) {
      case "checking":
        return "Checking for updates...";
      case "available":
        return `Update ready: v${updateState.latestVersion}`;
      case "up-to-date":
        return updateState.currentVersion
          ? `You are on ${currentVersionLabel}.`
          : "You are on the latest release.";
      case "installing":
        return updateState.latestVersion
          ? `Installing v${updateState.latestVersion}${updateState.progress !== null ? ` (${updateState.progress}%)` : "..."}`
          : "Installing update...";
      case "error":
        return updateState.error ?? "Update check failed.";
      default:
        return "";
    }
  })();

  const collapsedTooltip = updateState.status === "available"
    ? `Update available: v${updateState.latestVersion}. Click to expand.`
    : updateStatusLabel;

  return (
    <>
      <aside className={`sidebar ${collapsed ? "sidebar--collapsed" : ""}`}>
        <div className="sidebar__topbar">
          <button
            className="sidebar__home-btn"
            onClick={onHome}
            aria-label="Home"
          >
            <House size={18} />
          </button>
          {!collapsed && (
            <button
              className="sidebar__toggle"
              onClick={() => setCollapsed((c) => !c)}
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose size={18} />
            </button>
          )}
          {collapsed && (
            <button
              className="sidebar__toggle"
              onClick={() => setCollapsed((c) => !c)}
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen size={18} />
            </button>
          )}
        </div>

        {collapsed ? (
          <nav className="sidebar__nav">
            <div className="sidebar__collapsed-section">
              <div className="sidebar__collapsed-icon">
                <FolderOpen size={18} />
              </div>
              <div className="sidebar__flyout">
                <div className="sidebar__flyout-header">Collections</div>
                {collections.length === 0 ? (
                  <div className="sidebar__flyout-empty">No collections yet</div>
                ) : (
                  collections.map((col) => (
                    <div
                      key={col.path}
                      className={`sidebar__flyout-item ${selectedCollection?.path === col.path ? "sidebar__flyout-item--active" : ""}`}
                      onClick={() => onSelectCollection(col)}
                    >
                      {col.name}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="sidebar__collapsed-section">
              <div className="sidebar__collapsed-icon">
                <Layout size={18} />
              </div>
              <div className="sidebar__flyout">
                <div className="sidebar__flyout-header">Moodboards</div>
                {moodboards.length === 0 ? (
                  <div className="sidebar__flyout-empty">No moodboards yet</div>
                ) : (
                  moodboards.map((mb) => (
                    <div
                      key={mb.id}
                      className={`sidebar__flyout-item ${selectedMoodboard?.id === mb.id ? "sidebar__flyout-item--active" : ""}`}
                      onClick={() => onSelectMoodboard(mb)}
                    >
                      {mb.name}
                    </div>
                  ))
                )}
              </div>
            </div>
          </nav>
        ) : (
          <nav className="sidebar__nav">
            <div className="sidebar__section">
              <button
                className="sidebar__section-header"
                onClick={() => toggleSection("Collections")}
                aria-expanded={openSections["Collections"]}
              >
                <ChevronRight
                  size={14}
                  className={`sidebar__chevron ${openSections["Collections"] ? "sidebar__chevron--open" : ""}`}
                />
                <FolderOpen size={16} />
                <span className="sidebar__section-label">Collections</span>
                <span
                  className="sidebar__add-btn"
                  role="button"
                  tabIndex={0}
                  onClick={handleAddCollection}
                  aria-label="Add collection"
                >
                  <Plus size={15} />
                </span>
              </button>

              {openSections["Collections"] && (
                <ul className="sidebar__list">
                  {collections.length === 0 ? (
                    <li className="sidebar__empty">No collections yet</li>
                  ) : (
                    collections.map((col) => (
                      <li
                        className={`sidebar__item ${selectedCollection?.path === col.path ? "sidebar__item--active" : ""}`}
                        key={col.path}
                        onClick={() => onSelectCollection(col)}
                      >
                        <span className="sidebar__item-name">{col.name}</span>
                        <Tooltip text={favorites.includes(col.path) ? "Remove from favorites" : "Add to favorites"}>
                          <span
                            className={`sidebar__star ${favorites.includes(col.path) ? "sidebar__star--active" : ""}`}
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleFavorite(col.path);
                            }}
                            aria-label="Toggle favorite"
                          >
                            <Star size={12} fill={favorites.includes(col.path) ? "currentColor" : "none"} />
                          </span>
                        </Tooltip>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>

            <div className="sidebar__section">
              <button
                className="sidebar__section-header"
                onClick={() => toggleSection("Moodboards")}
                aria-expanded={openSections["Moodboards"]}
              >
                <ChevronRight
                  size={14}
                  className={`sidebar__chevron ${openSections["Moodboards"] ? "sidebar__chevron--open" : ""}`}
                />
                <Layout size={16} />
                <span className="sidebar__section-label">Moodboards</span>
                <span
                  className="sidebar__add-btn"
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMoodboardDialog(true);
                  }}
                  aria-label="Add moodboard"
                >
                  <Plus size={15} />
                </span>
              </button>

              {openSections["Moodboards"] && (
                <ul className="sidebar__list">
                  {moodboards.length === 0 ? (
                    <li className="sidebar__empty">No moodboards yet</li>
                  ) : (
                    moodboards.map((mb) => (
                      <li
                        className={`sidebar__item ${selectedMoodboard?.id === mb.id ? "sidebar__item--active" : ""}`}
                        key={mb.id}
                        onClick={() => onSelectMoodboard(mb)}
                      >
                        <span className="sidebar__item-name">{mb.name}</span>
                        <Tooltip text={favorites.includes(mb.id) ? "Remove from favorites" : "Add to favorites"}>
                          <span
                            className={`sidebar__star ${favorites.includes(mb.id) ? "sidebar__star--active" : ""}`}
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleFavorite(mb.id);
                            }}
                            aria-label="Toggle favorite"
                          >
                            <Star size={12} fill={favorites.includes(mb.id) ? "currentColor" : "none"} />
                          </span>
                        </Tooltip>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
          </nav>
        )}
        <div className="sidebar__version">
          {collapsed ? (
            <Tooltip text={collapsedTooltip}>
              <button
                className={`sidebar__update-indicator sidebar__update-indicator--${updateState.status}`}
                onClick={handleCollapsedIndicatorClick}
                aria-label={collapsedTooltip}
                disabled={updateState.status === "installing"}
                type="button"
              />
            </Tooltip>
          ) : (
            <div className="sidebar__update-panel">
              <div className="sidebar__version-label">{currentVersionLabel}</div>
              <div className={`sidebar__update-status sidebar__update-status--${updateState.status}`}>
                {updateStatusLabel}
              </div>
              {updateState.status === "installing" && updateState.progress !== null && (
                <div className="sidebar__update-progress" aria-hidden="true">
                  <div
                    className="sidebar__update-progress-bar"
                    style={{ width: `${updateState.progress}%` }}
                  />
                </div>
              )}
              <div className="sidebar__update-actions">
                {updateState.status === "available" && (
                  <button
                    className="sidebar__update-action sidebar__update-action--primary"
                    onClick={onInstallUpdate}
                    type="button"
                  >
                    <Download size={12} />
                    <span>Install update</span>
                  </button>
                )}
                <button
                  className="sidebar__update-action"
                  onClick={onCheckForUpdates}
                  disabled={updateState.status === "checking" || updateState.status === "installing"}
                  type="button"
                >
                  <RefreshCw
                    size={12}
                    className={updateState.status === "checking" || updateState.status === "installing" ? "sidebar__update-icon sidebar__update-icon--spinning" : "sidebar__update-icon"}
                  />
                  <span>
                    {updateState.status === "checking"
                      ? "Checking"
                      : updateState.status === "installing"
                        ? installProgressLabel
                        : "Check again"}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      <NameDialog
        open={pendingPath !== null}
        title="New Collection"
        placeholder="Collection name..."
        onConfirm={handleConfirmName}
        onCancel={() => setPendingPath(null)}
      />

      <NameDialog
        open={showMoodboardDialog}
        title="New Moodboard"
        placeholder="Moodboard name..."
        onConfirm={(name) => {
          setShowMoodboardDialog(false);
          onAddMoodboard(name);
        }}
        onCancel={() => setShowMoodboardDialog(false)}
      />
    </>
  );
}