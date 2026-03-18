import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ImportDialog from "./ImportDialog";

describe("ImportDialog", () => {
  it("passes the selected mode and remember flag on confirm", () => {
    const onConfirm = vi.fn();

    render(
      <ImportDialog
        open
        fileCount={3}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /Move/i }));

    expect(onConfirm).toHaveBeenCalledWith("move", true);
  });

  it("uses copy mode by default and cancels from overlay clicks", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    const { container } = render(
      <ImportDialog
        open
        fileCount={1}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Copy/i }));
    expect(onConfirm).toHaveBeenCalledWith("copy", false);

    fireEvent.click(container.querySelector(".import-dialog__overlay") as HTMLDivElement);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
