import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import App from "./App";

vi.mock("./components/Titlebar/Titlebar", () => ({
  default: () => <div data-testid="titlebar" />,
}));

vi.mock("./components/Sidebar/Sidebar", () => ({
  default: (props: any) => (
    <div data-testid="sidebar">
      <div data-testid="favorites-count">{props.favorites.length}</div>
      <button onClick={props.onHome} type="button">sidebar home</button>
      <button
        onClick={() => props.onAddCollection({ name: "Sidebar Refs", path: "D:/sidebar-refs" })}
        type="button"
      >
        sidebar add collection
      </button>
      <button
        onClick={() => props.collections[0] && props.onSelectCollection(props.collections[0])}
        type="button"
      >
        sidebar first collection
      </button>
      <button
        onClick={() => props.moodboards[0] && props.onSelectMoodboard(props.moodboards[0])}
        type="button"
      >
        sidebar first moodboard
      </button>
      <button
        onClick={() => props.collections[0] && props.onToggleFavorite(props.collections[0].path)}
        type="button"
      >
        toggle first collection favorite
      </button>
    </div>
  ),
}));

vi.mock("./components/HomePage/HomePage", () => ({
  default: (props: any) => (
    <div data-testid="home-page">
      <div data-testid="home-collection-count">{props.collections.length}</div>
      <div data-testid="home-moodboard-count">{props.moodboards.length}</div>
      <div data-testid="home-favorite-count">{props.favorites.length}</div>
      <button
        onClick={() => props.onAddCollection({ name: "Refs", path: "D:/refs" })}
        type="button"
      >
        create collection
      </button>
      <button onClick={() => props.onAddMoodboard("Moodboard Alpha")} type="button">
        create moodboard
      </button>
      <button
        onClick={() => props.collections[0] && props.onSelectCollection(props.collections[0])}
        type="button"
      >
        home first collection
      </button>
      <button
        onClick={() => props.moodboards[0] && props.onSelectMoodboard(props.moodboards[0])}
        type="button"
      >
        home first moodboard
      </button>
    </div>
  ),
}));

vi.mock("./components/CollectionView/CollectionView", () => ({
  default: (props: any) => (
    <div data-testid="collection-view">
      <div>{props.collection.name}</div>
      <div data-testid="collection-tag-count">{props.tags.length}</div>
      <div data-testid="collection-image-tag-count">{(props.imageTags["D:/refs/a.png"] || []).length}</div>
      <button onClick={props.onDelete} type="button">delete collection</button>
      <button
        onClick={() => props.onCreateMoodboardWithImages("Board From Collection", ["D:/refs/a.png", "D:/refs/b.png"])}
        type="button"
      >
        create moodboard from images
      </button>
      <button
        onClick={() => props.onCreateMoodboardWithImage("Board From Single Image", "D:/refs/a.png")}
        type="button"
      >
        create moodboard with image
      </button>
      <button
        onClick={() => props.moodboards[0] && props.onAddImageToMoodboard(props.moodboards[0].id, "D:/refs/a.png")}
        type="button"
      >
        add image to first moodboard
      </button>
      <button
        onClick={() => props.onAddImageToMoodboard("missing-moodboard", "D:/refs/a.png")}
        type="button"
      >
        add image to missing moodboard
      </button>
      <button
        onClick={() => props.onAddImagesToMoodboard("missing-moodboard", ["D:/refs/a.png"])}
        type="button"
      >
        batch add to missing moodboard
      </button>
      <button onClick={() => props.onAddTag("Character")} type="button">add tag</button>
      <button onClick={() => props.onAddTag("character")} type="button">add duplicate tag</button>
      <button
        onClick={() => props.tags[0] && props.onAddTag("Portrait", props.tags[0].id)}
        type="button"
      >
        add child tag
      </button>
      <button
        onClick={() => props.tags[0] && props.onDeleteTag(props.tags[0].id)}
        type="button"
      >
        delete first tag
      </button>
      <button
        onClick={() => props.tags[0] && props.onAddTagToImage("D:/refs/a.png", props.tags[0].id)}
        type="button"
      >
        tag image
      </button>
      <button
        onClick={() => props.tags[1] && props.onAddTagToImage("D:/refs/a.png", props.tags[1].id)}
        type="button"
      >
        tag image with second tag
      </button>
      <button
        onClick={() => props.tags[0] && props.onAddTagToImage("D:/refs/a.png", props.tags[0].id)}
        type="button"
      >
        tag image again
      </button>
      <button
        onClick={() => props.tags[0] && props.onRemoveTagFromImage("D:/refs/a.png", props.tags[0].id)}
        type="button"
      >
        untag image
      </button>
      <button onClick={() => props.onRemoveTagFromImage("D:/refs/a.png", "missing-tag")} type="button">
        untag missing image tag
      </button>
      <button
        onClick={() => props.tags[0] && props.onSetTagParent(props.tags[0].id, props.tags[0].id)}
        type="button"
      >
        set same tag parent
      </button>
      <button
        onClick={() => props.tags.length > 1 && props.onSetTagParent(props.tags[0].id, props.tags[1].id)}
        type="button"
      >
        set cycle tag parent
      </button>
      <button
        onClick={() => props.tags.length > 1 && props.onSetTagParent(props.tags[1].id, null)}
        type="button"
      >
        clear child tag parent
      </button>
      <button onClick={() => props.onShowToast("Saved", "success")} type="button">show toast</button>
      <button onClick={() => props.onShowToast("Warn", "warning")} type="button">show warning toast</button>
    </div>
  ),
}));

vi.mock("./components/MoodboardView/MoodboardView", () => ({
  default: (props: any) => (
    <div data-testid="moodboard-view">
      <div>{props.moodboard.name}</div>
      <div data-testid="moodboard-image-count">{props.images.length}</div>
      <div data-testid="moodboard-first-image-width">{props.images[0]?.width ?? "none"}</div>
      <div data-testid="moodboard-text-count">{props.texts.length}</div>
      <div data-testid="moodboard-first-text">{props.texts[0]?.text ?? "none"}</div>
      <div data-testid="pending-selection-count">{props.initialSelectedIds.length}</div>
      <button onClick={props.onConsumeSelection} type="button">consume selection</button>
      <button onClick={props.onDelete} type="button">delete moodboard</button>
      <button
        onClick={() => props.images[0] && props.onRemoveImage(props.images[0].id)}
        type="button"
      >
        remove first image
      </button>
      <button
        onClick={() => props.images[0] && props.onUpdateImage(props.images[0].id, { width: 250 })}
        type="button"
      >
        update first image
      </button>
      <button onClick={() => props.onAddText("text-1", 10, 20)} type="button">add text</button>
      <button
        onClick={() => props.texts[0] && props.onUpdateText(props.texts[0].id, { text: "Updated" })}
        type="button"
      >
        update first text
      </button>
      <button
        onClick={() => props.texts[0] && props.onRemoveText(props.texts[0].id)}
        type="button"
      >
        remove first text
      </button>
      <button onClick={() => props.onUpdateImage("missing-image", { width: 111 })} type="button">
        update missing image
      </button>
      <button onClick={() => props.onRemoveImage("missing-image")} type="button">
        remove missing image
      </button>
      <button onClick={() => props.onUpdateText("missing-text", { text: "Ghost" })} type="button">
        update missing text
      </button>
      <button onClick={() => props.onRemoveText("missing-text")} type="button">
        remove missing text
      </button>
    </div>
  ),
}));

vi.mock("./hooks/useUpdateCheck", () => ({
  useUpdateCheck: () => ({
    updateState: {
      status: "up-to-date",
      currentVersion: "1.3.2",
      latestVersion: null,
      error: null,
      progress: null,
      downloadedBytes: 0,
      totalBytes: null,
    },
    checkForUpdates: vi.fn(),
    installUpdate: vi.fn(),
  }),
}));

vi.mock("./hooks/useTagsStorage", async () => {
  const React = await import("react");

  return {
    useTagsStorage: () => {
      const [tags, setTags] = React.useState([]);
      const [imageTags, setImageTags] = React.useState({});

      return { tags, setTags, imageTags, setImageTags };
    },
  };
});

vi.mock("./hooks/useMoodboardsStorage", async () => {
  const React = await import("react");

  return {
    useMoodboardsStorage: () => {
      const [moodboards, setMoodboards] = React.useState([]);
      const [moodboardImages, setMoodboardImages] = React.useState({});
      const [moodboardTexts, setMoodboardTexts] = React.useState({});

      return {
        moodboards,
        setMoodboards,
        moodboardImages,
        setMoodboardImages,
        moodboardTexts,
        setMoodboardTexts,
      };
    },
  };
});

describe("App", () => {
  it("shows the home page first and switches to a collection when one is created", () => {
    render(<App />);

    expect(screen.getByTestId("home-page")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "create collection" }));

    expect(screen.getByTestId("collection-view")).toBeInTheDocument();
    expect(screen.getByText("Refs")).toBeInTheDocument();
  });

  it("navigates between home, collection, and moodboard selections from the home page and sidebar", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "create collection" }));
    fireEvent.click(screen.getByRole("button", { name: "sidebar home" }));
    expect(screen.getByTestId("home-page")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "create moodboard" }));
    fireEvent.click(screen.getByRole("button", { name: "sidebar home" }));
    fireEvent.click(screen.getByRole("button", { name: "home first collection" }));
    expect(screen.getByTestId("collection-view")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "sidebar home" }));
    fireEvent.click(screen.getByRole("button", { name: "home first moodboard" }));
    expect(screen.getByTestId("moodboard-view")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "sidebar first moodboard" }));
    expect(screen.getByTestId("moodboard-view")).toBeInTheDocument();
  });

  it("creates a collection from the sidebar add action", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "sidebar add collection" }));

    expect(screen.getByTestId("collection-view")).toBeInTheDocument();
    expect(screen.getByText("Sidebar Refs")).toBeInTheDocument();
  });

  it("creates a moodboard from collection images and clears pending selection after it is consumed", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "create collection" }));
    fireEvent.click(screen.getByRole("button", { name: "create moodboard from images" }));

    expect(screen.getByTestId("moodboard-view")).toBeInTheDocument();
    expect(screen.getByText("Board From Collection")).toBeInTheDocument();
    expect(screen.getByTestId("moodboard-image-count")).toHaveTextContent("2");
    expect(screen.getByTestId("pending-selection-count")).toHaveTextContent("2");

    fireEvent.click(screen.getByRole("button", { name: "consume selection" }));

    expect(screen.getByTestId("pending-selection-count")).toHaveTextContent("0");
  });

  it("returns to the home page after deleting a moodboard", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "create moodboard" }));

    expect(screen.getByTestId("moodboard-view")).toBeInTheDocument();
    expect(screen.getByText("Moodboard Alpha")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "delete moodboard" }));

    expect(screen.getByTestId("home-page")).toBeInTheDocument();
  });

  it("returns to the home page after deleting a collection", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "create collection" }));
    fireEvent.click(screen.getByRole("button", { name: "delete collection" }));

    expect(screen.getByTestId("home-page")).toBeInTheDocument();
    expect(screen.getByTestId("home-collection-count")).toHaveTextContent("0");
  });

  it("adds an image to an existing moodboard and skips duplicates", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "create moodboard" }));
    fireEvent.click(screen.getByRole("button", { name: "sidebar home" }));
    fireEvent.click(screen.getByRole("button", { name: "create collection" }));
    fireEvent.click(screen.getByRole("button", { name: "add image to first moodboard" }));

    expect(screen.getByTestId("moodboard-view")).toBeInTheDocument();
    expect(screen.getByText("Moodboard Alpha")).toBeInTheDocument();
    expect(screen.getByTestId("moodboard-image-count")).toHaveTextContent("1");

    fireEvent.click(screen.getByRole("button", { name: "sidebar first collection" }));
    fireEvent.click(screen.getByRole("button", { name: "add image to first moodboard" }));

    expect(screen.getByTestId("moodboard-image-count")).toHaveTextContent("1");
  });

  it("keeps the collection selected when adding images to a missing moodboard id", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "create collection" }));
    fireEvent.click(screen.getByRole("button", { name: "add image to missing moodboard" }));

    expect(screen.getByTestId("collection-view")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "batch add to missing moodboard" }));

    expect(screen.getByTestId("collection-view")).toBeInTheDocument();
    expect(screen.queryByTestId("moodboard-view")).not.toBeInTheDocument();
  });

  it("manages tag creation, duplicate prevention, and image tag assignment", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "create collection" }));

    expect(screen.getByTestId("collection-tag-count")).toHaveTextContent("0");
    fireEvent.click(screen.getByRole("button", { name: "add tag" }));
    expect(screen.getByTestId("collection-tag-count")).toHaveTextContent("1");

    fireEvent.click(screen.getByRole("button", { name: "add duplicate tag" }));
    expect(screen.getByTestId("collection-tag-count")).toHaveTextContent("1");

    fireEvent.click(screen.getByRole("button", { name: "tag image" }));
    expect(screen.getByTestId("collection-image-tag-count")).toHaveTextContent("1");

    fireEvent.click(screen.getByRole("button", { name: "untag image" }));
    expect(screen.getByTestId("collection-image-tag-count")).toHaveTextContent("0");

    fireEvent.click(screen.getByRole("button", { name: "add child tag" }));
    expect(screen.getByTestId("collection-tag-count")).toHaveTextContent("2");

    fireEvent.click(screen.getByRole("button", { name: "delete first tag" }));
    expect(screen.getByTestId("collection-tag-count")).toHaveTextContent("1");
  });

  it("keeps remaining image tags when deleting one tag from a multi-tag image", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "create collection" }));
    fireEvent.click(screen.getByRole("button", { name: "add tag" }));
    fireEvent.click(screen.getByRole("button", { name: "add child tag" }));
    fireEvent.click(screen.getByRole("button", { name: "tag image" }));
    fireEvent.click(screen.getByRole("button", { name: "tag image with second tag" }));
    fireEvent.click(screen.getByRole("button", { name: "delete first tag" }));

    expect(screen.getByTestId("collection-image-tag-count")).toHaveTextContent("1");
  });

  it("updates moodboard images and texts after creating one from a single image", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "create collection" }));
    fireEvent.click(screen.getByRole("button", { name: "create moodboard with image" }));

    expect(screen.getByTestId("moodboard-image-count")).toHaveTextContent("1");
    expect(screen.getByTestId("moodboard-text-count")).toHaveTextContent("0");

    fireEvent.click(screen.getByRole("button", { name: "update first image" }));
    expect(screen.getByTestId("moodboard-first-image-width")).toHaveTextContent("250");

    fireEvent.click(screen.getByRole("button", { name: "add text" }));
    expect(screen.getByTestId("moodboard-text-count")).toHaveTextContent("1");

    fireEvent.click(screen.getByRole("button", { name: "update first text" }));
    expect(screen.getByTestId("moodboard-first-text")).toHaveTextContent("Updated");

    fireEvent.click(screen.getByRole("button", { name: "remove first text" }));
    expect(screen.getByTestId("moodboard-text-count")).toHaveTextContent("0");

    fireEvent.click(screen.getByRole("button", { name: "remove first image" }));
    expect(screen.getByTestId("moodboard-image-count")).toHaveTextContent("0");
  });

  it("toggles favorites and shows app toasts", () => {
    vi.useFakeTimers();
    try {
      render(<App />);

      fireEvent.click(screen.getByRole("button", { name: "create collection" }));
      expect(screen.getByTestId("favorites-count")).toHaveTextContent("0");

      fireEvent.click(screen.getByRole("button", { name: "toggle first collection favorite" }));
      expect(screen.getByTestId("favorites-count")).toHaveTextContent("1");
      fireEvent.click(screen.getByRole("button", { name: "toggle first collection favorite" }));
      expect(screen.getByTestId("favorites-count")).toHaveTextContent("0");

      fireEvent.click(screen.getByRole("button", { name: "show toast" }));
      expect(screen.getByText("Saved")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "show warning toast" }));
      expect(screen.getByText("Warn")).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(screen.queryByText("Warn")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("handles tag parent edge cases and no-op image/text updates", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "create collection" }));
    fireEvent.click(screen.getByRole("button", { name: "add tag" }));
    fireEvent.click(screen.getByRole("button", { name: "add child tag" }));

    expect(screen.getByTestId("collection-tag-count")).toHaveTextContent("2");

    fireEvent.click(screen.getByRole("button", { name: "set same tag parent" }));
    expect(screen.getByTestId("collection-tag-count")).toHaveTextContent("2");

    fireEvent.click(screen.getByRole("button", { name: "set cycle tag parent" }));
    expect(screen.getByTestId("collection-tag-count")).toHaveTextContent("2");

    fireEvent.click(screen.getByRole("button", { name: "clear child tag parent" }));
    expect(screen.getByTestId("collection-tag-count")).toHaveTextContent("2");

    fireEvent.click(screen.getByRole("button", { name: "tag image" }));
    fireEvent.click(screen.getByRole("button", { name: "tag image again" }));
    expect(screen.getByTestId("collection-image-tag-count")).toHaveTextContent("1");

    fireEvent.click(screen.getByRole("button", { name: "untag missing image tag" }));
    expect(screen.getByTestId("collection-image-tag-count")).toHaveTextContent("1");

    fireEvent.click(screen.getByRole("button", { name: "create moodboard with image" }));
    fireEvent.click(screen.getByRole("button", { name: "update missing image" }));
    fireEvent.click(screen.getByRole("button", { name: "remove missing image" }));
    fireEvent.click(screen.getByRole("button", { name: "update missing text" }));
    fireEvent.click(screen.getByRole("button", { name: "remove missing text" }));

    expect(screen.getByTestId("moodboard-image-count")).toHaveTextContent("1");
  });
});
