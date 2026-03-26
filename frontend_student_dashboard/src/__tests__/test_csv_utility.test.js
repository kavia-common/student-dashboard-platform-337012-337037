import { downloadTextFile, toCsvString } from "../utils/csv";

describe("CSV export utility", () => {
  test("toCsvString renders headers + rows with CRLF and proper escaping", () => {
    const csv = toCsvString({
      headers: ["Name", "Note"],
      rows: [
        ["Alice", "Hello"],
        ["Bob", 'He said "wow"'],
        ["Carol", "Line1\nLine2"],
        ["Dan", "a,b,c"],
        ["Eve", null],
      ],
    });

    // Ends with CRLF
    expect(csv.endsWith("\r\n")).toBe(true);

    // Header row
    expect(csv).toContain("Name,Note\r\n");

    // Quote escaping
    expect(csv).toContain('Bob,"He said ""wow"""\r\n');

    // Newline cell escaping
    expect(csv).toContain('Carol,"Line1\nLine2"\r\n');

    // Comma cell escaping
    expect(csv).toContain('Dan,"a,b,c"\r\n');

    // Null becomes empty
    expect(csv).toContain("Eve,\r\n");
  });

  test("downloadTextFile creates an anchor, clicks it, and revokes blob URL", () => {
    const createObjectURLSpy = jest
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:mock");
    const revokeObjectURLSpy = jest.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    const clickMock = jest.fn();
    const removeMock = jest.fn();

    const createElementSpy = jest
      .spyOn(document, "createElement")
      .mockImplementation((tagName) => {
        if (tagName === "a") {
          return {
            href: "",
            download: "",
            click: clickMock,
            remove: removeMock,
          };
        }
        // Fallback to real behavior for other tags
        return document.createElement(tagName);
      });

    const appendChildSpy = jest.spyOn(document.body, "appendChild").mockImplementation(() => {});

    downloadTextFile({ filename: "test.csv", content: "a,b\r\n" });

    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    expect(appendChildSpy).toHaveBeenCalledTimes(1);
    expect(clickMock).toHaveBeenCalledTimes(1);
    expect(removeMock).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:mock");

    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
    createElementSpy.mockRestore();
    appendChildSpy.mockRestore();
  });
});
