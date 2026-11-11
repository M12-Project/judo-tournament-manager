import { useEffect, useMemo, useState } from "react";
import type { Participant } from "../types/Participant";
import {
  buildPoolGroups,
  groupParticipantsByCategory,
} from "../lib/poolLogic";
import { expandParticipantsIntoStarts } from "../lib/participantStarts";
import { matchesGroupSearch } from "../lib/groupSearch";

interface Props {
  participants: Participant[];

  poolSystems: Record<
    string,
    "POOL" | "KO"
  >;

  setPoolSystems: React.Dispatch<
    React.SetStateAction<
      Record<string, "POOL" | "KO">
    >
  >;

  setGeneratedPools: React.Dispatch<
    React.SetStateAction<
      Record<string, Participant[][]>
    >
  >;
}

const buildParticipantKey = (
  participant: Participant
) =>
  [
    participant.id ?? "",
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

const getPoolIndexForParticipant = (
  groupName: string,
  participant: Participant,
  manualPoolAssignments: Record<string, number>,
  suggestedGroups: Record<string, Participant[][]>
) => {
  const key = `${groupName}|${buildParticipantKey(participant)}`;

  if (manualPoolAssignments[key] !== undefined) {
    return manualPoolAssignments[key];
  }

  const suggestedPoolIndex =
    suggestedGroups[groupName]?.findIndex((pool) =>
      pool.some(
        (fighter) =>
          buildParticipantKey(fighter) === buildParticipantKey(participant)
      )
    ) ?? -1;

  return suggestedPoolIndex >= 0 ? suggestedPoolIndex : 0;
};

const getVisiblePoolsForGroup = (
  groupName: string,
  groupedParticipants: Record<string, Participant[]>,
  suggestedGroups: Record<string, Participant[][]>,
  manualPoolAssignments: Record<string, number>,
  additionalPoolCount: number
) => {
  const fighters = groupedParticipants[groupName] ?? [];
  const poolCount = Math.max(
    suggestedGroups[groupName]?.length ?? 1,
    ...fighters.map(
      (fighter) =>
        getPoolIndexForParticipant(
          groupName,
          fighter,
          manualPoolAssignments,
          suggestedGroups
        ) + 1
    ),
    (suggestedGroups[groupName]?.length ?? 1) + additionalPoolCount,
    1
  );

  const pools = Array.from({ length: poolCount }, () => [] as Participant[]);

  fighters.forEach((fighter) => {
    const poolIndex = getPoolIndexForParticipant(
      groupName,
      fighter,
      manualPoolAssignments,
      suggestedGroups
    );
    pools[poolIndex].push(fighter);
  });

  return pools.map((pool) =>
    [...pool].sort((a, b) => Number(a.Gewicht) - Number(b.Gewicht))
  );
};

function PoolPage({
  participants,
  poolSystems,
  setPoolSystems,
  setGeneratedPools,
}: Props) {
  const [maxPoolSize, setMaxPoolSize] = useState(4);
  const [maxWeightSpan, setMaxWeightSpan] = useState(6);
  const [groupSearch, setGroupSearch] = useState("");

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
  const [additionalPoolCounts, setAdditionalPoolCounts] = useState<
    Record<string, number>
  >({});

  const groupedParticipants = useMemo(
    () => groupParticipantsByCategory(
      expandParticipantsIntoStarts(participants)
    ),
    [participants]
  );

  const filteredGroups = Object.entries(groupedParticipants).filter(
    ([groupName]) => matchesGroupSearch(groupName, groupSearch)
  );

  const suggestedGroups = useMemo(
    () =>
      buildPoolGroups(expandParticipantsIntoStarts(participants), {
        maxPoolSize,
        maxWeightSpan,
      }),
    [participants, maxPoolSize, maxWeightSpan]
  );

  const getSelectablePoolCount = (groupName: string) => {
    const fighters = groupedParticipants[groupName] ?? [];
    const maxManualIndex = Math.max(
      1,
      ...fighters.map(
        (fighter) =>
          getPoolIndexForParticipant(
            groupName,
            fighter,
            manualPoolAssignments,
            suggestedGroups
          ) + 1
      )
    );

    return Math.max(
      suggestedGroups[groupName]?.length ?? 1,
      (suggestedGroups[groupName]?.length ?? 1) +
        (additionalPoolCounts[groupName] ?? 0),
      maxManualIndex
    );
  };

  const addPoolToGroup = (groupName: string) => {
    setAdditionalPoolCounts((counts) => ({
      ...counts,
      [groupName]: (counts[groupName] ?? 0) + 1,
    }));
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

  const finalizedPools = useMemo(
    () =>
      Object.keys(groupedParticipants).reduce<Record<string, Participant[][]>>(
        (result, groupName) => {
          result[groupName] = getVisiblePoolsForGroup(
            groupName,
            groupedParticipants,
            suggestedGroups,
            manualPoolAssignments,
            additionalPoolCounts[groupName] ?? 0
          );
          return result;
        },
        {}
      ),
    [groupedParticipants, suggestedGroups, manualPoolAssignments, additionalPoolCounts]
  );

  useEffect(() => {
    setGeneratedPools((currentPools) =>
      JSON.stringify(currentPools) === JSON.stringify(finalizedPools)
        ? currentPools
        : finalizedPools
    );
  }, [finalizedPools, setGeneratedPools]);

  return (
    <div className="pool-page">
      <div className="page-heading">
        <div>
          <div className="page-kicker">Einteilung vorbereiten</div>
          <h1>Poolgenerator</h1>
          <p>Automatische Vorschläge prüfen und bei Bedarf manuell anpassen.</p>
        </div>
        <span className="stat-chip">
          {Object.keys(groupedParticipants).length} Gruppen
        </span>
      </div>

      <div className="group-search-row">
        <div className="group-search-input">
          <label className="form-label" htmlFor="pool-group-search">Gruppe suchen</label>
          <input
            id="pool-group-search"
            className="form-control"
            type="search"
            placeholder="z. B. U11 - weiblich"
            value={groupSearch}
            onChange={(event) => setGroupSearch(event.target.value)}
          />
        </div>
        <span className="small text-secondary">
          {filteredGroups.length} von {Object.keys(groupedParticipants).length} Gruppen
        </span>
      </div>

      <section className="workspace-panel mb-4">
        <div className="workspace-panel-header">
          <div>
            <h2>Vorschlagsregeln</h2>
            <div className="small text-secondary mt-1">Gewichtsabstand und Poolgröße für die automatische Einteilung</div>
          </div>
          <span className="badge text-bg-light border">Manuell anpassbar</span>
        </div>
        <div className="workspace-panel-body">
          <div className="row g-3">
            <div className="col-12 col-sm-6 col-lg-3">
              <label className="form-label" htmlFor="max-pool-size">Max. Teilnehmer pro Pool</label>
              <input
                id="max-pool-size"
                className="form-control"
                type="number"
                min="2"
                max="8"
                value={maxPoolSize}
                onChange={(event) =>
                  handleNumberInput(event.target.value, 4, setMaxPoolSize)
                }
              />
            </div>
            <div className="col-12 col-sm-6 col-lg-3">
              <label className="form-label" htmlFor="max-weight-span">Max. Gewichtsspanne</label>
              <div className="input-group">
                <input
                  id="max-weight-span"
                  className="form-control"
                  type="number"
                  min="2"
                  max="30"
                  value={maxWeightSpan}
                  onChange={(event) =>
                    handleNumberInput(event.target.value, 6, setMaxWeightSpan)
                  }
                />
                <span className="input-group-text">kg</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {participants.length === 0 ? (
        <div className="empty-state">
          <h2>Noch keine Teilnehmer eingeteilt</h2>
          <p>Importiere Teilnehmer und weise ihnen Altersklassen zu, um Pools vorzuschlagen.</p>
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="empty-state">
          <h2>Keine passende Gruppe gefunden</h2>
          <p>Ändere den Suchbegriff, zum Beispiel auf U11 oder weiblich.</p>
        </div>
      ) : filteredGroups.map(
        ([groupName, fighters]) => {
          const pools = getVisiblePoolsForGroup(
            groupName,
            groupedParticipants,
            suggestedGroups,
            manualPoolAssignments,
            additionalPoolCounts[groupName] ?? 0
          );
          const selectablePoolCount = getSelectablePoolCount(groupName);

          return (
            <section key={groupName} className="pool-group">
              <div className="pool-group-heading">
                <h2 className="pool-group-title">
                  {groupName}
                  <span className="badge rounded-pill text-bg-light border">
                    {fighters.length} Teilnehmer
                  </span>
                </h2>
                <button
                  className="btn btn-sm btn-outline-primary"
                  type="button"
                  onClick={() => addPoolToGroup(groupName)}
                >
                  <span aria-hidden="true">+</span> Pool hinzufügen
                </button>
              </div>
              {pools.map((pool, poolIndex) => {
                return (
                  <article key={`${groupName}-pool-${poolIndex}`} className="pool-block mb-3">
                    <div className="pool-block-header">
                      <div className="pool-block-title">
                        <span className="badge text-bg-primary">Pool {String.fromCharCode(65 + poolIndex)}</span>
                        <span>{pool.length} Kämpfer</span>
                      </div>
                      <select
                        className="form-select form-select-sm pool-system-select"
                        aria-label={`Kampfsystem ${groupName} Pool ${poolIndex + 1}`}
                        value={getPoolSystem(groupName, poolIndex)}
                        onChange={(event) =>
                          setPoolSystems((prev) => ({
                            ...prev,
                            [`${groupName}-${poolIndex}`]: event.target.value as "POOL" | "KO",
                          }))
                        }
                      >
                        <option value="POOL">Jeder gegen jeden</option>
                        <option value="KO">Doppel-KO-System</option>
                      </select>
                    </div>

                    {pool.length === 0 ? (
                      <div className="empty-pool-state">
                        Pool ist leer. Wähle diesen Pool bei einem Teilnehmer aus, um ihn hierhin zu verschieben.
                      </div>
                    ) : pool.map((fighter) => (
                      <div
                        key={`${groupName}-${buildParticipantKey(fighter)}`}
                        className="pool-fighter-row"
                      >
                        <div className="fighter-name">
                          {fighter.Vorname} {fighter.Nachname}
                          <span className="fighter-meta">{fighter.Verein} · {formatWeight(fighter.Gewicht)} kg</span>
                        </div>
                        <div className="d-flex align-items-center gap-2">
                          <label className="small text-secondary" htmlFor={`assignment-${poolIndex}-${buildParticipantKey(fighter)}`}>Pool</label>
                          <select
                            id={`assignment-${poolIndex}-${buildParticipantKey(fighter)}`}
                            className="form-select form-select-sm assignment-select"
                            value={String(
                              getPoolIndexForParticipant(
                                groupName,
                                fighter,
                                manualPoolAssignments,
                                suggestedGroups
                              )
                            )}
                            onChange={(event) =>
                              handleManualPoolChange(
                                groupName,
                                fighter,
                                Number(event.target.value)
                              )
                            }
                          >
                            {Array.from({ length: selectablePoolCount }, (_, index) => (
                              <option key={index} value={String(index)}>{String.fromCharCode(65 + index)}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </article>
                );
              })}
            </section>
          );
        }
      )}
    </div>
  );
}

export default PoolPage;