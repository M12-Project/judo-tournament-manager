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
      console.log(jsonData);
    };

    reader.readAsArrayBuffer(file);
  };

  const deleteParticipant = (indexToDelete: number) => {
    setParticipants(
      participants.filter(
        (_, index) => index !== indexToDelete
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
    index: number,
    value: string
  ) => {
    const updated = [...participants];

    updated[index].Gewicht = value;

    setParticipants(updated);
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

  const createPools = (
    participants: any[]
  ) => {
    const sorted = [...participants].sort(
      (a, b) =>
        Number(a.Gewicht) -
        Number(b.Gewicht)
    );

    const pools = [];

    for (let i = 0; i < sorted.length; i += 4) {
      pools.push(
        sorted.slice(i, i + 4)
      );
    }

    return pools;
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
            <tr key={index}>
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
                      index,
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
                  deleteParticipant(index)
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