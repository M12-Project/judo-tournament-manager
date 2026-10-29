import type { Participant } from "../types/Participant";

interface Props {
  participants: Participant[];
}

function PoolPage({ participants }: Props) {
  const groups = participants.reduce(
    (
      acc: Record<string, Participant[]>,
      participant
    ) => {
      const key =
        `${participant.Altersklasse} - ${participant.Geschlecht}`;

      if (!acc[key]) {
        acc[key] = [];
      }

      acc[key].push(participant);

      return acc;
    },
    {}
  );

  return (
    <div>
      <h1>Poolgenerator</h1>

      {Object.entries(groups).map(
  ([groupName, fighters]) => {

    const sortedFighters = [...fighters].sort(
      (a, b) => a.Gewicht - b.Gewicht
    );

    return (
      <div key={groupName}>
        <h3>
          {groupName} ({fighters.length})
        </h3>

        {sortedFighters.map(
          (fighter, index) => (
            <div key={index}>
              {fighter.Vorname}
              {" "}
              {fighter.Nachname}
              {" - "}
              {fighter.Gewicht} kg
            </div>
          )
        )}
      </div>
    );
  }
)}
    </div>
  );
}

export default PoolPage;