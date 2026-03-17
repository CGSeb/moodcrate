import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import MoodboardView from "./MoodboardView";
import type { MoodboardImage, MoodboardText } from "../../App";

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: vi.fn((path: string) => `asset://${path}`),
}));

function renderMoodboardView({
  initialImages = [
    { id: "img-1", path: "D:/refs/alpha.png", x: 40, y: 50, width: 200, height: 200 },
  ] satisfies MoodboardImage[],
  initialTexts = [
    { id: "txt-1", text: "Notes", x: 120, y: 140, width: 200, height: 80, fontSize: 14 },
  ] satisfies MoodboardText[],
  initialSelectedIds = ["img-1"],
}: {
  initialImages?: MoodboardImage[];
  initialTexts?: MoodboardText[];
  initialSelectedIds?: string[];
} = {}) {
  const onDelete = vi.fn();
  const onRemoveImage = vi.fn();
  const onUpdateImage = vi.fn();
  const onAddText = vi.fn();
  const onRemoveText = vi.fn();
  const onUpdateText = vi.fn();
  const onConsumeSelection = vi.fn();

  function Wrapper() {
    const [images, setImages] = useState(initialImages);
    const [texts, setTexts] = useState(initialTexts);

    return (
      <MoodboardView
        moodboard={{ id: "mb-1", name: "Board One" }}
        images={images}
        texts={texts}
        onDelete={onDelete}
        onRemoveImage={(imageId) => {
          onRemoveImage(imageId);
          setImages((prev) => prev.filter((image) => image.id !== imageId));
        }}
        onUpdateImage={(imageId, updates) => {
          onUpdateImage(imageId, updates);
          setImages((prev) => prev.map((image) => (
            image.id === imageId ? { ...image, ...updates } : image
          )));
        }}
        onAddText={onAddText}
        onRemoveText={(textId) => {
          onRemoveText(textId);
          setTexts((prev) => prev.filter((text) => text.id !== textId));
        }}
        onUpdateText={(textId, updates) => {
          onUpdateText(textId, updates);
          setTexts((prev) => prev.map((text) => (
            text.id === textId ? { ...text, ...updates } : text
          )));
        }}
        initialSelectedIds={initialSelectedIds}
        onConsumeSelection={onConsumeSelection}
      />
    );
  }

  return {
    ...render(<Wrapper />),
    onDelete,
    onRemoveImage,
    onUpdateImage,
    onAddText,
    onRemoveText,
    onUpdateText,
    onConsumeSelection,
  };
}

describe("MoodboardView", () => {
  it("removes an image from the moodboard", () => {
    const { onRemoveImage } = renderMoodboardView();

    fireEvent.click(screen.getByRole("button", { name: "Remove from moodboard" }));

    expect(onRemoveImage).toHaveBeenCalledWith("img-1");
    expect(screen.queryByRole("button", { name: "Remove from moodboard" })).not.toBeInTheDocument();
  });

  it("edits text content and applies a heading prefix from the toolbar", () => {
    const { onUpdateText } = renderMoodboardView();

    fireEvent.doubleClick(screen.getByText("Notes"));

    const textarea = screen.getByRole("textbox");
    textarea.setSelectionRange(0, 0);
    fireEvent.click(screen.getByTitle("Heading 1"));

    expect(onUpdateText).toHaveBeenCalledWith("txt-1", { text: "# Notes" });
    expect(screen.getByRole("textbox")).toHaveValue("# Notes");
  });

  it("removes an empty text box when editing ends", () => {
    const { onRemoveText } = renderMoodboardView({
      initialImages: [],
      initialTexts: [
        { id: "txt-empty", text: "", x: 100, y: 120, width: 200, height: 80, fontSize: 14 },
      ],
    });

    fireEvent.doubleClick(screen.getByText("Double-click to edit..."));
    fireEvent.blur(screen.getByRole("textbox"));

    expect(onRemoveText).toHaveBeenCalledWith("txt-empty");
    expect(screen.queryByText("Double-click to edit...")).not.toBeInTheDocument();
  });

  it("clears the current selection when Escape is pressed", () => {
    const { container, onConsumeSelection } = renderMoodboardView();

    expect(onConsumeSelection).toHaveBeenCalledTimes(1);
    expect(container.querySelector("[data-img-id='img-1']")).toHaveClass("moodboard-view__item--selected");

    fireEvent.keyDown(window, { key: "Escape" });

    expect(container.querySelector("[data-img-id='img-1']")).not.toHaveClass("moodboard-view__item--selected");
  });

  it("confirms moodboard deletion before calling onDelete", () => {
    const { onDelete } = renderMoodboardView();

    fireEvent.click(screen.getByRole("button", { name: "Delete moodboard" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("cancels moodboard deletion without calling onDelete", () => {
    const { onDelete } = renderMoodboardView();

    fireEvent.click(screen.getByRole("button", { name: "Delete moodboard" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onDelete).not.toHaveBeenCalled();
  });

  it("adds a text box at the canvas center", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "new-text-id" });
    const { container, onAddText } = renderMoodboardView({
      initialImages: [],
      initialTexts: [],
    });
    const canvas = container.querySelector(".moodboard-view__canvas") as HTMLDivElement;

    expect(canvas).toBeTruthy();

    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      width: 800,
      height: 600,
      top: 0,
      right: 800,
      bottom: 600,
      left: 0,
      toJSON: () => ({}),
    });

    fireEvent.click(screen.getByRole("button", { name: /Add Text/i }));

    expect(onAddText).toHaveBeenCalledWith("new-text-id", 300, 260);
  });

  it("fits the existing content into view when a moodboard opens", async () => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    const rectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function () {
      if ((this as HTMLElement).classList.contains("moodboard-view__canvas")) {
        return {
          x: 0,
          y: 0,
          width: 800,
          height: 600,
          top: 0,
          right: 800,
          bottom: 600,
          left: 0,
          toJSON: () => ({}),
        };
      }

      return {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        toJSON: () => ({}),
      };
    });

    try {
      const { container } = renderMoodboardView();
      const canvas = container.querySelector(".moodboard-view__canvas") as HTMLDivElement;

      await waitFor(() => {
        expect(canvas.style.backgroundPosition).not.toBe("0px 0px");
        expect(canvas.style.backgroundSize).not.toBe("24px 24px");
      });
    } finally {
      rectSpy.mockRestore();
    }
  });

  it("removes an empty text box when Escape is pressed during editing", () => {
    const { onRemoveText } = renderMoodboardView({
      initialImages: [],
      initialTexts: [
        { id: "txt-empty", text: "", x: 100, y: 120, width: 200, height: 80, fontSize: 14 },
      ],
    });

    fireEvent.doubleClick(screen.getByText("Double-click to edit..."));
    fireEvent.keyDown(window, { key: "Escape" });

    expect(onRemoveText).toHaveBeenCalledWith("txt-empty");
  });

  it("resizes an image by dragging the resize handle", () => {
    const { container, onUpdateImage } = renderMoodboardView();
    const resizeHandle = container.querySelector(".moodboard-view__item-resize") as HTMLDivElement;

    expect(resizeHandle).toBeTruthy();

    fireEvent.mouseDown(resizeHandle, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.mouseMove(window, { clientX: 150, clientY: 100 });

    expect(onUpdateImage).toHaveBeenCalledWith("img-1", { width: 250 });
  });

  it("resizes a text box in both width and height", () => {
    const { container, onUpdateText } = renderMoodboardView();
    const resizeHandles = container.querySelectorAll(".moodboard-view__item-resize");

    fireEvent.mouseDown(resizeHandles[1], { button: 0, clientX: 100, clientY: 100 });
    fireEvent.mouseMove(window, { clientX: 150, clientY: 140 });

    expect(onUpdateText).toHaveBeenCalledWith("txt-1", { width: 250, height: 120 });
  });

  it("ignores non-left clicks for item dragging and resizing", () => {
    const { container, onUpdateImage, onUpdateText } = renderMoodboardView();
    const imageItem = container.querySelector("[data-img-id='img-1']") as Element;
    const resizeHandles = container.querySelectorAll(".moodboard-view__item-resize");

    fireEvent.mouseDown(imageItem, { button: 1, clientX: 100, clientY: 100 });
    fireEvent.mouseDown(resizeHandles[0], { button: 1, clientX: 100, clientY: 100 });
    fireEvent.mouseDown(resizeHandles[1], { button: 1, clientX: 100, clientY: 100 });
    fireEvent.mouseMove(window, { clientX: 150, clientY: 150 });

    expect(onUpdateImage).not.toHaveBeenCalledWith("img-1", expect.objectContaining({ width: expect.any(Number) }));
    expect(onUpdateText).not.toHaveBeenCalledWith("txt-1", expect.objectContaining({ width: expect.any(Number) }));
  });

  it("applies a bullet list prefix from the text toolbar", () => {
    const { onUpdateText } = renderMoodboardView();

    fireEvent.doubleClick(screen.getByText("Notes"));

    const textarea = screen.getByRole("textbox");
    textarea.setSelectionRange(0, 0);
    fireEvent.click(screen.getByTitle("Bullet list"));

    expect(onUpdateText).toHaveBeenCalledWith("txt-1", { text: "- Notes" });
    expect(screen.getByRole("textbox")).toHaveValue("- Notes");
  });

  it("changes text font size from the floating controls", () => {
    const { onUpdateText } = renderMoodboardView();

    fireEvent.doubleClick(screen.getByText("Notes"));
    fireEvent.click(screen.getByRole("button", { name: "+" }));

    expect(onUpdateText).toHaveBeenCalledWith("txt-1", { fontSize: 16 });
  });

  it("zooms the canvas with the mouse wheel", () => {
    const { container } = renderMoodboardView();
    const canvas = container.querySelector(".moodboard-view__canvas") as HTMLDivElement;

    expect(canvas.style.backgroundSize).toBe("24px 24px");

    fireEvent.wheel(canvas, { deltaY: -100, clientX: 200, clientY: 150 });

    expect(canvas.style.backgroundSize).not.toBe("24px 24px");
  });

  it("pans the canvas with the middle mouse button", () => {
    const { container } = renderMoodboardView();
    const canvas = container.querySelector(".moodboard-view__canvas") as HTMLDivElement;

    expect(canvas.style.backgroundPosition).toBe("0px 0px");

    fireEvent.mouseDown(canvas, { button: 1, clientX: 20, clientY: 20 });
    fireEvent.mouseMove(window, { clientX: 60, clientY: 80 });

    expect(canvas.style.backgroundPosition).toBe("40px 60px");
  });

  it("selects items with a marquee drag", () => {
    const { container } = renderMoodboardView({
      initialSelectedIds: [],
    });
    const canvas = container.querySelector(".moodboard-view__canvas") as HTMLDivElement;

    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      width: 800,
      height: 600,
      top: 0,
      right: 800,
      bottom: 600,
      left: 0,
      toJSON: () => ({}),
    });

    fireEvent.mouseDown(canvas, { button: 0, clientX: 0, clientY: 0 });
    fireEvent.mouseMove(window, { clientX: 400, clientY: 400 });
    fireEvent.mouseUp(window, { button: 0, clientX: 400, clientY: 400 });

    expect(container.querySelector("[data-img-id='img-1']")).toHaveClass("moodboard-view__item--selected");
    expect(container.querySelector(".moodboard-view__text-item")).toHaveClass("moodboard-view__item--selected");
  });

  it("drags multiple selected items together", () => {
    const { container, onUpdateImage, onUpdateText } = renderMoodboardView({
      initialSelectedIds: ["img-1", "txt-1"],
    });

    fireEvent.mouseDown(container.querySelector("[data-img-id='img-1']") as Element, {
      button: 0,
      clientX: 100,
      clientY: 100,
    });
    fireEvent.mouseMove(window, { clientX: 140, clientY: 130 });

    expect(onUpdateImage).toHaveBeenCalledWith("img-1", { x: 80, y: 80 });
    expect(onUpdateText).toHaveBeenCalledWith("txt-1", { x: 160, y: 170 });
  });

  it("shows the empty-state message when the moodboard has no content", () => {
    renderMoodboardView({
      initialImages: [],
      initialTexts: [],
      initialSelectedIds: [],
    });

    expect(screen.getByText(/This moodboard is empty/i)).toBeInTheDocument();
  });

  it("toggles selection with shift-click and clears it with a tiny marquee", () => {
    const { container } = renderMoodboardView({
      initialSelectedIds: [],
    });
    const canvas = container.querySelector(".moodboard-view__canvas") as HTMLDivElement;

    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      width: 800,
      height: 600,
      top: 0,
      right: 800,
      bottom: 600,
      left: 0,
      toJSON: () => ({}),
    });

    fireEvent.mouseDown(container.querySelector("[data-img-id='img-1']") as Element, {
      button: 0,
      shiftKey: true,
      clientX: 100,
      clientY: 100,
    });
    expect(container.querySelector("[data-img-id='img-1']")).toHaveClass("moodboard-view__item--selected");

    fireEvent.mouseDown(canvas, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.mouseMove(window, { clientX: 12, clientY: 12 });
    fireEvent.mouseUp(window, { button: 0, clientX: 12, clientY: 12 });

    expect(container.querySelector("[data-img-id='img-1']")).not.toHaveClass("moodboard-view__item--selected");
  });

  it("can remove an existing heading prefix", () => {
    const { onUpdateText } = renderMoodboardView({
      initialTexts: [
        { id: "txt-1", text: "# Notes", x: 120, y: 140, width: 200, height: 80, fontSize: 14 },
      ],
    });

    fireEvent.doubleClick(screen.getByText("Notes"));
    const textarea = screen.getByRole("textbox");
    textarea.setSelectionRange(0, 0);
    fireEvent.click(screen.getByTitle("Heading 1"));

    expect(onUpdateText).toHaveBeenCalledWith("txt-1", { text: "Notes" });
  });

  it("marks the heading 2 control as active for the current line prefix", () => {
    renderMoodboardView({
      initialTexts: [
        { id: "txt-1", text: "## Notes", x: 120, y: 140, width: 200, height: 80, fontSize: 14 },
      ],
    });

    fireEvent.doubleClick(screen.getByText("Notes"));
    const textarea = screen.getByRole("textbox");
    textarea.setSelectionRange(0, 0);
    fireEvent.select(textarea);

    expect(screen.getByTitle("Heading 2")).toHaveClass("moodboard-view__text-font-btn--active");
  });

  it("updates text size downward and removes text from the toolbar button", () => {
    const { onUpdateText, onRemoveText } = renderMoodboardView();

    fireEvent.doubleClick(screen.getByText("Notes"));
    fireEvent.click(screen.getByRole("button", {
      name: (name) => name.length === 1 && name.charCodeAt(0) === 8722,
    }));
    expect(onUpdateText).toHaveBeenCalledWith("txt-1", { fontSize: 12 });

    fireEvent.click(screen.getByRole("button", { name: "Remove text" }));
    expect(onRemoveText).toHaveBeenCalledWith("txt-1");
  });
});
