import { describe, expect, it } from "vitest";
import {
  createKnockoutFights,
  createRoundRobinFights,
  getPoolType,
} from "./fightListLogic";
import type { Participant } from "../types/Participant";

const makePool = (size: number): Participant[] =>
  Array.from({ length: size }, (_, index) => ({
    Vorname: `Judoka${index + 1}`,
    Nachname: "Test",
    Jahrgang: 2013,
    Geschlecht: "männlich",
    Gewicht: 30 + index,
    Altersklasse: "U15",
    Verein: "Testverein",
  }));

describe("createRoundRobinFights", () => {
  it.each([2, 3, 4, 5, 6])(
    "creates every unique pairing for a %i-person pool",
    (size) => {
      const pool = makePool(size);
      const fights = createRoundRobinFights(pool);
      const pairings = fights.map(({ first, second }) =>
        [first.label, second.label].sort().join("-")
      );

      expect(fights).toHaveLength((size * (size - 1)) / 2);
      expect(new Set(pairings).size).toBe(pairings.length);
      expect(pairings).toHaveLength(new Set(pairings).size);
    }
  );

  it("creates a knockout bracket with automatic byes", () => {
    const fights = createKnockoutFights(makePool(5));

    expect(fights).toHaveLength(4);
    expect(fights.filter((fight) => fight.roundNumber === 1)).toHaveLength(2);
    expect(fights.at(-1)?.first.label).toContain("Sieger Kampf");
  });

  it("maps supported pool sizes to the matching PoolType", () => {
    expect(getPoolType(4, "POOL")).toBe("4ER");
    expect(getPoolType(5, "KO")).toBe("KO");
    expect(getPoolType(7, "POOL")).toBeNull();
  });
});