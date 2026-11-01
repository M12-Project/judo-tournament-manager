import { describe, expect, it } from "vitest";
import {
  createFightListPdf,
  getFightListPdfFilename,
} from "./fightListPdf";
import type { Participant } from "../types/Participant";

const participants: Participant[] = [
  {
    Vorname: "Mia",
    Nachname: "Muster",
    Jahrgang: 2013,
    Geschlecht: "weiblich",
    Gewicht: 42.5,
    Altersklasse: "U15",
    Verein: "Judo Club",
  },
  {
    Vorname: "Noah",
    Nachname: "Beispiel",
    Jahrgang: 2013,
    Geschlecht: "weiblich",
    Gewicht: 44,
    Altersklasse: "U15",
    Verein: "Judo Club",
  },
];

describe("createFightListPdf", () => {
  it("creates a landscape pool schedule with round columns and clear winner marks", async () => {
    const pdf = await createFightListPdf(
      [{
        groupName: "U15 - weiblich",
        poolIndex: 0,
        participants,
        system: "POOL",
      }],
      "fights"
    );
    const pdfBytes = new Uint8Array(pdf.output("arraybuffer"));
    const header = new TextDecoder().decode(pdfBytes.slice(0, 5));
    const pdfContent = pdf.output();

    expect(pdf.getNumberOfPages()).toBe(1);
    expect(header).toBe("%PDF-");
    expect(pdf.internal.pageSize.getWidth()).toBeGreaterThan(
      pdf.internal.pageSize.getHeight()
    );
    expect(pdfContent).toContain("RUNDE 1");
    expect(pdfContent).toContain("KAMPF 1");
    expect(pdfContent).toContain("Sieger markieren");
    expect(pdfContent).toContain("Wertung");
    expect(pdfContent).toContain("Zeit");
    expect(pdfContent).not.toContain("Turnier:");
    expect(pdfContent).not.toContain("Listenführer:");
  });

  it("keeps the participant sheet compact without a placement column or event fields", async () => {
    const pdf = await createFightListPdf(
      [{
        groupName: "U15 - weiblich",
        poolIndex: 0,
        participants,
        system: "POOL",
      }],
      "participants"
    );
    const pdfContent = pdf.output();

    expect(pdfContent).toContain("Los");
    expect(pdfContent).toContain("Gewicht");
    expect(pdfContent).not.toContain("Platz");
    expect(pdfContent).not.toContain("Datum:");
    expect(pdfContent).not.toContain("Listenführer:");
  });

  it("continues a six-person pool round schedule onto another landscape page", async () => {
    const sixParticipants = Array.from({ length: 6 }, (_, index) => ({
      ...participants[index % participants.length],
      Vorname: `Judoka${index + 1}`,
    }));
    const pdf = await createFightListPdf(
      [{
        groupName: "U15 - weiblich",
        poolIndex: 0,
        participants: sixParticipants,
        system: "POOL",
      }],
      "fights"
    );

    expect(pdf.getNumberOfPages()).toBe(3);
    expect(pdf.internal.pageSize.getWidth()).toBeGreaterThan(
      pdf.internal.pageSize.getHeight()
    );
  });

    it("fits all six fights of a four-person pool on one sheet with weight and placement fields", async () => {
      const fourParticipants = Array.from({ length: 4 }, (_, index) => ({
        ...participants[index % participants.length],
        Vorname: `Judoka${index + 1}`,
        Gewicht: 42 + index,
      }));
      const pdf = await createFightListPdf(
        [{
          groupName: "U15 - weiblich",
          poolIndex: 0,
          participants: fourParticipants,
          system: "POOL",
        }],
        "fights"
      );
      const pdfContent = pdf.output();

      expect(pdf.getNumberOfPages()).toBe(1);
      expect(pdfContent).toContain("Max. Gewicht:");
      expect(pdfContent).toContain("1. Platz");
      expect(pdfContent).toContain("2. Platz");
      expect(pdfContent).toContain("3. Platz");
      expect(pdfContent).toContain("4. Platz");
      expect(pdfContent).not.toContain("5. Platz");
    });

    it("prints exactly two placement fields for a two-person pool", async () => {
      const pdf = await createFightListPdf(
        [{
          groupName: "U15 - weiblich",
          poolIndex: 0,
          participants,
          system: "POOL",
        }],
        "fights"
      );
      const pdfContent = pdf.output();

      expect(pdfContent).toContain("1. Platz");
      expect(pdfContent).toContain("2. Platz");
      expect(pdfContent).not.toContain("3. Platz");
    });

    it("prints exactly three placement fields for a three-person pool", async () => {
      const threeParticipants = Array.from({ length: 3 }, (_, index) => ({
        ...participants[index % participants.length],
        Vorname: `Judoka${index + 1}`,
      }));
      const pdf = await createFightListPdf(
        [{
          groupName: "U11 - weiblich",
          poolIndex: 0,
          participants: threeParticipants,
          system: "POOL",
        }],
        "fights"
      );
      const pdfContent = pdf.output();

      expect(pdfContent).toContain("1. Platz");
      expect(pdfContent).toContain("2. Platz");
      expect(pdfContent).toContain("3. Platz");
      expect(pdfContent).not.toContain("4. Platz");
    });

    it("prints exactly six placement fields for a six-person pool", async () => {
      const sixParticipants = Array.from({ length: 6 }, (_, index) => ({
        ...participants[index % participants.length],
        Vorname: `Judoka${index + 1}`,
      }));
      const pdf = await createFightListPdf(
        [{
          groupName: "U15 - weiblich",
          poolIndex: 0,
          participants: sixParticipants,
          system: "POOL",
        }],
        "fights"
      );
      const pdfContent = pdf.output();

      for (let place = 1; place <= 6; place += 1) {
        expect(pdfContent).toContain(`${place}. Platz`);
      }

      expect(pdfContent).not.toContain("7. Platz");
    });

    it("names a single pool PDF by category, gender, highest weight, and pool", () => {
      expect(getFightListPdfFilename([{
        groupName: "U11 - weiblich",
        poolIndex: 0,
        participants: [{ ...participants[0], Altersklasse: "U11", Gewicht: 35 }],
        system: "POOL",
      }], "fights")).toBe(
        "U11-Weiblich-bis-35kg-Pool-A-Kampfliste.pdf"
      );
    });

    it("gives a multi-pool PDF a recognizable category-based filename", () => {
      const sheet = {
        groupName: "U11 - weiblich",
        poolIndex: 0,
        participants: [{ ...participants[0], Altersklasse: "U11" }],
        system: "POOL" as const,
      };

      expect(getFightListPdfFilename([sheet, { ...sheet, poolIndex: 1 }], "fights"))
        .toBe("Judo-U11-Weiblich-Alle-Pools-Kampflisten.pdf");
    });
});