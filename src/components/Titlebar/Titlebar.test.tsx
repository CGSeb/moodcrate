import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const startDragging = vi.fn().mockResolvedValue(undefined);
const minimize = vi.fn().mockResolvedValue(undefined);
const toggleMaximize = vi.fn().mockResolvedValue(undefined);
const close = vi.fn().mockResolvedValue(undefined);
const isMaximized = vi.fn();
const onResized = vi.fn();

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    startDragging,
    minimize,
    toggleMaximize,
    close,
    isMaximized,
    onResized,
  }),
}));

describe("Titlebar", () => {
  beforeEach(() => {
    startDragging.mockClear();
    minimize.mockClear();
    toggleMaximize.mockClear();
    close.mockClear();
    isMaximized.mockReset();
    onResized.mockReset();
    isMaximized.mockResolvedValue(false);
    onResized.mockResolvedValue(vi.fn());
  });

  it("handles drag and window control actions", async () => {
    const { default: Titlebar } = await import("./Titlebar");
    const { container } = render(<Titlebar />);

    fireEvent.mouseDown(container.querySelector(".titlebar") as Element, { button: 0 });
    fireEvent.click(screen.getByRole("button", { name: "Minimize" }));
    fireEvent.click(screen.getByRole("button", { name: "Maximize" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(startDragging).toHaveBeenCalledTimes(1);
    expect(minimize).toHaveBeenCalledTimes(1);
    expect(toggleMaximize).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("updates the maximize label after a resize event", async () => {
    let resizeHandler: (() => void) | undefined;
    isMaximized.mockResolvedValueOnce(false).mockResolvedValue(true);
    onResized.mockImplementation(async (handler: () => void) => {
      resizeHandler = handler;
      return vi.fn();
    });

    const { default: Titlebar } = await import("./Titlebar");
    render(<Titlebar />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Maximize" })).toBeInTheDocument();
    });

    resizeHandler?.();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Restore" })).toBeInTheDocument();
    });
  });

  it("ignores non-left clicks and clicks inside the window controls", async () => {
    const { default: Titlebar } = await import("./Titlebar");
    const { container } = render(<Titlebar />);

    fireEvent.mouseDown(container.querySelector(".titlebar") as Element, { button: 1 });
    fireEvent.mouseDown(container.querySelector(".titlebar__controls") as Element, { button: 0 });

    expect(startDragging).not.toHaveBeenCalled();
  });

  it("swallows start-dragging failures", async () => {
    startDragging.mockRejectedValueOnce(new Error("drag failed"));
    const { default: Titlebar } = await import("./Titlebar");
    const { container } = render(<Titlebar />);

    fireEvent.mouseDown(container.querySelector(".titlebar") as Element, { button: 0 });

    await waitFor(() => {
      expect(startDragging).toHaveBeenCalledTimes(1);
    });
  });
});
