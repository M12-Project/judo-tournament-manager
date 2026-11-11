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

export interface DoubleKnockoutFight extends ScheduledFight {
  stage: "upper" | "lower" | "final";
  winnerDestination: string;
  loserDestination: string;
  conditional?: boolean;
}

interface BracketSlot {
  competitor: FightCompetitor;
  source?: {
    matchNumber: number;
    result: "winner" | "loser";
  };
}

interface InternalDoubleKnockoutFight extends ScheduledFight {
  stage: DoubleKnockoutFight["stage"];
  conditional?: boolean;
  firstSlot: BracketSlot;
  secondSlot: BracketSlot;
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

  type Pairing = { first: number; second: number; sameClub: boolean };
  type Round = Pairing[];

  const isSameClub = (firstIndex: number, secondIndex: number) => {
    const firstClub = participants[firstIndex].Verein.trim().toLocaleLowerCase("de-DE");
    const secondClub = participants[secondIndex].Verein.trim().toLocaleLowerCase("de-DE");

    return firstClub !== "" && firstClub === secondClub;
  };

  const createSchedule = (order: number[]): Round[] => {
    const rotation: Array<number | null> = [...order];

    if (rotation.length % 2 !== 0) {
      rotation.push(null);
    }

    const rounds: Round[] = [];

    for (let roundIndex = 0; roundIndex < rotation.length - 1; roundIndex += 1) {
      const round: Round = [];

      for (let pairIndex = 0; pairIndex < rotation.length / 2; pairIndex += 1) {
        const first = rotation[pairIndex];
        const second = rotation[rotation.length - 1 - pairIndex];

        if (first !== null && second !== null) {
          round.push({ first, second, sameClub: isSameClub(first, second) });
        }
      }

      round.sort((first, second) =>
        Number(second.sameClub) - Number(first.sameClub) ||
        first.first - second.first ||
        first.second - second.second
      );
      rounds.push(round);

      const fixedParticipant = rotation[0];
      const rotatingParticipants = rotation.slice(1);
      rotatingParticipants.unshift(rotatingParticipants.pop() ?? null);
      rotation.splice(0, rotation.length, fixedParticipant ?? null, ...rotatingParticipants);
    }

    return rounds;
  };

  const scoreSchedule = (rounds: Round[]) => rounds.map(
    (round) => round.filter((pairing) => pairing.sameClub).length
  );

  const isBetterSchedule = (candidate: number[], current: number[]) => {
    for (let index = 0; index < candidate.length; index += 1) {
      if (candidate[index] !== current[index]) {
        return candidate[index] > current[index];
      }
    }

    return false;
  };

  const defaultOrder = participants.map((_, index) => index).sort((first, second) => {
    const firstClub = participants[first].Verein.trim().toLocaleLowerCase("de-DE");
    const secondClub = participants[second].Verein.trim().toLocaleLowerCase("de-DE");

    return firstClub.localeCompare(secondClub, "de-DE") || first - second;
  });
  let bestRounds = createSchedule(defaultOrder);
  let bestScore = scoreSchedule(bestRounds);

  if (participants.length <= 8) {
    const fixedParticipant = defaultOrder[0];
    const remaining = defaultOrder.slice(1);

    const searchOrders = (startIndex: number) => {
      if (startIndex === remaining.length) {
        const rounds = createSchedule([fixedParticipant, ...remaining]);
        const score = scoreSchedule(rounds);

        if (isBetterSchedule(score, bestScore)) {
          bestRounds = rounds;
          bestScore = score;
        }

        return;
      }

      for (let index = startIndex; index < remaining.length; index += 1) {
        [remaining[startIndex], remaining[index]] =
          [remaining[index], remaining[startIndex]];
        searchOrders(startIndex + 1);
        [remaining[startIndex], remaining[index]] =
          [remaining[index], remaining[startIndex]];
      }
    };

    searchOrders(0);
  }

  return bestRounds.flatMap((round, roundIndex) =>
    round.map((pairing) => ({
      matchNumber: 0,
      roundNumber: roundIndex + 1,
      first: getCompetitor(participants[pairing.first]),
      second: getCompetitor(participants[pairing.second]),
    }))
  ).map((fight, index) => ({ ...fight, matchNumber: index + 1 }));
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

export function createDoubleKnockoutFights(
  participants: Participant[]
): DoubleKnockoutFight[] {
  if (participants.length < 2) {
    return [];
  }

  let bracketSize = 1;

  while (bracketSize < participants.length) {
    bracketSize *= 2;
  }

  const internalFights: InternalDoubleKnockoutFight[] = [];
  const createMatch = (
    first: BracketSlot | null,
    second: BracketSlot | null,
    stage: InternalDoubleKnockoutFight["stage"],
    roundNumber: number,
    conditional = false
  ): { winner: BracketSlot | null; loser: BracketSlot | null } => {
    if (!first || !second) {
      return { winner: first ?? second, loser: null };
    }

    const matchNumber = internalFights.length + 1;
    internalFights.push({
      matchNumber,
      roundNumber,
      stage,
      first: first.competitor,
      second: second.competitor,
      firstSlot: first,
      secondSlot: second,
      ...(conditional ? { conditional: true } : {}),
    });

    return {
      winner: {
        competitor: { label: `Sieger Kampf ${matchNumber}` },
        source: { matchNumber, result: "winner" },
      },
      loser: {
        competitor: { label: `Verlierer Kampf ${matchNumber}` },
        source: { matchNumber, result: "loser" },
      },
    };
  };

  const upperSlots: Array<BracketSlot | null> = participants.map((participant) => ({
    competitor: getCompetitor(participant),
  }));
  upperSlots.push(...Array.from({ length: bracketSize - upperSlots.length }, () => null));

  const upperLosersByRound: Array<Array<BracketSlot | null>> = [];
  let currentUpperSlots = upperSlots;
  let upperRound = 1;

  while (currentUpperSlots.length > 1) {
    const nextUpperSlots: Array<BracketSlot | null> = [];
    const roundLosers: Array<BracketSlot | null> = [];

    for (let index = 0; index < currentUpperSlots.length; index += 2) {
      const { winner, loser } = createMatch(
        currentUpperSlots[index],
        currentUpperSlots[index + 1],
        "upper",
        upperRound
      );
      nextUpperSlots.push(winner);
      roundLosers.push(loser);
    }

    upperLosersByRound.push(roundLosers);
    currentUpperSlots = nextUpperSlots;
    upperRound += 1;
  }

  const pairLowerSlots = (
    slots: Array<BracketSlot | null>,
    roundNumber: number
  ) => {
    const winners: Array<BracketSlot | null> = [];

    for (let index = 0; index < slots.length; index += 2) {
      const { winner } = createMatch(
        slots[index],
        slots[index + 1] ?? null,
        "lower",
        roundNumber
      );
      winners.push(winner);
    }

    return winners;
  };

  let lowerRound = 1;
  let lowerSlots = pairLowerSlots(upperLosersByRound[0] ?? [], lowerRound);
  lowerRound += 1;

  for (let upperRoundIndex = 1;
    upperRoundIndex < upperLosersByRound.length;
    upperRoundIndex += 1) {
    const upperLosers = upperLosersByRound[upperRoundIndex];
    const mergedSlots: Array<BracketSlot | null> = [];
    const mergeCount = Math.max(lowerSlots.length, upperLosers.length);

    for (let index = 0; index < mergeCount; index += 1) {
      const { winner } = createMatch(
        lowerSlots[index] ?? null,
        upperLosers[index] ?? null,
        "lower",
        lowerRound
      );
      mergedSlots.push(winner);
    }

    lowerRound += 1;

    if (upperRoundIndex < upperLosersByRound.length - 1) {
      lowerSlots = pairLowerSlots(mergedSlots, lowerRound);
      lowerRound += 1;
    } else {
      lowerSlots = mergedSlots;
    }
  }

  const upperChampion = currentUpperSlots[0] ?? null;
  const lowerChampion = lowerSlots[0] ?? null;
  const firstFinal = createMatch(upperChampion, lowerChampion, "final", 1);

  if (!firstFinal.winner || !firstFinal.loser) {
    return [];
  }

  createMatch(firstFinal.winner, firstFinal.loser, "final", 2, true);

  const destinations = new Map<string, number>();

  internalFights.forEach((fight) => {
    [fight.firstSlot, fight.secondSlot].forEach((slot) => {
      if (slot.source) {
        destinations.set(
          `${slot.source.matchNumber}:${slot.source.result}`,
          fight.matchNumber
        );
      }
    });
  });

  return internalFights.map((fight) => {
    const winnerNextFight = destinations.get(`${fight.matchNumber}:winner`);
    const loserNextFight = destinations.get(`${fight.matchNumber}:loser`);
    const isFinalReset = fight.stage === "final" && fight.roundNumber === 2;
    const isFirstFinal = fight.stage === "final" && fight.roundNumber === 1;

    return {
      matchNumber: fight.matchNumber,
      roundNumber: fight.roundNumber,
      first: fight.first,
      second: fight.second,
      stage: fight.stage,
      ...(fight.conditional ? { conditional: true } : {}),
      winnerDestination: winnerNextFight
        ? `Kampf ${winnerNextFight}${isFirstFinal ? " (falls Verliererseite gewinnt)" : ""}`
        : isFinalReset
          ? "Turniersieger"
          : "Kampf 2 (falls Verliererseite gewinnt)",
      loserDestination: loserNextFight
        ? `Kampf ${loserNextFight}${isFirstFinal ? " (falls Verliererseite gewinnt)" : ""}`
        : isFinalReset
          ? "2. Platz"
          : isFirstFinal
            ? "Kampf 2 (falls Verliererseite gewinnt)"
            : "Ausgeschieden (zweite Niederlage)",
    };
  });
}