import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "./HomePage";
import { open } from "@tauri-apps/plugin-dialog";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

const openMock = vi.mocked(open);

describe("HomePage", () => {
  beforeEach(() => {
    openMock.mockReset();
  });

  it("shows favorites and lets the user open them", () => {
    const onSelectCollection = vi.fn();
    const onSelectMoodboard = vi.fn();

    render(
      <HomePage
        collections={[{ name: "Refs", path: "D:/refs" }]}
        moodboards={[{ id: "mb-1", name: "Board One" }]}
        favorites={["D:/refs", "mb-1"]}
        onAddCollection={vi.fn()}
        onAddMoodboard={vi.fn()}
        onSelectCollection={onSelectCollection}
        onSelectMoodboard={onSelectMoodboard}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /RefsCollection/i }));
    fireEvent.click(screen.getByRole("button", { name: /Board OneMoodboard/i }));

    expect(onSelectCollection).toHaveBeenCalledWith({ name: "Refs", path: "D:/refs" });
    expect(onSelectMoodboard).toHaveBeenCalledWith({ id: "mb-1", name: "Board One" });
  });

  it("creates a collection after choosing a folder and naming it", async () => {
    const onAddCollection = vi.fn();
    openMock.mockResolvedValueOnce("D:/refs");

    render(
      <HomePage
        collections={[]}
        moodboards={[]}
        favorites={[]}
        onAddCollection={onAddCollection}
        onAddMoodboard={vi.fn()}
        onSelectCollection={vi.fn()}
        onSelectMoodboard={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Create a collection/i }));
    fireEvent.change(await screen.findByPlaceholderText("Collection name…"), {
      target: { value: "My Refs" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(onAddCollection).toHaveBeenCalledWith({ name: "My Refs", path: "D:/refs" });
    });
  });

  it("creates a moodboard from the dialog", () => {
    const onAddMoodboard = vi.fn();

    render(
      <HomePage
        collections={[]}
        moodboards={[]}
        favorites={[]}
        onAddCollection={vi.fn()}
        onAddMoodboard={onAddMoodboard}
        onSelectCollection={vi.fn()}
        onSelectMoodboard={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Create a moodboard/i }));
    fireEvent.change(screen.getByPlaceholderText("Moodboard name…"), {
      target: { value: "Fresh Board" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(onAddMoodboard).toHaveBeenCalledWith("Fresh Board");
  });

  it("does nothing when collection creation is cancelled or no folder is chosen", async () => {
    const onAddCollection = vi.fn();
    openMock.mockResolvedValueOnce(null);

    render(
      <HomePage
        collections={[]}
        moodboards={[]}
        favorites={[]}
        onAddCollection={onAddCollection}
        onAddMoodboard={vi.fn()}
        onSelectCollection={vi.fn()}
        onSelectMoodboard={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Create a collection/i }));
    expect(screen.queryByText("New Collection")).not.toBeInTheDocument();

    openMock.mockResolvedValueOnce("D:/refs");
    fireEvent.click(screen.getByRole("button", { name: /Create a collection/i }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(onAddCollection).not.toHaveBeenCalled();
  });

  it("closes the moodboard dialog on cancel", () => {
    render(
      <HomePage
        collections={[]}
        moodboards={[]}
        favorites={[]}
        onAddCollection={vi.fn()}
        onAddMoodboard={vi.fn()}
        onSelectCollection={vi.fn()}
        onSelectMoodboard={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Create a moodboard/i }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByText("New Moodboard")).not.toBeInTheDocument();
  });
});
