import { useEffect, useMemo, useState } from "react";
import type { Participant } from "../types/Participant";
import {
  buildPoolGroups,
  getDjb2026WeightClass,
  groupParticipantsByCategory,
  groupParticipantsByDjb2026WeightClass,
  isDjb2026FixedWeightClassGroup,
} from "../lib/poolLogic";
import {
  expandParticipantsIntoStarts,
  getPresentParticipants,
} from "../lib/participantStarts";
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
  djbPoolSystems: Record<string, "POOL" | "KO">;
  setDjbPoolSystems: React.Dispatch<
    React.SetStateAction<Record<string, "POOL" | "KO">>
  >;
  setDjbGeneratedPools: React.Dispatch<
    React.SetStateAction<Record<string, Participant[][]>>
  >;
}

type AssignmentMode = "free" | "djb2026";

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
  djbPoolSystems,
  setDjbPoolSystems,
  setDjbGeneratedPools,
}: Props) {
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>("free");
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
  const [manualPoolAssignmentsByMode, setManualPoolAssignmentsByMode] = useState<
    Record<AssignmentMode, Record<string, number>>
  >({ free: {}, djb2026: {} });
  const [additionalPoolCountsByMode, setAdditionalPoolCountsByMode] = useState<
    Record<AssignmentMode, Record<string, number>>
  >({ free: {}, djb2026: {} });
  const manualPoolAssignments = manualPoolAssignmentsByMode[assignmentMode];
  const additionalPoolCounts = additionalPoolCountsByMode[assignmentMode];
  const activePoolSystems = assignmentMode === "free" ? poolSystems : djbPoolSystems;
  const setActivePoolSystems = assignmentMode === "free" ? setPoolSystems : setDjbPoolSystems;

  const groupedParticipants = useMemo(
    () => {
      const starts = expandParticipantsIntoStarts(getPresentParticipants(participants));
      return assignmentMode === "djb2026"
        ? groupParticipantsByDjb2026WeightClass(starts)
        : groupParticipantsByCategory(starts);
    },
    [participants, assignmentMode]
  );

  const filteredGroups = Object.entries(groupedParticipants).filter(
    ([groupName]) => matchesGroupSearch(groupName, groupSearch)
  );

  const suggestedGroups = useMemo(
    () =>
      buildPoolGroups(
        expandParticipantsIntoStarts(getPresentParticipants(participants)),
        {
        maxPoolSize,
        maxWeightSpan,
        useDjb2026WeightClasses: assignmentMode === "djb2026",
        }
      ),
    [participants, maxPoolSize, maxWeightSpan, assignmentMode]
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

  const handleManualPoolChange = (
    groupName: string,
    participant: Participant,
    targetPoolIndex: number
  ) => {
    const key = `${groupName}|${buildParticipantKey(participant)}`;

    setManualPoolAssignmentsByMode((prev) => ({
      ...prev,
      [assignmentMode]: {
        ...prev[assignmentMode],
        [key]: targetPoolIndex,
      },
    }));
  };

  const getPoolSystem = (
    groupName: string,
    poolIndex: number
  ) => {
    if (
      assignmentMode === "djb2026" &&
      isDjb2026FixedWeightClassGroup(groupName)
    ) {
      return "KO";
    }

    const key = `${groupName}-${poolIndex}`;

    return activePoolSystems[key] ?? "POOL";
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
      (assignmentMode === "free" ? setGeneratedPools : setDjbGeneratedPools)((currentPools) =>
        JSON.stringify(currentPools) === JSON.stringify(finalizedPools)
          ? currentPools
          : finalizedPools
      );
  }, [assignmentMode, finalizedPools, setDjbGeneratedPools, setGeneratedPools]);

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

      <div className="btn-group mb-4" role="group" aria-label="Einteilungsmodus">
        <button
          type="button"
          className={`btn ${assignmentMode === "free" ? "btn-primary" : "btn-outline-primary"}`}
          aria-pressed={assignmentMode === "free"}
          onClick={() => setAssignmentMode("free")}
        >
          Freie Pools
        </button>
        <button
          type="button"
          className={`btn ${assignmentMode === "djb2026" ? "btn-primary" : "btn-outline-primary"}`}
          aria-pressed={assignmentMode === "djb2026"}
          onClick={() => setAssignmentMode("djb2026")}
        >
          DJB-Gewichtsklassen 2026
        </button>
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
            <h2>{assignmentMode === "free" ? "Freie Poolregeln" : "DJB 2026: feste Gewichtsklassen"}</h2>
            <div className="small text-secondary mt-1">{assignmentMode === "free" ? "Gewichtsabstand und Poolgröße für die automatische Einteilung" : "Feste Klassen bleiben zusammen und starten direkt im KO-System. U11 wird mangels Gewichtsklassen frei gepoolt."}</div>
          </div>
          <span className="badge text-bg-light border">{assignmentMode === "free" ? "Manuell anpassbar" : "DJB-Klassen fest · direkt KO"}</span>
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
          const fixedDjbWeightClass =
            assignmentMode === "djb2026" &&
            isDjb2026FixedWeightClassGroup(groupName);
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
                {!fixedDjbWeightClass && (
                  <button
                    className="btn btn-sm btn-outline-primary"
                    type="button"
                    onClick={() => setAdditionalPoolCountsByMode((counts) => ({
                      ...counts,
                      [assignmentMode]: {
                        ...counts[assignmentMode],
                        [groupName]: (counts[assignmentMode][groupName] ?? 0) + 1,
                      },
                    }))}
                  >
                    <span aria-hidden="true">+</span> Pool hinzufügen
                  </button>
                )}
              </div>
              {fixedDjbWeightClass && fighters.length > 32 && (
                <div className="alert alert-warning" role="alert">
                  Diese Gewichtsklasse hat {fighters.length} Teilnehmende. Bitte prüfen: vorgesehen sind maximal 32.
                </div>
              )}
              {pools.map((pool, poolIndex) => {
                return (
                  <article key={`${groupName}-pool-${poolIndex}`} className="pool-block mb-3">
                    <div className="pool-block-header">
                      <div className="pool-block-title">
                        <span className="badge text-bg-primary">
                          {fixedDjbWeightClass ? "DJB-KO" : `Pool ${String.fromCharCode(65 + poolIndex)}`}
                        </span>
                        <span>{pool.length} Kämpfer</span>
                      </div>
                      {fixedDjbWeightClass ? (
                        <span className="badge text-bg-success">Doppel-KO-System</span>
                      ) : (
                        <select
                          className="form-select form-select-sm pool-system-select"
                          aria-label={`Kampfsystem ${groupName} Pool ${poolIndex + 1}`}
                          value={getPoolSystem(groupName, poolIndex)}
                          onChange={(event) =>
                            setActivePoolSystems((prev) => ({
                              ...prev,
                              [`${groupName}-${poolIndex}`]: event.target.value as "POOL" | "KO",
                            }))
                          }
                        >
                          <option value="POOL">Jeder gegen Jeden</option>
                          <option value="KO">KO-System</option>
                        </select>
                      )}
              </div>

                    {pool.length === 0 ? (
                      <div className="empty-pool-state">
                        {fixedDjbWeightClass
                          ? "Keine Teilnehmenden in dieser festen Gewichtsklasse."
                          : "Pool ist leer. Wähle diesen Pool bei einem Teilnehmer aus, um ihn hierhin zu verschieben."}
                      </div>
                    ) : pool.map((fighter) => (
                      <div
                        key={`${groupName}-${buildParticipantKey(fighter)}`}
                        className="pool-fighter-row"
                      >
                        <div className="fighter-name">
                          {fighter.Vorname} {fighter.Nachname}
                          <span className="fighter-meta">{fighter.Verein} · {formatWeight(fighter.Gewicht)} kg</span>
                          {assignmentMode === "djb2026" && (
                            <span className="badge text-bg-light border mt-1">
                              {getDjb2026WeightClass(
                                fighter.Altersklasse,
                                fighter.Geschlecht,
                                Number(fighter.Gewicht)
                              ) ?? "Keine feste Gewichtsklasse"}
                            </span>
                          )}
                        </div>
                        {!fixedDjbWeightClass && (
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
                        )}
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