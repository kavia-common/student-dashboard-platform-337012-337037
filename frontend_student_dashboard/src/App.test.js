import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders student dashboard shell", () => {
  render(<App />);
  expect(screen.getByText(/Student Dashboard/i)).toBeInTheDocument();
  expect(screen.getByText(/Profile/i)).toBeInTheDocument();
});
