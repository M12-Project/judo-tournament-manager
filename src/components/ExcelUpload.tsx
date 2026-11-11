import { useState } from "react";
import * as XLSX from "xlsx";
import type { Participant } from "../types/Participant";
import {
  getParticipantAgeClasses,
  normalizeParticipant,
  setParticipantAgeClasses,
} from "../lib/participantStarts";

interface Props {
  participants: Participant[];
  setParticipants: React.Dispatch<
    React.SetStateAction<Participant[]>
  >;
}

function ExcelUpload({
  participants,
  setParticipants,
}: Props) {

  const [search, setSearch] =
    useState("");

  const getParticipantKey = (participant: Participant, index: number) =>
    participant.id ?? `${participant.Vorname}-${participant.Nachname}-${participant.Jahrgang}-${index}`;

  const ageClassChoices = [
    { value: "", label: "Altersklasse wählen" },
    ...Array.from(new Set([
      "U11",
      "U13",
      "U15",
      ...participants.flatMap(getParticipantAgeClasses),
    ])).map((ageClass) => ({
      value: ageClass,
      label: ageClass,
    })),
    { value: "U11, U13", label: "Doppelstart: U11 + U13" },
    { value: "U13, U15", label: "Doppelstart: U13 + U15" },
  ];

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
        ...(jsonData as Array<Record<string, unknown>>).map((row) =>
          normalizeParticipant({
            Vorname: String(row.Vorname ?? ""),
            Nachname: String(row.Nachname ?? ""),
            Jahrgang: Number(row.Jahrgang ?? 0),
            Geschlecht: String(row.Geschlecht ?? ""),
            Gewicht: Number(row.Gewicht ?? 0),
            Altersklasse: String(row.Altersklasse ?? row.Altersklassen ?? ""),
            Verein: String(row.Verein ?? ""),
          })
        ),
      ]);

      event.target.value = "";
    };

    reader.readAsArrayBuffer(file);
  };

  const deleteParticipant = (participantToDelete: Participant) => {
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

  const updateWeight = (targetParticipant: Participant, value: string) => {
    if (value === "") {
      return;
    }

    const weight = Number(value);

    if (!Number.isFinite(weight)) {
      return;
    }

    setParticipants((prevParticipants) =>
      prevParticipants.map((participant) =>
        participant === targetParticipant
          ? {
              ...participant,
              Gewicht: weight,
            }
          : participant
      )
    );
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
        Altersklasse: getParticipantAgeClasses(participant).join(", "),
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
    <section className="workspace-panel">
      <div className="workspace-panel-header flex-wrap">
        <div>
          <h2>Teilnehmerliste</h2>
          <div className="small text-secondary mt-1">Excel-Datei importieren oder Wiegedaten direkt bearbeiten</div>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <label className="btn btn-outline-primary mb-0">
            Excel importieren
            <input
              className="visually-hidden"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFile}
            />
          </label>
          <button className="btn btn-primary" onClick={exportToExcel}>
            Excel exportieren
          </button>
          <button
            className="btn btn-outline-danger"
            onClick={() => {
              if (window.confirm("Wirklich alle Teilnehmer löschen?")) {
                setParticipants([]);
              }
            }}
          >
            Alle löschen
          </button>
        </div>
      </div>

      <div className="workspace-panel-body">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
          <div className="d-flex flex-wrap gap-2">
            <span className="stat-chip">{participants.length} Teilnehmer</span>
            <span className="stat-chip">
              {participants.reduce(
                (total, participant) => total + getParticipantAgeClasses(participant).length,
                0
              )} Starts
            </span>
          </div>
          <div className="participant-search">
            <input
              className="form-control"
              type="search"
              placeholder="Name suchen ..."
              aria-label="Teilnehmer suchen"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        {participants.length === 0 ? (
          <div className="empty-state">
            <h2>Noch keine Teilnehmer</h2>
            <p>Importiere eine Excel-Liste, um mit der Einteilung zu beginnen.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th>Vorname</th>
                  <th>Nachname</th>
                  <th>Jahrgang</th>
                  <th>Geschlecht</th>
                  <th>Gewicht</th>
                  <th>Starts</th>
                  <th>Verein</th>
                  <th className="text-end">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {filteredParticipants.map((participant, index) => {
                  const participantKey = getParticipantKey(participant, index);
                  const ageClasses = getParticipantAgeClasses(participant);
                  const ageClassValue = ageClasses.join(", ");
                  const hasExistingChoice = !ageClassChoices.some(
                    (choice) => choice.value === ageClassValue
                  );

                  return (
                    <tr key={participantKey}>
                      <td className="fw-semibold">{participant.Vorname}</td>
                      <td className="fw-semibold">{participant.Nachname}</td>
                      <td>{participant.Jahrgang}</td>
                      <td>{participant.Geschlecht}</td>
                      <td>
                        <div className="input-group input-group-sm weight-input">
                          <input
                            className="form-control"
                            type="number"
                            step="0.1"
                            min="0"
                            aria-label={`Gewicht ${participant.Vorname} ${participant.Nachname}`}
                            value={participant.Gewicht}
                            onChange={(event) => updateWeight(participant, event.target.value)}
                          />
                          <span className="input-group-text">kg</span>
                        </div>
                      </td>
                      <td>
                        <select
                          className="form-select form-select-sm age-class-select"
                          aria-label={`Altersklassen für ${participant.Vorname} ${participant.Nachname}`}
                          value={ageClassValue}
                          onChange={(event) =>
                            setParticipants((prevParticipants) =>
                              prevParticipants.map((currentParticipant) =>
                                currentParticipant === participant
                                  ? setParticipantAgeClasses(currentParticipant, event.target.value)
                                  : currentParticipant
                              )
                            )
                          }
                        >
                          {hasExistingChoice && (
                            <option value={ageClassValue}>{ageClasses.join(" + ")}</option>
                          )}
                          {ageClassChoices.map((choice) => (
                            <option key={choice.value} value={choice.value}>{choice.label}</option>
                          ))}
                        </select>
                      </td>
                      <td>{participant.Verein}</td>
                      <td className="text-end">
                        <button
                          className="btn btn-sm btn-outline-danger"
                          aria-label={`Teilnehmer ${participant.Vorname} ${participant.Nachname} löschen`}
                          onClick={() => deleteParticipant(participant)}
                        >
                          Löschen
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

export default ExcelUpload;