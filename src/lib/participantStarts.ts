import type { Participant } from "../types/Participant";

const createParticipantId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `participant-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function parseAgeClasses(value: string | string[] | undefined) {
  const values = Array.isArray(value) ? value : value?.split(/[;,]/) ?? [];

  return Array.from(new Set(
    values.map((ageClass) => ageClass.trim()).filter(Boolean)
  ));
}

export function normalizeParticipant(
  participant: Omit<Participant, "Altersklasse"> & { Altersklasse?: string }
): Participant {
  const ageClasses = parseAgeClasses(
    participant.Altersklassen?.length
      ? participant.Altersklassen
      : participant.Altersklasse
  );

  return {
    ...participant,
    id: participant.id || createParticipantId(),
    Altersklasse: ageClasses[0] ?? "",
    Altersklassen: ageClasses,
  };
}

export function getParticipantAgeClasses(participant: Participant) {
  const ageClasses = parseAgeClasses(participant.Altersklassen);

  return ageClasses.length > 0
    ? ageClasses
    : parseAgeClasses(participant.Altersklasse);
}

export function setParticipantAgeClasses(
  participant: Participant,
  value: string
): Participant {
  const ageClasses = parseAgeClasses(value);

  return {
    ...participant,
    Altersklasse: ageClasses[0] ?? "",
    Altersklassen: ageClasses,
  };
}

export function expandParticipantsIntoStarts(participants: Participant[]) {
  return participants.flatMap((participant) =>
    getParticipantAgeClasses(participant).map((ageClass) => ({
      ...participant,
      Altersklasse: ageClass,
      Altersklassen: [ageClass],
    }))
  );
}