import type { Participant } from "../types/Participant";

export interface PoolSettings {
  maxPoolSize?: number;
  maxWeightSpan?: number;
  useDjb2026WeightClasses?: boolean;
}

export function getParticipantCategory(
  participant: Pick<Participant, "Altersklasse" | "Geschlecht">
) {
  return `${participant.Altersklasse} - ${participant.Geschlecht}`;
}

export function groupParticipantsByCategory(
  participants: Participant[]
): Record<string, Participant[]> {
  return participants.reduce(
    (acc: Record<string, Participant[]>, participant) => {
      const key = getParticipantCategory(participant);

      if (!acc[key]) {
        acc[key] = [];
      }

      acc[key].push(participant);

      return acc;
    },
    {}
  );
}

const djb2026WeightLimits: Record<string, Record<string, number[]>> = {
  U13: {
    männlich: [28, 31, 34, 37, 40, 43, 46, 50, 55],
    weiblich: [27, 30, 33, 36, 40, 44, 48, 52, 57],
  },
  U15: {
    männlich: [34, 37, 40, 43, 46, 50, 55, 60, 66],
    weiblich: [33, 36, 40, 44, 48, 52, 57, 63],
  },
};

export function getDjb2026WeightClass(
  ageClass: string,
  gender: string,
  weight: number
): string | null {
  const limits = djb2026WeightLimits[ageClass]?.[gender];

  if (!limits) {
    return null;
  }

  if (!Number.isFinite(weight) || weight <= 0) {
    return "Gewicht fehlt";
  }

  const upperLimit = limits.find((limit) => weight <= limit);
  return upperLimit === undefined ? `+${limits[limits.length - 1]} kg` : `bis ${upperLimit} kg`;
}

export function groupParticipantsByDjb2026WeightClass(
  participants: Participant[]
): Record<string, Participant[]> {
  const categories = new Map<string, { ageClass: string; gender: string }>();
  participants.forEach((participant) => {
    if (!djb2026WeightLimits[participant.Altersklasse]?.[participant.Geschlecht]) {
      return;
    }

    categories.set(getParticipantCategory(participant), {
      ageClass: participant.Altersklasse,
      gender: participant.Geschlecht,
    });
  });

  const groups: Record<string, Participant[]> = {};
  categories.forEach(({ ageClass, gender }, category) => {
    const limits = djb2026WeightLimits[ageClass][gender];
    const weightClasses = [
      ...limits.map((limit) => `bis ${limit} kg`),
      `+${limits[limits.length - 1]} kg`,
    ];

    weightClasses.forEach((weightClass) => {
      groups[`${category} - ${weightClass}`] ??= [];
    });
  });

  participants.forEach((participant) => {
    const category = getParticipantCategory(participant);
    const weightClass = getDjb2026WeightClass(
      participant.Altersklasse,
      participant.Geschlecht,
      Number(participant.Gewicht)
    );
    const groupName = weightClass ? `${category} - ${weightClass}` : category;

    (groups[groupName] ??= []).push(participant);
  });

  return groups;
}

export function isDjb2026FixedWeightClassGroup(groupName: string) {
  return / - (?:bis \d+ kg|\+\d+ kg)$/.test(groupName);
}

export function buildPoolGroups(
  participants: Participant[],
  options: PoolSettings = {}
): Record<string, Participant[][]> {
  const maxPoolSize = options.maxPoolSize ?? 4;
  const maxWeightSpan = options.maxWeightSpan ?? 6;

  const groupedParticipants = options.useDjb2026WeightClasses
    ? groupParticipantsByDjb2026WeightClass(participants)
    : groupParticipantsByCategory(participants);
  const result: Record<string, Participant[][]> = {};

  Object.entries(groupedParticipants).forEach(([groupName, fighters]) => {
    const sortedFighters = [...fighters].sort(
      (a, b) => Number(a.Gewicht) - Number(b.Gewicht)
    );

    if (
      options.useDjb2026WeightClasses &&
      isDjb2026FixedWeightClassGroup(groupName)
    ) {
      result[groupName] = [sortedFighters];
      return;
    }

    const pools: Participant[][] = [];
    let currentPool: Participant[] = [];

    sortedFighters.forEach((fighter) => {
      if (currentPool.length === 0) {
        currentPool = [fighter];
        return;
      }

      const currentMinWeight = Number(currentPool[0].Gewicht);
      const fighterWeight = Number(fighter.Gewicht);
      const poolIsFull = currentPool.length >= maxPoolSize;
      const weightSpreadTooLarge =
        fighterWeight - currentMinWeight > maxWeightSpan;

      if (poolIsFull || weightSpreadTooLarge) {
        pools.push(currentPool);
        currentPool = [fighter];
        return;
      }

      currentPool.push(fighter);
    });

    if (currentPool.length > 0) {
      pools.push(currentPool);
    }

    result[groupName] = pools;
  });

  return result;
}
