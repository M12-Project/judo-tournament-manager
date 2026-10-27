import ExcelUpload from "./ExcelUpload";
import type { Participant } from "../types/Participant";

interface Props {
  participants: Participant[];
  setParticipants: React.Dispatch<
    React.SetStateAction<Participant[]>
  >;
}

function ParticipantPage({
  participants,
  setParticipants,
}: Props) {
  return (
    <div>
      <h1>Teilnehmerverwaltung</h1>

      <ExcelUpload
        participants={participants}
        setParticipants={setParticipants}
      />
    </div>
  );
}

export default ParticipantPage;