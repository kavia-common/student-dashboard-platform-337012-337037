import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";
import { THEME_STORAGE_KEY } from "../utils/theme";

const STORAGE_PREFIX = "student_dashboard:";

function storageKey(key) {
  return `${STORAGE_PREFIX}${key}`;
}

describe("Theme toggle persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
    // JSDOM may not have this set; ensure clean slate.
    document.documentElement.dataset.theme = "";
  });

  test("toggles dark mode and persists preference to localStorage", async () => {
    const user = userEvent.setup();
    render(<App />);

    // Default should be applied after first effect runs.
    await waitFor(() => {
      expect(["light", "dark"]).toContain(document.documentElement.dataset.theme);
    });

    const toggleThemeBtn = screen.getByRole("button", { name: /toggle dark mode/i });

    const before = document.documentElement.dataset.theme;
    await user.click(toggleThemeBtn);

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).not.toBe(before);
    });

    const after = document.documentElement.dataset.theme;
    expect(window.localStorage.getItem(storageKey(THEME_STORAGE_KEY))).toBe(
      JSON.stringify(after)
    );
  });

  test("loads initial theme from persisted localStorage value", async () => {
    window.localStorage.setItem(storageKey(THEME_STORAGE_KEY), JSON.stringify("dark"));

    render(<App />);

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe("dark");
    });
  });
});
