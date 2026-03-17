import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ImageViewer from "./ImageViewer";

describe("ImageViewer", () => {
  it("closes on overlay click and Escape, but not on image click", () => {
    const onClose = vi.fn();

    const { container } = render(<ImageViewer src="asset://image.png" onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(container.querySelector(".image-viewer__img") as Element);
    fireEvent.keyDown(window, { key: "Enter" });
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(container.querySelector(".image-viewer") as Element);

    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
