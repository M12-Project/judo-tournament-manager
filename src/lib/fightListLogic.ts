import type { Participant } from "../types/Participant";
import type { PoolType } from "../types/PoolType";

export interface FightCompetitor {
  label: string;
  participant?: Participant;
}

export interface ScheduledFight {
  matchNumber: number;
  roundNumber: number;
  first: FightCompetitor;
  second: FightCompetitor;
}

const getCompetitor = (participant: Participant): FightCompetitor => ({
  label: `${participant.Vorname} ${participant.Nachname}`,
  participant,
});

export function getPoolType(
  poolSize: number,
  system: "POOL" | "KO"
): PoolType | null {
  if (system === "KO") {
    return "KO";
  }

  if (poolSize >= 2 && poolSize <= 6) {
    return `${poolSize}ER` as PoolType;
  }

  return null;
}

export function createRoundRobinFights(
  participants: Participant[]
): ScheduledFight[] {
  if (participants.length < 2) {
    return [];
  }

  const fighters: Array<Participant | null> = [...participants];

  if (fighters.length % 2 !== 0) {
    fighters.push(null);
  }

  const fights: ScheduledFight[] = [];
  const roundCount = fighters.length - 1;
  const matchesPerRound = fighters.length / 2;

  for (let roundIndex = 0; roundIndex < roundCount; roundIndex += 1) {
    for (let matchIndex = 0; matchIndex < matchesPerRound; matchIndex += 1) {
      const first = fighters[matchIndex];
      const second = fighters[fighters.length - 1 - matchIndex];

      if (first && second) {
        fights.push({
          matchNumber: fights.length + 1,
          roundNumber: roundIndex + 1,
          first: getCompetitor(first),
          second: getCompetitor(second),
        });
      }
    }

    const fixedFighter = fighters[0];
    const rotatingFighters = fighters.slice(1);
    rotatingFighters.unshift(rotatingFighters.pop() ?? null);
    fighters.splice(0, fighters.length, fixedFighter ?? null, ...rotatingFighters);
  }

  return fights;
}

export function createKnockoutFights(
  participants: Participant[]
): ScheduledFight[] {
  if (participants.length < 2) {
    return [];
  }

  let bracketSize = 1;

  while (bracketSize < participants.length) {
    bracketSize *= 2;
  }

  let bracket: Array<FightCompetitor | null> = participants.map(getCompetitor);
  bracket = bracket.concat(
    Array.from({ length: bracketSize - bracket.length }, () => null)
  );

  const fights: ScheduledFight[] = [];
  let roundNumber = 1;

  while (bracket.length > 1) {
    const nextRound: Array<FightCompetitor | null> = [];

    for (let index = 0; index < bracket.length; index += 2) {
      const first = bracket[index];
      const second = bracket[index + 1];

      if (!first || !second) {
        nextRound.push(first ?? second);
        continue;
      }

      const matchNumber = fights.length + 1;
      fights.push({ matchNumber, roundNumber, first, second });
      nextRound.push({ label: `Sieger Kampf ${matchNumber}` });
    }

    bracket = nextRound;
    roundNumber += 1;
  }

  return fights;
}