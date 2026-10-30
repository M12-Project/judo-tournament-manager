import { useMemo, useState } from "react";
import type { Participant } from "../types/Participant";
import {
  buildPoolGroups,
  groupParticipantsByCategory,
} from "../lib/poolLogic";
import type { TournamentMode } from "../types/TournamentMode";

interface Props {
  participants: Participant[];
}

const buildParticipantKey = (
  participant: Participant
) =>
  [
    participant.Vorname,
    participant.Nachname,
    participant.Gewicht,
    participant.Altersklasse,
    participant.Geschlecht,
    participant.Verein,
    participant.Jahrgang,
  ].join("|");

const formatWeight = (value: number | string) => {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
      return "0";
    }

    return Number.isInteger(numericValue)
      ? String(numericValue)
      : numericValue.toFixed(1).replace(/\.0$/, "");
  };

function PoolPage({ participants }: Props) {
  const [maxPoolSize, setMaxPoolSize] = useState(4);
  const [maxWeightSpan, setMaxWeightSpan] = useState(6);

  const handleNumberInput = (
    value: string,
    fallbackValue: number,
    setter: (value: number) => void
  ) => {
    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
      setter(fallbackValue);
      return;
    }

    setter(parsed);
  };
  const [manualPoolAssignments, setManualPoolAssignments] = useState<
    Record<string, number>
  >({});

  const [poolSystems, setPoolSystems] = useState<
    Record<string, "POOL" | "KO">
  >({});

  const groupedParticipants = useMemo(
    () => groupParticipantsByCategory(participants),
    [participants]
  );

  const suggestedGroups = useMemo(
    () =>
      buildPoolGroups(participants, {
        maxPoolSize,
        maxWeightSpan,
      }),
    [participants, maxPoolSize, maxWeightSpan]
  );

  const getPoolIndexForParticipant = (
    groupName: string,
    participant: Participant
  ) => {
    const key = `${groupName}|${buildParticipantKey(participant)}`;

    if (manualPoolAssignments[key] !== undefined) {
      return manualPoolAssignments[key];
    }

    const suggestedPoolIndex =
      suggestedGroups[groupName]?.findIndex((pool) =>
        pool.some(
          (fighter) =>
            buildParticipantKey(fighter) ===
            buildParticipantKey(participant)
        )
      ) ?? -1;

    return suggestedPoolIndex >= 0 ? suggestedPoolIndex : 0;
  };

  const getVisiblePoolsForGroup = (groupName: string) => {
    const fighters = groupedParticipants[groupName] ?? [];
    const poolCount = Math.max(
      suggestedGroups[groupName]?.length ?? 1,
      ...fighters.map(
        (fighter) =>
          getPoolIndexForParticipant(groupName, fighter) + 1
      ),
      1
    );

    const pools = Array.from({ length: poolCount }, () => [] as Participant[]);

    fighters.forEach((fighter) => {
      const poolIndex = getPoolIndexForParticipant(groupName, fighter);
      pools[poolIndex].push(fighter);
    });

    return pools
      .filter((pool) => pool.length > 0)
      .map((pool) => [...pool].sort((a, b) => Number(a.Gewicht) - Number(b.Gewicht)));
  };

  const getSelectablePoolCount = (groupName: string) => {
    const fighters = groupedParticipants[groupName] ?? [];
    const maxManualIndex = Math.max(
      1,
      ...fighters.map(
        (fighter) => getPoolIndexForParticipant(groupName, fighter) + 1
      )
    );

    return Math.max(
      suggestedGroups[groupName]?.length ?? 1,
      maxManualIndex
    );
  };

  const handleManualPoolChange = (
    groupName: string,
    participant: Participant,
    targetPoolIndex: number
  ) => {
    const key = `${groupName}|${buildParticipantKey(participant)}`;

    setManualPoolAssignments((prev) => ({
      ...prev,
      [key]: targetPoolIndex,
    }));
  };

  const getPoolSystem = (
    groupName: string,
    poolIndex: number
  ) => {
    const key = `${groupName}-${poolIndex}`;

    return poolSystems[key] ?? "POOL";
  };

  const [groupModes, setGroupModes] = useState<
    Record<string, TournamentMode>
  >({});

  return (
    <div>
      <h1>Poolgenerator</h1>

      <div style={{ marginBottom: "1rem" }}>
        <label>
          Max. Teilnehmer pro Pool: {" "}
          <input
            type="number"
            min="2"
            max="8"
            value={maxPoolSize}
            onChange={(event) =>
              handleNumberInput(
                event.target.value,
                4,
                setMaxPoolSize
              )
            }
          />
        </label>

        <label style={{ marginLeft: "1rem" }}>
          Max. Gewichtsspanne pro Pool: {" "}
          <input
            type="number"
            min="2"
            max="30"
            value={maxWeightSpan}
            onChange={(event) =>
              handleNumberInput(
                event.target.value,
                6,
                setMaxWeightSpan
              )
            }
          />
          kg
        </label>
      </div>

      {Object.entries(groupedParticipants).map(
        ([groupName, fighters]) => {
          const pools = getVisiblePoolsForGroup(groupName);
          const selectablePoolCount = getSelectablePoolCount(groupName);

          return (
            <div key={groupName} style={{ marginBottom: "2rem" }}>
              <h3>
                {groupName} ({fighters.length} Teilnehmer)
              </h3>

              <select
                value={groupModes[groupName] ?? "POOL"}
                onChange={(e) =>
                  setGroupModes((prev) => ({
                    ...prev,
                    [groupName]: e.target.value as TournamentMode,
                  }))
                }
              >
                <option value="POOL">
                  Pool-System
                </option>

                <option value="KO">
                  KO-System
                </option>
              </select>

              {pools.map((pool, poolIndex) => (
                <div
                  key={`${groupName}-pool-${poolIndex}`}
                  style={{
                    border: "1px solid #ddd",
                    padding: "0.75rem",
                    marginBottom: "0.75rem",
                  }}
                >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "0.5rem",
                  }}
                >
                  <strong>
                    Pool {String.fromCharCode(65 + poolIndex)}
                  </strong>

                  <select
                    value={getPoolSystem(groupName, poolIndex)}
                    onChange={(event) =>
                      setPoolSystems((prev) => ({
                        ...prev,
                        [`${groupName}-${poolIndex}`]:
                          event.target.value as "POOL" | "KO",
                      }))
                    }
                  >
                    <option value="POOL">
                      Pool-System
                    </option>

                    <option value="KO">
                      KO-System
                    </option>
                  </select>
                </div>

                  {pool.map((fighter) => (
                    <div
                      key={`${groupName}-${buildParticipantKey(fighter)}`}
                      style={{
                        display: "flex",
                        gap: "0.5rem",
                        alignItems: "center",
                        marginTop: "0.5rem",
                      }}
                    >
                      <span>
                        {fighter.Vorname} {fighter.Nachname} - {formatWeight(fighter.Gewicht)} kg
                      </span>

                      <label>
                        Pool: {" "}
                        <select
                          value={String(
                            getPoolIndexForParticipant(groupName, fighter)
                          )}
                          onChange={(event) =>
                            handleManualPoolChange(
                              groupName,
                              fighter,
                              Number(event.target.value)
                            )
                          }
                        >
                          {Array.from(
                            { length: selectablePoolCount },
                            (_, index) => (
                              <option key={index} value={String(index)}>
                                {index + 1}
                              </option>
                            )
                          )}
                        </select>
                      </label>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          );
        }
      )}
    </div>
  );
}

export default PoolPage;