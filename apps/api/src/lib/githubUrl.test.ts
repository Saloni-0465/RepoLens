import { describe, expect, it } from "vitest";
import { parseGithubUrl } from "./githubUrl.js";

describe("parseGithubUrl", () => {
  it("accepts a canonical public URL", () => {
    expect(parseGithubUrl("https://github.com/pallets/flask")).toEqual({
      owner: "pallets",
      repo: "flask",
      fullName: "pallets/flask",
      url: "https://github.com/pallets/flask",
    });
  });

  it("strips .git and trailing slash", () => {
    expect(parseGithubUrl("https://github.com/expressjs/express.git/")).toMatchObject({
      fullName: "expressjs/express",
    });
  });

  it("rejects non-GitHub URLs", () => {
    expect(parseGithubUrl("https://gitlab.com/foo/bar")).toBeNull();
  });
});
