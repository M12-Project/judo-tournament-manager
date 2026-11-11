import { describe, expect, it } from "vitest";
import { matchesGroupSearch } from "./groupSearch";

describe("matchesGroupSearch", () => {
  it.each([
    ["U11 - weiblich", "U11-Weiblich"],
    ["U15 - männlich", "U15- männlich"],
    ["U13 - weiblich", "u13 WEIBLICH"],
    ["U15 - männlich", "männlich"],
  ])("matches %s with query %s", (groupName, query) => {
    expect(matchesGroupSearch(groupName, query)).toBe(true);
  });

  it("rejects a query for another age class", () => {
    expect(matchesGroupSearch("U11 - weiblich", "U15 männlich")).toBe(false);
  });

  it("shows every group when the search is empty", () => {
    expect(matchesGroupSearch("U11 - weiblich", "  ")).toBe(true);
  });
});