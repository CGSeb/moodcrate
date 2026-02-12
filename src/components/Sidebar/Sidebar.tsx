import { useState } from "react";
import {
  PanelLeftClose,
  PanelLeftOpen,
  FolderOpen,
  Layout,
  ChevronRight,
  Plus,
} from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import NameDialog from "../NameDialog/NameDialog";
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
}

export default function Sidebar({
  collections,
  onAddCollection,
  selectedCollection,
  onSelectCollection,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    Collections: true,
    Moodboards: true,
  });
  const [pendingPath, setPendingPath] = useState<string | null>(null);

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

  return (
    <>
      <aside className={`sidebar ${collapsed ? "sidebar--collapsed" : ""}`}>
        <button
          className="sidebar__toggle"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeftOpen size={18} />
          ) : (
            <PanelLeftClose size={18} />
          )}
        </button>

        {!collapsed && (
          <nav className="sidebar__nav">
            {/* Collections */}
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
                        {col.name}
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>

            {/* Moodboards */}
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
                Moodboards
              </button>

              {openSections["Moodboards"] && (
                <ul className="sidebar__list">
                  <li className="sidebar__empty">No moodboards yet</li>
                </ul>
              )}
            </div>
          </nav>
        )}
      </aside>

      <NameDialog
        open={pendingPath !== null}
        title="New Collection"
        placeholder="Collection name…"
        onConfirm={handleConfirmName}
        onCancel={() => setPendingPath(null)}
      />
    </>
  );
}
