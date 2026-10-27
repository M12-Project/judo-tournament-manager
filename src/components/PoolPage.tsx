import type { Participant } from "../types/Participant";

interface Props {
  participants: Participant[];
}

function PoolPage({
  participants,
}: Props) {
  return (
    <div>
      <h1>Poolgenerator</h1>

      <p>
        Teilnehmer: {participants.length}
      </p>
    </div>
  );
}

export default PoolPage;