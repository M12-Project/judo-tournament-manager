import { describe, expect, it } from "vitest";
import { createDoubleKnockoutFights } from "./fightListLogic";
import type { Participant } from "../types/Participant";

const makeParticipants = (count: number): Participant[] =>
  Array.from({ length: count }, (_, index) => ({
    Vorname: `Judoka${index + 1}`,
    Nachname: "Test",
    Jahrgang: 2013,
    Geschlecht: "männlich",
    Gewicht: 30 + index,
    Altersklasse: "U15",
    Verein: "Testverein",
  }));

describe("createDoubleKnockoutFights", () => {
  it.each([2, 3, 4, 8, 16])(
    "creates a routed double-elimination bracket for %i participants",
    (count) => {
      const fights = createDoubleKnockoutFights(makeParticipants(count));
      const expectedFightCount = count === 2 ? 3 : 2 * count - 1;

      expect(fights).toHaveLength(expectedFightCount);
      expect(fights.at(-2)?.stage).toBe("final");
      expect(fights.at(-1)?.stage).toBe("final");
      expect(fights.at(-1)?.conditional).toBe(true);
      expect(fights.at(-2)?.winnerDestination).toContain("falls");
      expect(fights.at(-2)?.loserDestination).toContain("falls");
      expect(fights.at(-1)?.winnerDestination).toBe("Turniersieger");

      const matchNumbers = new Set(fights.map((fight) => fight.matchNumber));
      fights.forEach((fight) => {
        [fight.winnerDestination, fight.loserDestination].forEach((destination) => {
          const targetFight = destination.match(/^Kampf (\d+)/)?.[1];

          if (targetFight) {
            expect(matchNumbers.has(Number(targetFight))).toBe(true);
          }
        });
      });

      fights.slice(0, -2).forEach((fight) => {
        expect(fight.winnerDestination).toMatch(/^Kampf \d+$/);
        expect(fight.loserDestination).toMatch(
          /^(Kampf \d+|Ausgeschieden \(zweite Niederlage\))$/
        );
      });
    }
  );

  it("routes upper-round losers into the lower bracket and eliminates a second loss", () => {
    const fights = createDoubleKnockoutFights(makeParticipants(8));
    const upperRoundOne = fights.filter(
      (fight) => fight.stage === "upper" && fight.roundNumber === 1
    );
    const lowerRoundOne = fights.filter(
      (fight) => fight.stage === "lower" && fight.roundNumber === 1
    );

    expect(upperRoundOne).toHaveLength(4);
    expect(lowerRoundOne).toHaveLength(2);
    expect(upperRoundOne.every((fight) => fight.loserDestination.startsWith("Kampf ")))
      .toBe(true);
    expect(fights.some((fight) =>
      fight.stage === "lower" &&
      fight.loserDestination === "Ausgeschieden (zweite Niederlage)"
    )).toBe(true);
  });

  it("advances participants across byes without creating fake fights", () => {
    const fights = createDoubleKnockoutFights(makeParticipants(5));
    const upperFirstRound = fights.filter(
      (fight) => fight.stage === "upper" && fight.roundNumber === 1
    );

    expect(upperFirstRound).toHaveLength(2);
    expect(fights.at(-2)?.stage).toBe("final");
  });
});