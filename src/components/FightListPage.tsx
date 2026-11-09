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

  const downloadSelectedPdf = (
    sheet: FightListPdfSheet,
    mode: FightListPdfMode
  ) => downloadFightListPdf([sheet], mode);

  if (poolSheets.length === 0) {
    return (
      <div>
        <h1>Kampflisten</h1>
        <p>Es gibt noch keine Pools. Erzeuge oder bearbeite zuerst die Pools.</p>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1>Kampflisten</h1>
          <p>{poolSheets.length} Pools aus der finalen Einteilung</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button onClick={() => downloadFightListPdf(poolSheets, "fights")}>
            Alle Kampflisten als PDF
          </button>
          <button onClick={() => downloadFightListPdf(poolSheets, "participants")}>
            Alle Teilnehmerlisten als PDF
          </button>
        </div>
      </div>

      {poolSheets.map((sheet) => {
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
          <section
            key={`${groupName}-${poolIndex}`}
            style={{
              borderTop: "1px solid #ccc",
              padding: "1rem 0",
              marginTop: "1rem",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "1rem",
                flexWrap: "wrap",
              }}
            >
              <div>
                <h2>{groupName} - Pool {poolLabel}</h2>
                <p>
                  {participants.length} Teilnehmer · {getSystemLabel(poolType, participants.length)} · {fights.length} Kämpfe
                </p>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <button onClick={() => downloadSelectedPdf(sheet, "fights")}>
                  Kampfliste PDF
                </button>
                <button onClick={() => downloadSelectedPdf(sheet, "participants")}>
                  Teilnehmerliste PDF
                </button>
              </div>
            </div>

            <h3>Teilnehmer</h3>
            <ol>
              {participants.map((participant, index) => (
                <li key={`${participant.Vorname}-${participant.Nachname}-${index}`}>
                  {participant.Vorname} {participant.Nachname} - {formatWeight(participant.Gewicht)} kg ({participant.Verein})
                </li>
              ))}
            </ol>

            {system === "KO" ? (
              <>
                <h3>Doppel-KO-Kampffolge</h3>
                <p>
                  Sieger rücken in der oberen Runde auf. Verlierer wechseln in die Verliererrunde; nach der zweiten Niederlage scheiden sie aus.
                </p>
                {doubleKoFights.map((fight) => (
                  <p key={fight.matchNumber}>
                    Kampf {fight.matchNumber} ({fight.stage}, Runde {fight.roundNumber}): {fight.first.label} gegen {fight.second.label}. Sieger: {fight.winnerDestination}. Verlierer: {fight.loserDestination}.
                  </p>
                ))}
              </>
            ) : (
              <>
                <h3>Kampffolge</h3>
                <ol>
                  {fights.map((fight) => (
                    <li key={fight.matchNumber}>
                      Runde {fight.roundNumber}: {fight.first.label} gegen {fight.second.label}
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