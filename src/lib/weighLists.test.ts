import { describe, expect, it } from "vitest";
import type { Participant } from "../types/Participant";
import { normalizeParticipant } from "./participantStarts";
import { applyWeighListUpdates, getWeighListParticipants } from "./weighLists";

const makeParticipant = (overrides: Partial<Participant> = {}) =>
  normalizeParticipant({
    Vorname: "Mia",
    Nachname: "Muster",
    Jahrgang: 2016,
    Geschlecht: "weiblich",
    Gewicht: 32,
    Altersklasse: "U11",
    Verein: "Judo Club",
    ...overrides,
  });

describe("weigh lists", () => {
  it("filters by age class and gender, includes double starts, and excludes absentees", () => {
    const u11Girl = makeParticipant({ Altersklasse: "U11, U13" });
    const u11Boy = makeParticipant({ Geschlecht: "männlich" });
    const absentGirl = makeParticipant({ Anwesend: false });

    expect(getWeighListParticipants(
      [u11Girl, u11Boy, absentGirl],
      "U11",
      "weiblich"
    )).toEqual([u11Girl]);
    expect(getWeighListParticipants([u11Girl], "U13", "weiblich")).toEqual([
      u11Girl,
    ]);
  });

  it("updates weights by participant ID without replacing other participant data", () => {
    const first = makeParticipant({ Bezahlt: true });
    const second = makeParticipant({ Vorname: "Jonas", Geschlecht: "männlich" });
    const result = applyWeighListUpdates([first, second], [
      { "Teilnehmer-ID": first.id, Gewicht: "33,5" },
      { "Teilnehmer-ID": "unknown-id", Gewicht: 40 },
      { "Teilnehmer-ID": second.id, Gewicht: "ungültig" },
      { "Teilnehmer-ID": second.id, Gewicht: " " },
    ]);

    expect(result.updated).toBe(1);
    expect(result.notFound).toBe(1);
    expect(result.invalid).toBe(2);
    expect(result.participants[0]).toMatchObject({
      Gewicht: 33.5,
      Bezahlt: true,
      Vorname: first.Vorname,
    });
    expect(result.participants[1]).toEqual(second);
  });
});