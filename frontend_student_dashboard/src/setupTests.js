/* eslint-disable no-undef */
// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom";

/**
 * JSDOM does not implement some browser download APIs.
 * Provide lightweight, spy-able shims so tests can validate CSV download behavior.
 */
beforeAll(() => {
  // JSDOM may not define these functions at all. Define them so jest.spyOn works.
  if (typeof URL !== "undefined" && typeof URL.createObjectURL !== "function") {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: () => "blob:jsdom-mock",
    });
  }

  if (typeof URL !== "undefined" && typeof URL.revokeObjectURL !== "function") {
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: () => {},
    });
  }
});
