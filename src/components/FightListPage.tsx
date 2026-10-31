import type { Participant } from "../types/Participant";
import { useMemo } from "react";

import {
  buildPoolGroups,
} from "../lib/poolLogic";

interface Props {
  participants: Participant[];

  poolSystems: Record<
    string,
    "POOL" | "KO"
  >;
}

function FightListPage({
  participants,
  poolSystems,
}: Props) {

  const pools = useMemo(
    () =>
      buildPoolGroups(participants, {
        maxPoolSize: 4,
        maxWeightSpan: 6,
      }),
    [participants]
  );
  return (
    <div>
      <h1>Kampflisten</h1>

      {Object.entries(pools).map(
        ([groupName, groupPools]) =>
          groupPools.map((pool, poolIndex) => {
            const system =
              poolSystems[
                `${groupName}-${poolIndex}`
              ] ?? "POOL";

            return (
              <div
                key={`${groupName}-${poolIndex}`}
                style={{
                  border: "1px solid #ddd",
                  padding: "1rem",
                  marginBottom: "1rem",
                }}
              >
                <h3>
                  {groupName} - Pool{" "}
                  {String.fromCharCode(
                    65 + poolIndex
                  )}
                </h3>

                <p>
                  Teilnehmer: {pool.length}
                </p>

                <p>
                  Kampfsystem:{" "}
                  {system === "POOL"
                    ? "Pool-System"
                    : "KO-System"}
                </p>

                <h4>Teilnehmer</h4>

                <ul>
                  {pool.map((fighter) => (
                    <li
                      key={`${fighter.Vorname}-${fighter.Nachname}`}
                    >
                      {fighter.Vorname}{" "}
                      {fighter.Nachname}
                      {" - "}
                      {fighter.Gewicht} kg
                    </li>
                  ))}
                </ul>

                <div
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    marginTop: "1rem",
                  }}
                >
                  <button>
                    Kampfliste PDF
                  </button>

                  <button>
                    Teilnehmerliste PDF
                  </button>
                </div>
              </div>
            );
          })
      )}
    </div>
  );
}

export default FightListPage;