import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { CafeProvider } from "../state/CafeState";
import { MakePage } from "./MakePage";

describe("MakePage", () => {
  it("requires one selection and allows several", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/make"]}>
        <CafeProvider>
          <Routes><Route path="/make" element={<MakePage />} /></Routes>
        </CafeProvider>
      </MemoryRouter>,
    );
    const continueButton = screen.getByRole("button", { name: "finish packing" });
    expect(continueButton).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /Latte art/i }));
    await user.click(screen.getByRole("button", { name: /Typed letter/i }));
    expect(screen.getAllByRole("button", { name: "make" })).toHaveLength(2);
    expect(continueButton).toBeEnabled();
  });
});
