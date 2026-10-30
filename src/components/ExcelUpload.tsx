import { useState } from "react";
import * as XLSX from "xlsx";

interface Props {
  participants: any[];
  setParticipants: React.Dispatch<
    React.SetStateAction<any[]>
  >;
}

function ExcelUpload({
  participants,
  setParticipants,
}: Props) {

  const [search, setSearch] =
    useState("");

  const handleFile = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = (e) => {
      const data = e.target?.result;

      const workbook = XLSX.read(data, {
        type: "array",
      });

      const sheetName =
        workbook.SheetNames[0];

      const worksheet =
        workbook.Sheets[sheetName];

      const jsonData =
        XLSX.utils.sheet_to_json(worksheet);

      setParticipants((prevParticipants) => [
        ...prevParticipants,
        ...(jsonData as any[]),
      ]);

      event.target.value = "";
    };

    reader.readAsArrayBuffer(file);
  };

  const deleteParticipant = (participantToDelete: any) => {
    setParticipants((prevParticipants) =>
      prevParticipants.filter(
        (participant) =>
          participant !== participantToDelete
      )
    );
  };

  const filteredParticipants =
    participants.filter((participant) =>
      `${participant.Vorname ?? ""} ${
        participant.Nachname ?? ""
      }`
        .toLowerCase()
        .includes(search.toLowerCase())
    );

  const updateWeight = (
    targetParticipant: any,
    value: string
  ) => {
    setParticipants((prevParticipants) =>
      prevParticipants.map((participant) =>
        participant === targetParticipant
          ? {
              ...participant,
              Gewicht: value,
            }
          : participant
      )
    );
  };

  const groupParticipants = () => {
    const groups = participants.reduce(
      (acc: any, participant: any) => {
        const key =
          `${participant.Altersklasse}-${participant.Geschlecht}`;

        if (!acc[key]) {
          acc[key] = [];
        }

        acc[key].push(participant);

        return acc;
      },
      {}
    );

    console.log(groups);
  };

  const exportToExcel = () => {
    if (participants.length === 0) {
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(
      participants.map((participant) => ({
        Vorname: participant.Vorname ?? "",
        Nachname: participant.Nachname ?? "",
        Jahrgang: participant.Jahrgang ?? "",
        Geschlecht: participant.Geschlecht ?? "",
        Gewicht: participant.Gewicht ?? "",
        Altersklasse: participant.Altersklasse ?? "",
        Verein: participant.Verein ?? "",
      }))
    );

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Teilnehmer"
    );

    XLSX.writeFile(workbook, "teilnehmer.xlsx");
  };

  return (
    <div>
      <h2>Excel Import</h2>

      <input
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFile}
      />

      <hr />

      <button
        onClick={() => {
          if (
            window.confirm(
              "Wirklich alle Teilnehmer löschen?"
            )
          ) {
            setParticipants([]);
          }
        }}
      >
        Alle Teilnehmer löschen
      </button>

      <button onClick={groupParticipants}>
        Gruppen erzeugen
      </button>

      <button onClick={exportToExcel}>
        Excel exportieren
      </button>

      <p>
        Teilnehmer: {participants.length}
      </p>

      <input
        type="text"
        placeholder="Teilnehmer suchen..."
        value={search}
        onChange={(e) =>
          setSearch(e.target.value)
        }
      />

      <table>
        <thead>
          <tr>
            <th>Vorname</th>
            <th>Nachname</th>
            <th>Jahrgang</th>
            <th>Geschlecht</th>
            <th>Gewicht</th>
            <th>Altersklasse</th>
            <th>Verein</th>
            <th>Aktion</th>
          </tr>
        </thead>

        <tbody>
          {filteredParticipants.map((participant, index) => (
            <tr
              key={`${participant.Vorname}-${participant.Nachname}-${participant.Jahrgang}-${participant.Verein}-${index}`}
            >
              <td>{participant.Vorname}</td>
              <td>{participant.Nachname}</td>
              <td>{participant.Jahrgang}</td>
              <td>{participant.Geschlecht}</td>
              <td>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={participant.Gewicht}
                  onChange={(e) =>
                    updateWeight(
                      participant,
                      e.target.value
                    )
                  }
                />
              </td>
              <td>{participant.Altersklasse}</td>
              <td>{participant.Verein}</td>
              <td>
                <button
                  onClick={() =>
                    deleteParticipant(participant)
                  }
                >
                  Löschen
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ExcelUpload;