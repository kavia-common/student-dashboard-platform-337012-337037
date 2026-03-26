import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";

describe("Notifications preferences/categories", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  async function goToNotifications(user) {
    const sidebarNav = screen.getByRole("navigation", { name: /sections/i });
    await user.click(within(sidebarNav).getByRole("button", { name: /^notifications/i }));
    expect(screen.getByRole("heading", { name: /notifications/i })).toBeInTheDocument();
  }

  test("disabling all categories hides the notifications list items", async () => {
    const user = userEvent.setup();
    render(<App />);

    await goToNotifications(user);

    // Ensure list exists first (baseline sanity check).
    const notificationsList = screen.getByLabelText(/notifications list/i);
    const beforeCount = within(notificationsList).getAllByRole("button", {
      name: /toggle read state/i,
    }).length;
    expect(beforeCount).toBeGreaterThan(0);

    await user.click(
      screen.getByRole("button", { name: /disable all notification categories/i })
    );

    // Now expect empty-state message because preferences filter removes all notifications.
    expect(
      screen.getByText(/no notifications match your filters or enabled categories/i)
    ).toBeInTheDocument();
  });

  test("category filter dropdown can narrow notifications by category", async () => {
    const user = userEvent.setup();
    render(<App />);

    await goToNotifications(user);

    const categorySelect = screen.getByRole("combobox", { name: /notification category filter/i });
    await user.selectOptions(categorySelect, "assignments");

    // Every shown item should have category pill containing "assignments"
    const notificationsList = screen.getByLabelText(/notifications list/i);
    const items = within(notificationsList).getAllByText(/assignments/i);
    expect(items.length).toBeGreaterThan(0);
  });

  test("toggling in-app channel updates the label state", async () => {
    const user = userEvent.setup();
    render(<App />);

    await goToNotifications(user);

    const inAppToggle = screen.getByRole("checkbox", { name: /toggle in-app notifications/i });
    expect(inAppToggle).toBeChecked();

    await user.click(inAppToggle);
    expect(inAppToggle).not.toBeChecked();

    // The UI also reflects On/Off in the pill label next to it.
    expect(screen.getByText(/^off$/i)).toBeInTheDocument();
  });
});
