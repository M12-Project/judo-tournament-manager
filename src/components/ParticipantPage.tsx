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
    <div className="participant-page">
      <div className="page-heading">
        <div>
          <div className="page-kicker">Wettkampf vorbereiten</div>
          <h1>Teilnehmer</h1>
          <p>Teilnehmer importieren, wiegen und Starts verwalten.</p>
        </div>
      </div>

      <ExcelUpload
        participants={participants}
        setParticipants={setParticipants}
      />
    </div>
  );
}

export default ParticipantPage;