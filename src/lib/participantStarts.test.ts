import { describe, expect, it } from "vitest";
import {
  expandParticipantsIntoStarts,
  getAgeClassWarnings,
  getParticipantAgeClasses,
  getPresentParticipants,
  normalizeParticipant,
  setParticipantAgeClasses,
} from "./participantStarts";

const legacyParticipant = {
  Vorname: "Mia",
  Nachname: "Muster",
  Jahrgang: 2013,
  Geschlecht: "weiblich",
  Gewicht: 42,
  Altersklasse: "U13",
  Verein: "Judo Club",
};

describe("participant starts", () => {
  it("keeps legacy single-age-class participants compatible", () => {
    const participant = normalizeParticipant(legacyParticipant);

    expect(participant.Altersklasse).toBe("U13");
    expect(getParticipantAgeClasses(participant)).toEqual(["U13"]);
    expect(participant.Anwesend).toBe(true);
    expect(participant.Bezahlt).toBe(false);
  });

  it("excludes participants marked absent from pool input", () => {
    const present = normalizeParticipant(legacyParticipant);
    const absent = normalizeParticipant({
      ...legacyParticipant,
      Vorname: "Jonas",
      Anwesend: false,
    });

    expect(getPresentParticipants([present, absent])).toEqual([present]);
  });

  it("clears paid status for absent participants, including imported records", () => {
    const absentParticipant = normalizeParticipant({
      ...legacyParticipant,
      Anwesend: false,
      Bezahlt: true,
    });

    expect(absentParticipant.Anwesend).toBe(false);
    expect(absentParticipant.Bezahlt).toBe(false);
  });

  it("checks age-class boundaries using the competition year", () => {
    const participant = normalizeParticipant({
      ...legacyParticipant,
      Jahrgang: 2014,
      Altersklasse: "U13",
    });

    expect(getAgeClassWarnings(participant, 2026)).toEqual([]);
    expect(getAgeClassWarnings(participant, 2021)).toHaveLength(1);
  });

  it("warns when any selected start does not match the participant age", () => {
    const participant = normalizeParticipant({
      ...legacyParticipant,
      Jahrgang: 2013,
      Altersklasse: "U13, U15",
    });

    expect(getAgeClassWarnings(participant, 2026)).toEqual([
      "Ein Start nach unten in U13 ist nicht erlaubt. Die passende Altersklasse ist U15.",
    ]);
  });

  it("allows a double start only in the next higher age class", () => {
    const upwardStarter = normalizeParticipant({
      ...legacyParticipant,
      Jahrgang: 2016,
      Altersklasse: "U11, U13",
    });
    const skippedClassStarter = normalizeParticipant({
      ...legacyParticipant,
      Jahrgang: 2016,
      Altersklasse: "U11, U15",
    });

    expect(getAgeClassWarnings(upwardStarter, 2026)).toEqual([]);
    expect(getAgeClassWarnings(skippedClassStarter, 2026)).toEqual([
      "Ein Doppelstart ist nur in die direkt höhere Altersklasse U13 erlaubt.",
    ]);
  });

  it("requires the matching age class before allowing an upward start", () => {
    const participant = normalizeParticipant({
      ...legacyParticipant,
      Jahrgang: 2016,
      Altersklasse: "U13",
    });

    expect(getAgeClassWarnings(participant, 2026)).toEqual([
      "Die passende Altersklasse U11 muss ausgewählt sein. Ein Doppelstart ist nur zusätzlich in der direkt höheren Klasse erlaubt.",
    ]);
  });

  it("does not allow a double start in a lower age class", () => {
    const participant = normalizeParticipant({
      ...legacyParticipant,
      Jahrgang: 2013,
      Altersklasse: "U13, U15",
    });

    expect(getAgeClassWarnings(participant, 2026)).toEqual([
      "Ein Start nach unten in U13 ist nicht erlaubt. Die passende Altersklasse ist U15.",
    ]);
  });

  it("parses multiple age classes without blanks or duplicates", () => {
    const participant = normalizeParticipant({
      ...legacyParticipant,
      Altersklasse: "U13, U15; U13",
    });

    expect(getParticipantAgeClasses(participant)).toEqual(["U13", "U15"]);
  });

  it("creates one pool start per age class while preserving shared identity and weight", () => {
    const participant = normalizeParticipant({
      ...legacyParticipant,
      Altersklasse: "U13, U15",
    });
    const starts = expandParticipantsIntoStarts([participant]);

    expect(starts.map((start) => start.Altersklasse)).toEqual(["U13", "U15"]);
    expect(starts.every((start) => start.id === participant.id)).toBe(true);
    expect(starts.every((start) => start.Gewicht === participant.Gewicht)).toBe(true);
  });

  it("updates a person's starts while retaining their shared person ID", () => {
    const participant = normalizeParticipant(legacyParticipant);
    const updated = setParticipantAgeClasses(participant, "U13, U15");

    expect(updated.id).toBe(participant.id);
    expect(updated.Altersklasse).toBe("U13");
    expect(updated.Altersklassen).toEqual(["U13", "U15"]);
  });
});