import { describe, expect, it } from "vitest";
import {
  expandParticipantsIntoStarts,
  getParticipantAgeClasses,
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