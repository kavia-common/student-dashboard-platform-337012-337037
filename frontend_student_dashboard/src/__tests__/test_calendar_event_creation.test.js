import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App";

describe("Calendar event creation flow", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  async function goToCalendar(user) {
    const sidebarNav = screen.getByRole("navigation", { name: /sections/i });
    await user.click(within(sidebarNav).getByRole("button", { name: /^calendar/i }));
    expect(screen.getByRole("heading", { name: /calendar/i })).toBeInTheDocument();
  }

  test("creates a new event from day details panel and shows it in selected day list", async () => {
    const user = userEvent.setup();
    render(<App />);

    await goToCalendar(user);

    // Select today to ensure Day details has a concrete day
    await user.click(screen.getByRole("button", { name: /go to today/i }));

    // Create event
    await user.click(screen.getByRole("button", { name: /create event/i }));

    const dialog = screen.getByRole("dialog", { name: /create event modal/i });

    await user.type(within(dialog).getByLabelText(/event title/i), "My New Event");
    await user.selectOptions(within(dialog).getByLabelText(/event type/i), "Exam");
    await user.clear(within(dialog).getByLabelText(/event time/i));
    await user.type(within(dialog).getByLabelText(/event time/i), "10:30");

    await user.click(within(dialog).getByRole("button", { name: /save event/i }));

    const list = screen.getByLabelText(/selected day events list/i);
    expect(within(list).getByText("My New Event")).toBeInTheDocument();
    expect(within(list).getAllByText("Exam")[0]).toBeInTheDocument();
  });

  test("shows validation error when saving event without a title", async () => {
    const user = userEvent.setup();
    render(<App />);

    await goToCalendar(user);
    await user.click(screen.getByRole("button", { name: /go to today/i }));
    await user.click(screen.getByRole("button", { name: /create event/i }));

    const dialog = screen.getByRole("dialog", { name: /create event modal/i });
    await user.click(within(dialog).getByRole("button", { name: /save event/i }));

    expect(within(dialog).getByText(/please provide a short event title/i)).toBeInTheDocument();
  });
});
