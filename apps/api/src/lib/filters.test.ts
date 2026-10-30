import { describe, expect, it } from "vitest";
import { fileRole, isSourceOrManifest } from "./filters.js";

describe("README file classification", () => {
  it("includes reStructuredText repository READMEs as documentation", () => {
    expect(fileRole("README.rst")).toBe("docs");
    expect(isSourceOrManifest("README.rst")).toBe(true);
  });
});
