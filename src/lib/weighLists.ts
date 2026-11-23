import type { Participant } from "../types/Participant";
import { getParticipantAgeClasses } from "./participantStarts";

export function getWeighListParticipants(
  participants: Participant[],
  ageClass: string,
  gender: string
) {
  return participants.filter(
    (participant) =>
      participant.Anwesend !== false &&
      participant.Geschlecht.trim().toLocaleLowerCase("de-DE") ===
        gender.trim().toLocaleLowerCase("de-DE") &&
      getParticipantAgeClasses(participant).some(
        (participantAgeClass) =>
          participantAgeClass.toLocaleLowerCase("de-DE") ===
          ageClass.toLocaleLowerCase("de-DE")
      )
  );
}

export interface WeighListImportResult {
  participants: Participant[];
  updated: number;
  notFound: number;
  invalid: number;
}

export function applyWeighListUpdates(
  participants: Participant[],
  rows: Array<Record<string, unknown>>
): WeighListImportResult {
  const updates = new Map<string, number>();
  let notFound = 0;
  let invalid = 0;

  rows.forEach((row) => {
    const id = String(row["Teilnehmer-ID"] ?? row.id ?? row.ID ?? "").trim();
    const weightValue = row.Gewicht;
    const weight = typeof weightValue === "string"
      ? Number(weightValue.trim().replace(",", "."))
      : Number(weightValue);

    if (!id || !participants.some((participant) => participant.id === id)) {
      notFound += 1;
      return;
    }

    if (
      (typeof weightValue === "string" && weightValue.trim() === "") ||
      weightValue === undefined ||
      !Number.isFinite(weight) ||
      weight < 0
    ) {
      invalid += 1;
      return;
    }

    updates.set(id, weight);
  });

  return {
    participants: participants.map((participant) =>
      participant.id && updates.has(participant.id)
        ? { ...participant, Gewicht: updates.get(participant.id)! }
        : participant
    ),
    updated: updates.size,
    notFound,
    invalid,
  };
}