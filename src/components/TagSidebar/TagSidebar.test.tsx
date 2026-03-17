import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TagSidebar from "./TagSidebar";
import type { Tag } from "../../App";

vi.mock("../Tooltip/Tooltip", () => ({
  default: ({ children }: { children: React.ReactElement }) => children,
}));

const tags: Tag[] = [
  { id: "tag-parent", name: "Character", parentId: null },
  { id: "tag-child", name: "Portrait", parentId: "tag-parent" },
  { id: "tag-other", name: "Environment", parentId: null },
];

function createDataTransfer() {
  const store = new Map<string, string>();

  return {
    setData: (type: string, value: string) => {
      store.set(type, value);
    },
    getData: (type: string) => store.get(type) ?? "",
    effectAllowed: "all",
    dropEffect: "move",
    types: ["application/tag-id"],
  };
}

function renderTagSidebar() {
  const onToggleFilter = vi.fn();
  const onAddTag = vi.fn(() => true);
  const onDeleteTag = vi.fn();
  const onSetTagParent = vi.fn();

  const view = render(
    <TagSidebar
      tags={tags}
      filterTagIds={new Set(["tag-child"])}
      onToggleFilter={onToggleFilter}
      onAddTag={onAddTag}
      onDeleteTag={onDeleteTag}
      onSetTagParent={onSetTagParent}
    />,
  );

  return {
    ...view,
    onToggleFilter,
    onAddTag,
    onDeleteTag,
    onSetTagParent,
  };
}

describe("TagSidebar", () => {
  it("toggles filtering for a tag", () => {
    const { onToggleFilter } = renderTagSidebar();

    fireEvent.click(screen.getByRole("button", { name: "Filter by Character" }));

    expect(onToggleFilter).toHaveBeenCalledWith("tag-parent");
  });

  it("creates a sub-tag and blocks duplicate names", () => {
    const { onAddTag } = renderTagSidebar();

    fireEvent.click(screen.getByRole("button", { name: "Add sub-tag to Character" }));
    fireEvent.change(screen.getByPlaceholderText("Tag name..."), {
      target: { value: "Portrait" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(screen.getByText("A tag with this name already exists")).toBeInTheDocument();
    expect(onAddTag).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText("Tag name..."), {
      target: { value: " Silhouette " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(onAddTag).toHaveBeenCalledWith("Silhouette", "tag-parent");
  });

  it("re-expands a collapsed parent after creating a sub-tag", () => {
    renderTagSidebar();

    fireEvent.click(screen.getByRole("button", { name: "Collapse" }));
    expect(screen.queryByText("Portrait")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add sub-tag to Character" }));
    fireEvent.change(screen.getByPlaceholderText("Tag name..."), {
      target: { value: "Silhouette" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(screen.getByText("Portrait")).toBeInTheDocument();
  });

  it("confirms tag deletion before removing it", () => {
    const { onDeleteTag } = renderTagSidebar();

    fireEvent.click(screen.getByRole("button", { name: "Delete tag Character" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]);

    expect(onDeleteTag).toHaveBeenCalledWith("tag-parent");
  });

  it("collapses and expands nested children", () => {
    renderTagSidebar();

    expect(screen.getByText("Portrait")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Collapse" }));
    expect(screen.queryByText("Portrait")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Expand" }));
    expect(screen.getByText("Portrait")).toBeInTheDocument();
  });

  it("reparents a tag by drag and drop", () => {
    const { onSetTagParent } = renderTagSidebar();
    const dataTransfer = createDataTransfer();
    const draggedItem = screen.getByText("Environment").closest("li");
    const targetItem = screen.getByText("Character").closest("li");

    expect(draggedItem).toBeTruthy();
    expect(targetItem).toBeTruthy();

    fireEvent.dragStart(draggedItem!, { dataTransfer });
    fireEvent.dragOver(targetItem!, { dataTransfer });
    fireEvent.drop(targetItem!, { dataTransfer });

    expect(onSetTagParent).toHaveBeenCalledWith("tag-other", "tag-parent");
  });

  it("re-expands a collapsed parent after a tag is dropped onto it", () => {
    const { onSetTagParent } = renderTagSidebar();
    const dataTransfer = createDataTransfer();
    const draggedItem = screen.getByText("Environment").closest("li");
    const targetItem = screen.getByText("Character").closest("li");

    fireEvent.click(screen.getByRole("button", { name: "Collapse" }));
    expect(screen.queryByText("Portrait")).not.toBeInTheDocument();

    fireEvent.dragStart(draggedItem!, { dataTransfer });
    fireEvent.dragOver(targetItem!, { dataTransfer });
    fireEvent.drop(targetItem!, { dataTransfer });

    expect(onSetTagParent).toHaveBeenCalledWith("tag-other", "tag-parent");
    expect(screen.getByText("Portrait")).toBeInTheDocument();
  });

  it("moves a tag back to the root drop zone", () => {
    const { onSetTagParent, container } = renderTagSidebar();
    const dataTransfer = createDataTransfer();

    fireEvent.dragOver(container.querySelector(".tag-sidebar__root-drop") as Element, { dataTransfer });
    fireEvent.drop(container.querySelector(".tag-sidebar__root-drop") as Element, {
      dataTransfer: {
        ...dataTransfer,
        getData: () => "tag-child",
      },
    });

    expect(onSetTagParent).toHaveBeenCalledWith("tag-child", null);
  });

  it("clears the drag target state after leaving a nested tag item", () => {
    const dataTransfer = createDataTransfer();
    renderTagSidebar();
    const draggedItem = screen.getByText("Environment").closest("li");
    const targetItem = screen.getByText("Character").closest("li");

    expect(draggedItem).toBeTruthy();
    expect(targetItem).toBeTruthy();

    fireEvent.dragStart(draggedItem!, { dataTransfer });
    fireEvent.dragOver(targetItem!, { dataTransfer });
    expect(targetItem).toHaveClass("tag-sidebar__item--drag-target");

    fireEvent.dragLeave(targetItem!, { relatedTarget: document.body });
    expect(targetItem).not.toHaveClass("tag-sidebar__item--drag-target");
  });

  it("does not create a cycle when dropping a parent onto its child", () => {
    const { onSetTagParent } = renderTagSidebar();
    const dataTransfer = createDataTransfer();
    const draggedItem = screen.getByText("Character").closest("li");
    const targetItem = screen.getByText("Portrait").closest("li");

    fireEvent.dragStart(draggedItem!, { dataTransfer });
    fireEvent.dragOver(targetItem!, { dataTransfer });
    fireEvent.drop(targetItem!, { dataTransfer });

    expect(onSetTagParent).not.toHaveBeenCalledWith("tag-parent", "tag-child");
  });

  it("shows the empty state when there are no tags", () => {
    render(
      <TagSidebar
        tags={[]}
        filterTagIds={new Set()}
        onToggleFilter={vi.fn()}
        onAddTag={vi.fn(() => true)}
        onDeleteTag={vi.fn()}
        onSetTagParent={vi.fn()}
      />,
    );

    expect(screen.getByText("No tags yet")).toBeInTheDocument();
  });

  it("opens and cancels the root create dialog", () => {
    renderTagSidebar();

    fireEvent.click(screen.getByRole("button", { name: "Create tag" }));
    expect(screen.getByText("New Tag")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("New Tag")).not.toBeInTheDocument();
  });

  it("opens and cancels the delete dialog", () => {
    renderTagSidebar();

    fireEvent.click(screen.getByRole("button", { name: "Delete tag Environment" }));
    expect(screen.getByText("Delete Tag")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Delete Tag")).not.toBeInTheDocument();
  });

  it("collapses the whole sidebar and re-expands it", () => {
    renderTagSidebar();

    fireEvent.click(screen.getByRole("button", { name: "Collapse tags" }));
    expect(screen.getByRole("button", { name: "Expand tags" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Expand tags" }));
    expect(screen.getByRole("button", { name: "Create tag" })).toBeInTheDocument();
  });

  it("clears the root drop highlight after dragging away", () => {
    const { container } = renderTagSidebar();
    const rootDrop = container.querySelector(".tag-sidebar__root-drop");
    const dataTransfer = createDataTransfer();

    expect(rootDrop).toBeTruthy();

    fireEvent.dragOver(rootDrop!, { dataTransfer });
    expect(rootDrop).toHaveClass("tag-sidebar__root-drop--active");

    fireEvent.dragLeave(rootDrop!);
    expect(rootDrop).not.toHaveClass("tag-sidebar__root-drop--active");
  });

  it("clears drag state when the drag ends", () => {
    const dataTransfer = createDataTransfer();
    renderTagSidebar();
    const draggedItem = screen.getByText("Environment").closest("li");
    const targetItem = screen.getByText("Character").closest("li");

    fireEvent.dragStart(draggedItem!, { dataTransfer });
    fireEvent.dragOver(targetItem!, { dataTransfer });
    expect(targetItem).toHaveClass("tag-sidebar__item--drag-target");

    fireEvent.dragEnd(draggedItem!);
    expect(targetItem).not.toHaveClass("tag-sidebar__item--drag-target");
  });
});
