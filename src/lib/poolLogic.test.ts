import { describe, expect, it } from "vitest";
import {
  buildPoolGroups,
  getDjb2026WeightClass,
  isDjb2026FixedWeightClassGroup,
  groupParticipantsByDjb2026WeightClass,
} from "./poolLogic";
import { expandParticipantsIntoStarts, normalizeParticipant } from "./participantStarts";
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

  it("keeps every participant in free pools regardless of DJB boundaries", () => {
    const participants = [
      makeParticipant("A", 25, "U13", "männlich"),
      makeParticipant("B", 28, "U13", "männlich"),
      makeParticipant("C", 34, "U13", "männlich"),
      makeParticipant("D", 56, "U13", "männlich"),
    ];

    const groups = buildPoolGroups(participants);
    const groupedParticipants = Object.values(groups).flat(2);

    expect(groupedParticipants).toHaveLength(participants.length);
    expect(groupedParticipants.map((participant) => participant.Vorname).sort())
      .toEqual(["A", "B", "C", "D"]);
    expect(Object.keys(groups)).toEqual(["U13 - männlich"]);
  });

  it("puts a double-start participant into each age-class group exactly once", () => {
    const doubleStarter = normalizeParticipant({
      ...makeParticipant("A", 42),
      Altersklasse: "U13, U15",
    });
    const groups = buildPoolGroups(
      expandParticipantsIntoStarts([doubleStarter])
    );

    expect(groups["U13 - männlich"]).toHaveLength(1);
    expect(groups["U15 - männlich"]).toHaveLength(1);
    expect(groups["U13 - männlich"][0][0].id).toBe(doubleStarter.id);
    expect(groups["U15 - männlich"][0][0].id).toBe(doubleStarter.id);
  });
});

describe("DJB 2026 weight classes", () => {
  it("assigns boundary weights to the matching inclusive class", () => {
    expect(getDjb2026WeightClass("U13", "männlich", 28)).toBe("bis 28 kg");
    expect(getDjb2026WeightClass("U13", "männlich", 28.1)).toBe("bis 31 kg");
    expect(getDjb2026WeightClass("U13", "männlich", 56)).toBe("+55 kg");
  });

  it("keeps genders, fixed classes, and U11 free pools separate", () => {
    const participants = [
      makeParticipant("U13 Junge", 28, "U13", "männlich"),
      makeParticipant("U13 Mädchen", 28, "U13", "weiblich"),
      makeParticipant("U11", 28, "U11", "männlich"),
    ];

    const groups = groupParticipantsByDjb2026WeightClass(participants);

    expect(groups["U13 - männlich - bis 28 kg"]).toHaveLength(1);
    expect(groups["U13 - männlich - bis 31 kg"]).toEqual([]);
    expect(groups["U13 - männlich - +55 kg"]).toEqual([]);
    expect(groups["U13 - weiblich - bis 30 kg"]).toHaveLength(1);
    expect(groups["U13 - weiblich - +57 kg"]).toEqual([]);
    expect(groups["U11 - männlich"]).toHaveLength(1);
  });

  it("keeps everyone in a fixed class together, regardless of pool settings", () => {
    const participants = Array.from({ length: 32 }, (_, index) =>
      makeParticipant(`Judoka ${index + 1}`, 30 + (index % 5), "U15", "männlich")
    );

    const groups = buildPoolGroups(participants, {
      maxPoolSize: 4,
      maxWeightSpan: 1,
      useDjb2026WeightClasses: true,
    });

    expect(groups["U15 - männlich - bis 34 kg"]).toHaveLength(1);
    expect(groups["U15 - männlich - bis 34 kg"][0]).toHaveLength(32);
    expect(isDjb2026FixedWeightClassGroup("U15 - männlich - bis 34 kg")).toBe(true);
    expect(isDjb2026FixedWeightClassGroup("U11 - männlich")).toBe(false);
  });
});
