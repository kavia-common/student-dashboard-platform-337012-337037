import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";

describe("Assignments CRUD flow", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  async function goToAssignments(user) {
    const sidebarNav = screen.getByRole("navigation", { name: /sections/i });
    await user.click(within(sidebarNav).getByRole("button", { name: /^assignments/i }));
    expect(screen.getByRole("heading", { name: /assignments/i })).toBeInTheDocument();
  }

  test("creates a new assignment and shows it in the table", async () => {
    const user = userEvent.setup();
    render(<App />);

    await goToAssignments(user);

    await user.click(screen.getByRole("button", { name: /create assignment/i }));

    const dialog = screen.getByRole("dialog", { name: /create assignment modal/i });
    await user.clear(within(dialog).getByLabelText(/assignment title/i));
    await user.type(within(dialog).getByLabelText(/assignment title/i), "New Test Assignment");

    // Keep class default; set points to known value.
    const points = within(dialog).getByLabelText(/assignment points/i);
    await user.clear(points);
    await user.type(points, "17");

    await user.click(within(dialog).getByRole("button", { name: /save assignment/i }));

    const table = screen.getByRole("table", { name: /assignments table/i });
    expect(within(table).getByText("New Test Assignment")).toBeInTheDocument();
    expect(within(table).getByText(/17 points/i)).toBeInTheDocument();
  });

  test("edits an assignment title via modal", async () => {
    const user = userEvent.setup();
    render(<App />);

    await goToAssignments(user);

    const table = screen.getByRole("table", { name: /assignments table/i });
    const firstAssignmentTitle = within(table).getAllByRole("row")[1].querySelector("strong")
      ?.textContent;

    // Open edit for first assignment using its accessible button label.
    const editButtons = screen.getAllByRole("button", { name: /edit assignment/i });
    await user.click(editButtons[0]);

    const dialog = screen.getByRole("dialog", { name: /edit assignment modal/i });
    const titleInput = within(dialog).getByLabelText(/assignment title/i);

    await user.clear(titleInput);
    await user.type(titleInput, "Edited Assignment Title");

    await user.click(within(dialog).getByRole("button", { name: /save assignment/i }));

    expect(within(table).getByText("Edited Assignment Title")).toBeInTheDocument();
    if (firstAssignmentTitle) {
      expect(within(table).queryByText(firstAssignmentTitle)).not.toBeInTheDocument();
    }
  });

  test("deletes an assignment from the edit modal", async () => {
    const user = userEvent.setup();
    render(<App />);

    await goToAssignments(user);

    const table = screen.getByRole("table", { name: /assignments table/i });
    const firstRow = within(table).getAllByRole("row")[1];
    const title = firstRow.querySelector("strong")?.textContent;
    expect(title).toBeTruthy();

    const editButtons = screen.getAllByRole("button", { name: /edit assignment/i });
    await user.click(editButtons[0]);

    const dialog = screen.getByRole("dialog", { name: /edit assignment modal/i });
    await user.click(within(dialog).getByRole("button", { name: /delete assignment/i }));

    // Assignment should no longer be present.
    expect(within(table).queryByText(title)).not.toBeInTheDocument();
  });

  test("shows validation error when creating assignment with too-short title", async () => {
    const user = userEvent.setup();
    render(<App />);

    await goToAssignments(user);

    await user.click(screen.getByRole("button", { name: /create assignment/i }));
    const dialog = screen.getByRole("dialog", { name: /create assignment modal/i });

    const titleInput = within(dialog).getByLabelText(/assignment title/i);
    await user.clear(titleInput);
    await user.type(titleInput, "A"); // 1 char => invalid

    await user.click(within(dialog).getByRole("button", { name: /save assignment/i }));

    expect(
      within(dialog).getByText(/please provide an assignment title/i)
    ).toBeInTheDocument();
  });
});
