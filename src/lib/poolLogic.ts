import type { Participant } from "../types/Participant";

export interface PoolSettings {
  maxPoolSize?: number;
  maxWeightSpan?: number;
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

export function buildPoolGroups(
  participants: Participant[],
  options: PoolSettings = {}
): Record<string, Participant[][]> {
  const maxPoolSize = options.maxPoolSize ?? 4;
  const maxWeightSpan = options.maxWeightSpan ?? 6;

  const groupedParticipants = groupParticipantsByCategory(participants);
  const result: Record<string, Participant[][]> = {};

  Object.entries(groupedParticipants).forEach(([groupName, fighters]) => {
    const sortedFighters = [...fighters].sort(
      (a, b) => Number(a.Gewicht) - Number(b.Gewicht)
    );

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
