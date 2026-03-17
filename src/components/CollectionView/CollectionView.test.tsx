import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CollectionView from "./CollectionView";
import type { Tag, Moodboard } from "../../App";
import type { Collection } from "../Sidebar/Sidebar";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { readImage } from "@tauri-apps/plugin-clipboard-manager";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  convertFileSrc: vi.fn((path: string) => `asset://${path}`),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({
  readImage: vi.fn(),
}));

vi.mock("../Tooltip/Tooltip", () => ({
  default: ({ children }: { children: React.ReactElement }) => children,
}));

vi.mock("../ImageViewer/ImageViewer", () => ({
  default: ({ src, onClose }: { src: string; onClose: () => void }) => (
    <div data-testid="image-viewer" onClick={onClose}>
      {src}
    </div>
  ),
}));

const invokeMock = vi.mocked(invoke);
const convertFileSrcMock = vi.mocked(convertFileSrc);
const openMock = vi.mocked(open);
const readImageMock = vi.mocked(readImage);

const collection: Collection = {
  name: "References",
  path: "D:/refs",
};

const tags: Tag[] = [
  { id: "tag-parent", name: "Character", parentId: null },
  { id: "tag-child", name: "Portrait", parentId: "tag-parent" },
  { id: "tag-other", name: "Environment", parentId: null },
];

const moodboards: Moodboard[] = [
  { id: "mb-1", name: "Board A" },
  { id: "mb-2", name: "Board B" },
];

const imagePaths = [
  "D:/refs/alpha.png",
  "D:/refs/beta.png",
  "D:/refs/gamma.png",
];

function renderCollectionView(overrides: Partial<React.ComponentProps<typeof CollectionView>> = {}) {
  const onDelete = vi.fn();
  const onAddTag = vi.fn(() => true);
  const onDeleteTag = vi.fn();
  const onSetTagParent = vi.fn();
  const onAddTagToImage = vi.fn();
  const onRemoveTagFromImage = vi.fn();
  const onAddImageToMoodboard = vi.fn();
  const onCreateMoodboardWithImage = vi.fn();
  const onAddImagesToMoodboard = vi.fn(() => ({ added: 2, skipped: 0 }));
  const onCreateMoodboardWithImages = vi.fn();
  const onShowToast = vi.fn();

  const result = render(
    <CollectionView
      collection={collection}
      onDelete={onDelete}
      tags={tags}
      imageTags={{
        "D:/refs/alpha.png": ["tag-child"],
        "D:/refs/beta.png": ["tag-other"],
      }}
      onAddTag={onAddTag}
      onDeleteTag={onDeleteTag}
      onSetTagParent={onSetTagParent}
      onAddTagToImage={onAddTagToImage}
      onRemoveTagFromImage={onRemoveTagFromImage}
      moodboards={moodboards}
      moodboardImages={{}}
      onAddImageToMoodboard={onAddImageToMoodboard}
      onCreateMoodboardWithImage={onCreateMoodboardWithImage}
      onAddImagesToMoodboard={onAddImagesToMoodboard}
      onCreateMoodboardWithImages={onCreateMoodboardWithImages}
      onShowToast={onShowToast}
      {...overrides}
    />,
  );

  return {
    ...result,
    onDelete,
    onAddTag,
    onDeleteTag,
    onSetTagParent,
    onAddTagToImage,
    onRemoveTagFromImage,
    onAddImageToMoodboard,
    onCreateMoodboardWithImage,
    onAddImagesToMoodboard,
    onCreateMoodboardWithImages,
    onShowToast,
  };
}

describe("CollectionView", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    convertFileSrcMock.mockClear();
    openMock.mockReset();
    readImageMock.mockReset();
    invokeMock.mockImplementation((command: string, args?: Record<string, unknown>) => {
      switch (command) {
        case "list_images":
          return Promise.resolve(imagePaths);
        case "generate_thumbnail":
          return Promise.resolve(`${String(args?.path)}.webp`);
        case "clear_collection_cache":
        case "delete_image":
        case "import_files":
        case "save_clipboard_image":
          return Promise.resolve("");
        default:
          return Promise.resolve("");
      }
    });
    openMock.mockResolvedValue(null);
  });

  it("filters images by a selected parent tag and includes descendants", async () => {
    const { container } = renderCollectionView();

    await waitFor(() => {
      expect(screen.getByText("(3)")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Filter by Character" }));

    await waitFor(() => {
      expect(screen.getByText("(1)")).toBeInTheDocument();
    });

    expect(container.querySelectorAll(".collection-view__tile")).toHaveLength(1);
  });

  it("batch-adds selected images to an existing moodboard and shows a success toast", async () => {
    const { onAddImagesToMoodboard, onShowToast } = renderCollectionView();

    await waitFor(() => {
      expect(screen.getByText("(3)")).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);

    expect(screen.getByText("2 images selected")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add to moodboard" }));
    fireEvent.click(screen.getByRole("button", { name: "Board A" }));

    expect(onAddImagesToMoodboard).toHaveBeenCalledWith("mb-1", [
      "D:/refs/alpha.png",
      "D:/refs/beta.png",
    ]);
    expect(onShowToast).toHaveBeenCalledWith("2 images added to moodboard", "success");

    await waitFor(() => {
      expect(screen.queryByText("2 images selected")).not.toBeInTheDocument();
    });
  });

  it("creates a new moodboard from the current batch selection", async () => {
    const { onCreateMoodboardWithImages } = renderCollectionView();

    await waitFor(() => {
      expect(screen.getByText("(3)")).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Add to moodboard" }));
    fireEvent.click(screen.getByRole("button", { name: "New moodboard" }));

    fireEvent.change(screen.getByPlaceholderText("Moodboard name..."), {
      target: { value: "Fresh Board" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(onCreateMoodboardWithImages).toHaveBeenCalledWith("Fresh Board", ["D:/refs/alpha.png"]);

    await waitFor(() => {
      expect(screen.queryByText("1 image selected")).not.toBeInTheDocument();
    });
  });

  it("imports files from disk immediately when an import mode is remembered", async () => {
    localStorage.setItem("importMode", JSON.stringify("copy"));
    openMock.mockResolvedValueOnce(["D:/incoming/a.png", "D:/incoming/b.png"]);

    renderCollectionView();

    await waitFor(() => {
      expect(screen.getByText("(3)")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Import images from disk" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("import_files", {
        sources: ["D:/incoming/a.png", "D:/incoming/b.png"],
        targetDir: "D:/refs",
        mode: "copy",
      });
    });
  });

  it("saves a pasted clipboard image into the collection", async () => {
    readImageMock.mockResolvedValueOnce({
      rgba: () => Promise.resolve(Uint8Array.from([255, 0, 0, 255])),
      size: () => Promise.resolve({ width: 1, height: 1 }),
    } as Awaited<ReturnType<typeof readImage>>);

    renderCollectionView();

    await waitFor(() => {
      expect(screen.getByText("(3)")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Paste image from clipboard" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("save_clipboard_image", {
        rgbaData: [255, 0, 0, 255],
        width: 1,
        height: 1,
        targetDir: "D:/refs",
      });
    });
  });

  it("clears the thumbnail cache from the settings popover", async () => {
    renderCollectionView();

    await waitFor(() => {
      expect(screen.getByText("(3)")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Grid settings" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear thumbnail cache" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("clear_collection_cache", { path: "D:/refs" });
    });
  });

  it("shows the import dialog when no mode is remembered and imports after choosing move", async () => {
    openMock.mockResolvedValueOnce(["D:/incoming/c.png"]);

    renderCollectionView();

    await waitFor(() => {
      expect(screen.getByText("(3)")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Import images from disk" }));
    fireEvent.click((await screen.findByText("Move")).closest("button") as Element);

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("import_files", {
        sources: ["D:/incoming/c.png"],
        targetDir: "D:/refs",
        mode: "move",
      });
    });
  });

  it("opens the image viewer when an image tile is clicked", async () => {
    const { container } = renderCollectionView();

    await waitFor(() => {
      expect(screen.getByText("(3)")).toBeInTheDocument();
    });

    fireEvent.click(container.querySelector(".collection-view__tile") as Element);

    expect(screen.getByTestId("image-viewer")).toHaveTextContent("asset://D:/refs/alpha.png");
  });

  it("adds a single image to an existing moodboard from the picker", async () => {
    const { container, onAddImageToMoodboard } = renderCollectionView();

    await waitFor(() => {
      expect(screen.getByText("(3)")).toBeInTheDocument();
    });

    const firstAddButton = container.querySelector(".collection-view__tile-action-btn") as Element;
    fireEvent.click(firstAddButton);
    fireEvent.click(screen.getByRole("button", { name: "Board A" }));

    expect(onAddImageToMoodboard).toHaveBeenCalledWith("mb-1", "D:/refs/alpha.png");
  });

  it("creates a new moodboard from a single image via the picker", async () => {
    const { container, onCreateMoodboardWithImage } = renderCollectionView();

    await waitFor(() => {
      expect(screen.getByText("(3)")).toBeInTheDocument();
    });

    const firstAddButton = container.querySelector(".collection-view__tile-action-btn") as Element;
    fireEvent.click(firstAddButton);
    fireEvent.click(screen.getByRole("button", { name: "New moodboard" }));
    fireEvent.change(screen.getByPlaceholderText("Moodboard name..."), {
      target: { value: "Single Pick Board" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(onCreateMoodboardWithImage).toHaveBeenCalledWith("Single Pick Board", "D:/refs/alpha.png");
  });

  it("confirms image deletion before removing it from disk", async () => {
    const { container } = renderCollectionView();

    await waitFor(() => {
      expect(screen.getByText("(3)")).toBeInTheDocument();
    });

    const actionButtons = container.querySelectorAll(".collection-view__tile-action-btn");
    fireEvent.click(actionButtons[1]);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("delete_image", { path: "D:/refs/alpha.png" });
    });
  });

  it("confirms collection deletion through the dialog", async () => {
    const { onDelete } = renderCollectionView();

    await waitFor(() => {
      expect(screen.getByText("(3)")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Delete collection" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("does nothing when disk import is cancelled", async () => {
    renderCollectionView();

    await waitFor(() => {
      expect(screen.getByText("(3)")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Import images from disk" }));

    expect(invokeMock).not.toHaveBeenCalledWith("import_files", expect.anything());
  });

  it("supports clipboard paste from the Ctrl+V shortcut", async () => {
    readImageMock.mockResolvedValueOnce({
      rgba: () => Promise.resolve(Uint8Array.from([1, 2, 3, 4])),
      size: () => Promise.resolve({ width: 1, height: 1 }),
    } as Awaited<ReturnType<typeof readImage>>);

    renderCollectionView();

    await waitFor(() => {
      expect(screen.getByText("(3)")).toBeInTheDocument();
    });

    fireEvent.keyDown(window, { key: "v", ctrlKey: true });

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("save_clipboard_image", {
        rgbaData: [1, 2, 3, 4],
        width: 1,
        height: 1,
        targetDir: "D:/refs",
      });
    });
  });

  it("closes the settings popover when clicking outside", async () => {
    renderCollectionView();

    await waitFor(() => {
      expect(screen.getByText("(3)")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Grid settings" }));
    expect(screen.getByText("Images per row")).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByText("Images per row")).not.toBeInTheDocument();
  });

  it("removes invalid active filters after the tag list changes", async () => {
    const { rerender } = renderCollectionView();

    await waitFor(() => {
      expect(screen.getByText("(3)")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Filter by Character" }));
    await waitFor(() => {
      expect(screen.getByText("(1)")).toBeInTheDocument();
    });

    rerender(
      <CollectionView
        collection={collection}
        onDelete={vi.fn()}
        tags={[]}
        imageTags={{}}
        onAddTag={vi.fn(() => true)}
        onDeleteTag={vi.fn()}
        onSetTagParent={vi.fn()}
        onAddTagToImage={vi.fn()}
        onRemoveTagFromImage={vi.fn()}
        moodboards={moodboards}
        moodboardImages={{}}
        onAddImageToMoodboard={vi.fn()}
        onCreateMoodboardWithImage={vi.fn()}
        onAddImagesToMoodboard={vi.fn(() => ({ added: 0, skipped: 0 }))}
        onCreateMoodboardWithImages={vi.fn()}
        onShowToast={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("(3)")).toBeInTheDocument();
    });
  });

  it("shows a warning toast when batch-adding only duplicates", async () => {
    const onShowToast = vi.fn();
    const onAddImagesToMoodboard = vi.fn(() => ({ added: 0, skipped: 1 }));

    renderCollectionView({ onShowToast, onAddImagesToMoodboard });

    await waitFor(() => {
      expect(screen.getByText("(3)")).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Add to moodboard" }));
    fireEvent.click(screen.getByRole("button", { name: "Board A" }));

    expect(onShowToast).toHaveBeenCalledWith("1 image already in moodboard", "warning");
  });

  it("shows a mixed batch toast when some selected images were already present", async () => {
    const onShowToast = vi.fn();
    const onAddImagesToMoodboard = vi.fn(() => ({ added: 1, skipped: 1 }));

    renderCollectionView({ onShowToast, onAddImagesToMoodboard });

    await waitFor(() => {
      expect(screen.getByText("(3)")).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    fireEvent.click(screen.getByRole("button", { name: "Add to moodboard" }));
    fireEvent.click(screen.getByRole("button", { name: "Board A" }));

    expect(onShowToast).toHaveBeenCalledWith("1 added, 1 already in moodboard", "success");
  });

  it("falls back to the original asset path when a thumbnail image fails to load", async () => {
    const { container } = renderCollectionView();

    await waitFor(() => {
      expect(screen.getByText("(3)")).toBeInTheDocument();
    });

    const image = container.querySelector(".collection-view__img") as HTMLImageElement;
    expect(image).toBeTruthy();

    fireEvent.error(image);

    expect(image.src).toContain("alpha.png");
    expect(image.src).not.toContain(".webp");
  });

  it("removes an image tag when its badge is clicked", async () => {
    const { container, onRemoveTagFromImage } = renderCollectionView();

    await waitFor(() => {
      expect(screen.getByText("(3)")).toBeInTheDocument();
    });

    fireEvent.click(container.querySelector(".collection-view__tag-badge") as Element);

    expect(onRemoveTagFromImage).toHaveBeenCalledWith("D:/refs/alpha.png", "tag-child");
  });

  it("shows an overflow badge when an image has more than three tags", async () => {
    renderCollectionView({
      tags: [
        ...tags,
        { id: "tag-extra-1", name: "Lighting", parentId: null },
        { id: "tag-extra-2", name: "Color", parentId: null },
      ],
      imageTags: {
        "D:/refs/alpha.png": ["tag-parent", "tag-child", "tag-other", "tag-extra-1", "tag-extra-2"],
      },
    });

    await waitFor(() => {
      expect(screen.getByText("(3)")).toBeInTheDocument();
    });

    expect(screen.getByText("+2")).toBeInTheDocument();
  });

  it("closes the single-image moodboard picker when clicking outside", async () => {
    const { container } = renderCollectionView();

    await waitFor(() => {
      expect(screen.getByText("(3)")).toBeInTheDocument();
    });

    fireEvent.click(container.querySelector(".collection-view__tile-action-btn") as Element);
    expect(screen.getByRole("button", { name: "Board A" })).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole("button", { name: "Board A" })).not.toBeInTheDocument();
  });

  it("lets the user clear the current batch selection", async () => {
    renderCollectionView();

    await waitFor(() => {
      expect(screen.getByText("(3)")).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    expect(screen.getByText("1 image selected")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));

    expect(screen.queryByText("1 image selected")).not.toBeInTheDocument();
  });

  it("cancels the image delete dialog without deleting the file", async () => {
    const { container } = renderCollectionView();

    await waitFor(() => {
      expect(screen.getByText("(3)")).toBeInTheDocument();
    });

    fireEvent.click(container.querySelectorAll(".collection-view__tile-action-btn")[1]);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(invokeMock).not.toHaveBeenCalledWith("delete_image", expect.anything());
  });

  it("cancels the collection delete dialog without deleting the collection", async () => {
    const { onDelete } = renderCollectionView();

    await waitFor(() => {
      expect(screen.getByText("(3)")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Delete collection" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onDelete).not.toHaveBeenCalled();
  });

  it("cancels creating a moodboard from a single image", async () => {
    const { container, onCreateMoodboardWithImage } = renderCollectionView();

    await waitFor(() => {
      expect(screen.getByText("(3)")).toBeInTheDocument();
    });

    fireEvent.click(container.querySelector(".collection-view__tile-action-btn") as Element);
    fireEvent.click(screen.getByRole("button", { name: "New moodboard" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCreateMoodboardWithImage).not.toHaveBeenCalled();
  });

  it("cancels creating a moodboard from the batch picker", async () => {
    const { onCreateMoodboardWithImages } = renderCollectionView();

    await waitFor(() => {
      expect(screen.getByText("(3)")).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Add to moodboard" }));
    fireEvent.click(screen.getByRole("button", { name: "New moodboard" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCreateMoodboardWithImages).not.toHaveBeenCalled();
    expect(screen.getByText("1 image selected")).toBeInTheDocument();
  });

  it("adds a dragged tag to an image tile", async () => {
    const { container, onAddTagToImage } = renderCollectionView();
    const dataTransfer = {
      types: ["application/tag-id"],
      getData: () => "tag-parent",
      setData: vi.fn(),
      dropEffect: "copy",
    };

    await waitFor(() => {
      expect(screen.getByText("(3)")).toBeInTheDocument();
    });

    const tile = container.querySelector(".collection-view__tile") as Element;
    fireEvent.dragOver(tile, { dataTransfer });
    fireEvent.drop(tile, { dataTransfer });

    expect(onAddTagToImage).toHaveBeenCalledWith("D:/refs/alpha.png", "tag-parent");
  });

  it("closes the import dialog when the user cancels it", async () => {
    openMock.mockResolvedValueOnce(["D:/incoming/cancelled.png"]);

    const { container } = renderCollectionView();

    await waitFor(() => {
      expect(screen.getByText("(3)")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Import images from disk" }));
    await screen.findByText("How would you like to import the selected files?");
    fireEvent.click(container.querySelector(".import-dialog__close") as Element);

    expect(screen.queryByText("How would you like to import the selected files?")).not.toBeInTheDocument();
    expect(invokeMock).not.toHaveBeenCalledWith("import_files", expect.anything());
  });

  it("updates the images-per-row setting from the slider", async () => {
    renderCollectionView();

    await waitFor(() => {
      expect(screen.getByText("(3)")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Grid settings" }));
    const slider = screen.getByRole("slider");
    fireEvent.change(slider, { target: { value: "4" } });

    expect((slider as HTMLInputElement).value).toBe("4");
    expect(localStorage.getItem("columnsPerRow")).toBe("4");
  });
});
