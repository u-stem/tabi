import { afterEach, describe, expect, it } from "vitest";
import { isDialogOpen } from "../hotkeys";

describe("isDialogOpen", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("returns false when no dialog exists", () => {
    expect(isDialogOpen()).toBe(false);
  });

  it("returns true when a dialog element exists", () => {
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.appendChild(dialog);
    expect(isDialogOpen()).toBe(true);
  });

  it("returns false after dialog is removed", () => {
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.appendChild(dialog);
    expect(isDialogOpen()).toBe(true);

    document.body.removeChild(dialog);
    expect(isDialogOpen()).toBe(false);
  });
});
