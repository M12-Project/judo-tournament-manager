import { useState } from "react";
import type { Participant } from "../types/Participant";
import type { PoolType } from "../types/PoolType";
import {
  createDoubleKnockoutFights,
  createRoundRobinFights,
  getPoolType,
} from "../lib/fightListLogic";
import {
  downloadFightListPdf,
  type FightListPdfSheet,
  type FightListPdfMode,
} from "../lib/fightListPdf";
import { matchesGroupSearch } from "../lib/groupSearch";

interface Props {
  poolSystems: Record<string, "POOL" | "KO">;
  generatedPools: Record<string, Participant[][]>;
}

const formatWeight = (weight: number | string) => {
  const numericWeight = Number(weight);

  return Number.isInteger(numericWeight)
    ? String(numericWeight)
    : numericWeight.toFixed(1).replace(/\.0$/, "");
};

const getSystemLabel = (poolType: PoolType | null, poolSize: number) => {
  if (poolType === "KO") {
    return "Doppel-KO-System";
  }

  return poolType
    ? `${poolType} - Jeder gegen jeden`
    : `${poolSize} Teilnehmer - Jeder gegen jeden`;
};

function FightListPage({ poolSystems, generatedPools }: Props) {
  const [groupSearch, setGroupSearch] = useState("");
  const poolSheets: FightListPdfSheet[] = Object.entries(generatedPools)
    .flatMap(([groupName, pools]) =>
      pools.flatMap((participants, poolIndex) => {
        if (participants.length === 0) {
          return [];
        }

        return [{
          groupName,
          poolIndex,
          participants,
          system: poolSystems[`${groupName}-${poolIndex}`] ?? "POOL",
        }];
      })
    );

  const filteredPoolSheets = poolSheets.filter((sheet) =>
    matchesGroupSearch(sheet.groupName, groupSearch)
  );

  const downloadSelectedPdf = (
    sheet: FightListPdfSheet,
    mode: FightListPdfMode
  ) => downloadFightListPdf([sheet], mode);

  if (poolSheets.length === 0) {
    return (
      <div>
        <div className="page-heading">
          <div>
            <div className="page-kicker">Ablauf und Ausdruck</div>
            <h1>Kampflisten</h1>
          </div>
        </div>
        <div className="empty-state">
          <h2>Noch keine Pools erstellt</h2>
          <p>Erzeuge oder bearbeite zuerst die Einteilung im Poolgenerator.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fight-list-page">
      <div className="page-heading flex-wrap">
        <div>
          <div className="page-kicker">Ablauf und Ausdruck</div>
          <h1>Kampflisten</h1>
          <p>Finale Einteilung und Kampfabläufe für den Wettkampftag.</p>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <span className="stat-chip align-self-center">{filteredPoolSheets.length} von {poolSheets.length} Pools</span>
          <button className="btn btn-primary" onClick={() => downloadFightListPdf(poolSheets, "fights")}>
            Alle Kampflisten als PDF
          </button>
          <button className="btn btn-outline-primary" onClick={() => downloadFightListPdf(poolSheets, "participants")}>
            Alle Teilnehmerlisten als PDF
          </button>
        </div>
      </div>

      <div className="group-search-row">
        <div className="group-search-input">
          <label className="form-label" htmlFor="fight-group-search">Gruppe suchen</label>
          <input
            id="fight-group-search"
            className="form-control"
            type="search"
            placeholder="z. B. U15 - männlich"
            value={groupSearch}
            onChange={(event) => setGroupSearch(event.target.value)}
          />
        </div>
      </div>

      {filteredPoolSheets.length === 0 ? (
        <div className="empty-state">
          <h2>Keine passende Gruppe gefunden</h2>
          <p>Ändere den Suchbegriff, zum Beispiel auf U11 oder weiblich.</p>
        </div>
      ) : filteredPoolSheets.map((sheet) => {
        const { groupName, poolIndex, participants, system } = sheet;
        const poolType = getPoolType(participants.length, system);
        const doubleKoFights = system === "KO"
          ? createDoubleKnockoutFights(participants)
          : [];
        const fights = system === "KO"
          ? doubleKoFights
          : createRoundRobinFights(participants);
        const poolLabel = String.fromCharCode(65 + poolIndex);

        return (
          <section key={`${groupName}-${poolIndex}`} className="fight-section">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
              <div>
                <h2>{groupName} <span className="text-secondary">/</span> Pool {poolLabel}</h2>
                <div className="d-flex flex-wrap gap-2 mt-2">
                  <span className="badge rounded-pill text-bg-light border">{participants.length} Teilnehmer</span>
                  <span className="badge rounded-pill text-bg-success">{getSystemLabel(poolType, participants.length)}</span>
                  <span className="badge rounded-pill text-bg-light border">{fights.length} Kämpfe</span>
                </div>
              </div>
              <div className="d-flex flex-wrap gap-2">
                <button className="btn btn-sm btn-primary" onClick={() => downloadSelectedPdf(sheet, "fights")}>
                  Kampfliste PDF
                </button>
                <button className="btn btn-sm btn-outline-primary" onClick={() => downloadSelectedPdf(sheet, "participants")}>
                  Teilnehmerliste PDF
                </button>
              </div>
            </div>

            <div className="workspace-panel mb-3">
              <div className="workspace-panel-header">
                <h3>Teilnehmer</h3>
              </div>
              <div className="table-responsive">
                <table className="table table-sm table-hover align-middle mb-0">
                  <thead>
                    <tr><th>Los</th><th>Name</th><th>Gewicht</th><th>Verein</th></tr>
                  </thead>
                  <tbody>
                    {participants.map((participant, index) => (
                      <tr key={`${participant.Vorname}-${participant.Nachname}-${index}`}>
                        <td>{index + 1}</td>
                        <td className="fw-semibold">{participant.Vorname} {participant.Nachname}</td>
                        <td>{formatWeight(participant.Gewicht)} kg</td>
                        <td>{participant.Verein}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {system === "KO" ? (
              <>
                <h3>Doppel-KO-Kampffolge</h3>
                <p className="text-secondary small mb-3">
                  Sieger rücken in der oberen Runde auf. Verlierer wechseln in die Verliererrunde; nach der zweiten Niederlage scheiden sie aus.
                </p>
                <div className="row g-2">
                  {doubleKoFights.map((fight) => (
                    <div className="col-12 col-xl-6" key={fight.matchNumber}>
                      <div className="border rounded-2 p-3 h-100 bg-white">
                        <div className="d-flex justify-content-between gap-2 mb-2">
                          <strong>Kampf {fight.matchNumber}</strong>
                          <span className="badge text-bg-light border">{fight.stage} · Runde {fight.roundNumber}</span>
                        </div>
                        <div className="small mb-2">{fight.first.label} <span className="text-secondary">gegen</span> {fight.second.label}</div>
                        <div className="small text-success">Sieger: {fight.winnerDestination}</div>
                        <div className="small text-danger">Verlierer: {fight.loserDestination}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <h3>Kampffolge</h3>
                <ol className="fight-sequence mb-0">
                  {fights.map((fight) => (
                    <li key={fight.matchNumber}>
                      <span className="badge text-bg-light border me-2">Runde {fight.roundNumber}</span>
                      <span className="fw-semibold">{fight.first.label}</span>
                      <span className="text-secondary mx-2">gegen</span>
                      <span className="fw-semibold">{fight.second.label}</span>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}

export default FightListPage;