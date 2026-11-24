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
    Anwesend: participant.Anwesend ?? true,
    Bezahlt: participant.Anwesend === false ? false : participant.Bezahlt ?? false,
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

export function getPresentParticipants(participants: Participant[]) {
  return participants.filter((participant) => participant.Anwesend !== false);
}

const ageClassAgeRanges: Record<string, { min: number; max: number }> = {
  U11: { min: 8, max: 10 },
  U13: { min: 10, max: 12 },
  U15: { min: 12, max: 14 },
};
const ageClassOrder = ["U11", "U13", "U15"];

export function getAgeClassWarnings(
  participant: Participant,
  competitionYear: number
) {
  const birthYear = Number(participant.Jahrgang);
  const age = competitionYear - birthYear;

  if (
    !Number.isInteger(competitionYear) ||
    !Number.isInteger(birthYear) ||
    birthYear <= 0 ||
    age < 0
  ) {
    return ["Jahrgang oder Wettkampfjahr ist ungültig."];
  }

  const ageClasses = getParticipantAgeClasses(participant);

  if (ageClasses.length === 0) {
    return ["Keine Altersklasse ausgewählt."];
  }

  const matchingAgeClass = ageClassOrder.find((ageClass) => {
    const range = ageClassAgeRanges[ageClass];
    return age >= range.min && age <= range.max;
  });

  if (!matchingAgeClass) {
    return [
      `Im Wettkampfjahr ${competitionYear} ist die Person ${age} Jahre alt und passt zu keiner unterstützten Altersklasse.`,
    ];
  }

  const matchingClassIndex = ageClassOrder.indexOf(matchingAgeClass);
  const warnings = ageClasses.flatMap((ageClass) => {
    const normalizedAgeClass = ageClass.toUpperCase();
    const classIndex = ageClassOrder.indexOf(normalizedAgeClass);

    if (classIndex < 0) {
      return [`Altersklasse ${ageClass} kann nicht geprüft werden.`];
    }

    if (classIndex < matchingClassIndex) {
      return [
        `Ein Start nach unten in ${ageClass} ist nicht erlaubt. Die passende Altersklasse ist ${matchingAgeClass}.`,
      ];
    }

    if (classIndex > matchingClassIndex + 1) {
      return [
        `Ein Doppelstart ist nur in die direkt höhere Altersklasse ${ageClassOrder[matchingClassIndex + 1] ?? ""} erlaubt.`,
      ];
    }

    return [];
  });

  if (!ageClasses.some((ageClass) => ageClass.toUpperCase() === matchingAgeClass)) {
    warnings.unshift(
      `Die passende Altersklasse ${matchingAgeClass} muss ausgewählt sein. Ein Doppelstart ist nur zusätzlich in der direkt höheren Klasse erlaubt.`
    );
  }

  if (ageClasses.length > 2) {
    warnings.push("Es sind höchstens zwei Starts als Doppelstart erlaubt.");
  }

  return warnings;
}