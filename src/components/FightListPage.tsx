import type { Participant } from "../types/Participant";

interface Props {
  participants: Participant[];
}

function FightListPage({
  participants,
}: Props) {
  return (
    <div>
      <h1>Kampflisten</h1>

      <p>
        Teilnehmer: {participants.length}
      </p>
    </div>
  );
}

export default FightListPage;