import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Sidebar from "./Sidebar";
import { open } from "@tauri-apps/plugin-dialog";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

vi.mock("../Tooltip/Tooltip", () => ({
  default: ({ children }: { children: React.ReactElement }) => children,
}));

const openMock = vi.mocked(open);

const baseProps = {
  collections: [{ name: "Refs", path: "D:/refs" }],
  onAddCollection: vi.fn(),
  selectedCollection: null,
  onSelectCollection: vi.fn(),
  moodboards: [{ id: "mb-1", name: "Board One" }],
  onAddMoodboard: vi.fn(),
  selectedMoodboard: null,
  onSelectMoodboard: vi.fn(),
  onHome: vi.fn(),
  favorites: [] as string[],
  onToggleFavorite: vi.fn(),
  updateState: {
    status: "up-to-date" as const,
    currentVersion: "1.3.2",
    latestVersion: null,
    error: null,
    progress: null,
    downloadedBytes: 0,
    totalBytes: null,
  },
  onCheckForUpdates: vi.fn(),
  onInstallUpdate: vi.fn(),
};

describe("Sidebar", () => {
  beforeEach(() => {
    openMock.mockReset();
    Object.values(baseProps).forEach((value) => {
      if (typeof value === "function" && "mockClear" in value) {
        (value as ReturnType<typeof vi.fn>).mockClear();
      }
    });
  });

  it("selects home, collections, moodboards, and toggles favorites", () => {
    render(<Sidebar {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    fireEvent.click(screen.getByText("Refs"));
    fireEvent.click(screen.getByText("Board One"));
    fireEvent.click(screen.getAllByRole("button", { name: "Toggle favorite" })[0]);

    expect(baseProps.onHome).toHaveBeenCalledTimes(1);
    expect(baseProps.onSelectCollection).toHaveBeenCalledWith({ name: "Refs", path: "D:/refs" });
    expect(baseProps.onSelectMoodboard).toHaveBeenCalledWith({ id: "mb-1", name: "Board One" });
    expect(baseProps.onToggleFavorite).toHaveBeenCalledWith("D:/refs");
  });

  it("toggles both sidebar sections open and closed", () => {
    render(<Sidebar {...baseProps} />);

    const sectionHeaders = screen.getAllByRole("button", { expanded: true });
    fireEvent.click(sectionHeaders[0]);
    expect(screen.queryByText("Refs")).not.toBeInTheDocument();

    fireEvent.click(sectionHeaders[1]);
    expect(screen.queryByText("Board One")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Collections/i }));
    fireEvent.click(screen.getByRole("button", { name: /Moodboards/i }));

    expect(screen.getByText("Refs")).toBeInTheDocument();
    expect(screen.getByText("Board One")).toBeInTheDocument();
  });

  it("creates a collection after choosing a folder", async () => {
    openMock.mockResolvedValueOnce("D:/refs");

    render(<Sidebar {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Add collection" }));
    const input = await screen.findByPlaceholderText("Collection name...");
    fireEvent.change(input, {
      target: { value: "Ref Folder" },
    });
    fireEvent.submit(input.closest("form") as HTMLFormElement);

    await waitFor(() => {
      expect(baseProps.onAddCollection).toHaveBeenCalledWith({ name: "Ref Folder", path: "D:/refs" });
    });
  });

  it("creates a moodboard from the sidebar dialog", () => {
    render(<Sidebar {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Add moodboard" }));
    fireEvent.change(screen.getByPlaceholderText("Moodboard name..."), {
      target: { value: "New Board" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(baseProps.onAddMoodboard).toHaveBeenCalledWith("New Board");
  });

  it("collapses and expands the sidebar", () => {
    render(<Sidebar {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Expand sidebar" }));
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument();
  });

  it("handles collapsed update indicator actions", () => {
    const { rerender } = render(<Sidebar {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    fireEvent.click(screen.getByRole("button", { name: "Up to date" }));
    expect(baseProps.onCheckForUpdates).toHaveBeenCalledTimes(1);

    rerender(
      <Sidebar
        {...baseProps}
        updateState={{ ...baseProps.updateState, status: "available", latestVersion: "1.4.0" }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Update available: v1.4.0/i }));
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument();
  });

  it("shows update actions for available and installing states", () => {
    const { rerender, container } = render(
      <Sidebar
        {...baseProps}
        updateState={{ ...baseProps.updateState, status: "available", latestVersion: "1.4.0" }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Install update/i }));
    expect(baseProps.onInstallUpdate).toHaveBeenCalledTimes(1);

    rerender(
      <Sidebar
        {...baseProps}
        updateState={{
          ...baseProps.updateState,
          status: "installing",
          latestVersion: "1.4.0",
          progress: 50,
        }}
      />,
    );

    expect(screen.getByText("Installing v1.4.0 (50%)")).toBeInTheDocument();
    expect(container.querySelector(".sidebar__update-progress-bar")).toHaveAttribute("style", expect.stringContaining("50%"));
  });

  it("shows error and checking states in the update panel", () => {
    const { rerender } = render(
      <Sidebar
        {...baseProps}
        updateState={{ ...baseProps.updateState, status: "checking" }}
      />,
    );

    expect(screen.getByText("Checking for updates...")).toBeInTheDocument();

    rerender(
      <Sidebar
        {...baseProps}
        updateState={{ ...baseProps.updateState, status: "error", error: "Network down" }}
      />,
    );

    expect(screen.getByText("Network down")).toBeInTheDocument();
  });

  it("shows fallback version and error labels when update metadata is missing", () => {
    render(
      <Sidebar
        {...baseProps}
        updateState={{
          ...baseProps.updateState,
          status: "error",
          currentVersion: null,
          error: null,
        }}
      />,
    );

    expect(screen.getByText("Version unavailable")).toBeInTheDocument();
    expect(screen.getByText("Update check failed.")).toBeInTheDocument();
  });

  it("shows empty flyouts and does not check for updates while collapsed installing", () => {
    render(
      <Sidebar
        {...baseProps}
        collections={[]}
        moodboards={[]}
        updateState={{ ...baseProps.updateState, status: "installing", latestVersion: null, progress: null }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(screen.getAllByText(/No .* yet/)).toHaveLength(2);

    const indicator = screen.getByRole("button", { name: "Installing update..." });
    expect(indicator).toBeDisabled();
    fireEvent.click(indicator);

    expect(baseProps.onCheckForUpdates).not.toHaveBeenCalled();
  });

  it("does not open a collection dialog when the folder picker is cancelled", async () => {
    openMock.mockResolvedValueOnce(null);

    render(<Sidebar {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Add collection" }));

    await waitFor(() => {
      expect(openMock).toHaveBeenCalledWith({ directory: true, multiple: false });
    });

    expect(screen.queryByText("New Collection")).not.toBeInTheDocument();
    expect(baseProps.onAddCollection).not.toHaveBeenCalled();
  });

  it("toggles the moodboard favorite without selecting the moodboard", () => {
    render(<Sidebar {...baseProps} favorites={["mb-1"]} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Toggle favorite" })[1]);

    expect(baseProps.onToggleFavorite).toHaveBeenCalledWith("mb-1");
    expect(baseProps.onSelectMoodboard).not.toHaveBeenCalled();
  });

  it("does not check for updates while collapsed and already checking", () => {
    render(
      <Sidebar
        {...baseProps}
        updateState={{ ...baseProps.updateState, status: "checking" }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    fireEvent.click(screen.getByRole("button", { name: "Checking for updates..." }));

    expect(baseProps.onCheckForUpdates).not.toHaveBeenCalled();
  });

  it("closes the dialogs on cancel", async () => {
    openMock.mockResolvedValueOnce("D:/refs");

    render(<Sidebar {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Add collection" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("New Collection")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add moodboard" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("New Moodboard")).not.toBeInTheDocument();
  });
});
