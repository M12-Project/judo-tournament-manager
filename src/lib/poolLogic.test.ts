import { describe, expect, it } from "vitest";
import { buildPoolGroups } from "./poolLogic";
import type { Participant } from "../types/Participant";

const makeParticipant = (
  vorname: string,
  gewicht: number,
  altersklasse = "U15",
  geschlecht = "männlich"
): Participant => ({
  Vorname: vorname,
  Nachname: "Tester",
  Jahrgang: 2013,
  Geschlecht: geschlecht,
  Gewicht: gewicht,
  Altersklasse: altersklasse,
  Verein: "Verein",
});

describe("buildPoolGroups", () => {
  it("creates a second pool when the weight spread is too wide", () => {
    const participants: Participant[] = [
      makeParticipant("A", 30),
      makeParticipant("B", 31),
      makeParticipant("C", 33),
      makeParticipant("D", 40),
      makeParticipant("E", 41),
      makeParticipant("F", 42),
    ];

    const groups = buildPoolGroups(participants, {
      maxPoolSize: 4,
      maxWeightSpan: 10,
    });

    expect(groups["U15 - männlich"]).toHaveLength(2);
    expect(groups["U15 - männlich"][0].map((fighter) => fighter.Gewicht)).toEqual([
      30, 31, 33, 40,
    ]);
    expect(groups["U15 - männlich"][1].map((fighter) => fighter.Gewicht)).toEqual([
      41, 42,
    ]);
  });

  it("keeps the list sorted by weight within each generated pool", () => {
    const participants: Participant[] = [
      makeParticipant("A", 52),
      makeParticipant("B", 44),
      makeParticipant("C", 48),
      makeParticipant("D", 46),
    ];

    const groups = buildPoolGroups(participants, {
      maxPoolSize: 4,
      maxWeightSpan: 10,
    });

    expect(groups["U15 - männlich"][0].map((fighter) => fighter.Gewicht)).toEqual([
      44, 46, 48, 52,
    ]);
  });
});
