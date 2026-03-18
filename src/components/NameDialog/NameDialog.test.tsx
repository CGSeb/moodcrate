import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import NameDialog from "./NameDialog";

describe("NameDialog", () => {
  it("trims and confirms a valid name", () => {
    const onConfirm = vi.fn();

    render(
      <NameDialog
        open
        title="New Moodboard"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "  Board Name  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(onConfirm).toHaveBeenCalledWith("Board Name");
  });

  it("shows validation errors instead of confirming", () => {
    const onConfirm = vi.fn();

    render(
      <NameDialog
        open
        title="New Tag"
        validate={() => "Name already used"}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Duplicate" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(screen.getByText("Name already used")).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("ignores blank names and clears validation errors when typing again", () => {
    const onConfirm = vi.fn();

    render(
      <NameDialog
        open
        title="New Tag"
        validate={() => "Name already used"}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Duplicate" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(screen.getByText("Name already used")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Fixed" },
    });
    expect(screen.queryByText("Name already used")).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(onConfirm).not.toHaveBeenCalled();
  });
});
