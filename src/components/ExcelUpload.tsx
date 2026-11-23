import { useState } from "react";
import * as XLSX from "xlsx";
import type { Participant } from "../types/Participant";
import {
  getAgeClassWarnings,
  getParticipantAgeClasses,
  normalizeParticipant,
  setParticipantAgeClasses,
} from "../lib/participantStarts";
import {
  applyWeighListUpdates,
  getWeighListParticipants,
} from "../lib/weighLists";

interface Props {
  participants: Participant[];
  setParticipants: React.Dispatch<
    React.SetStateAction<Participant[]>
  >;
}

const parseBooleanCell = (value: unknown, fallback: boolean) => {
  if (typeof value === "boolean") return value;

  const normalized = String(value ?? "").trim().toLowerCase();
  if (["true", "1", "ja", "yes"].includes(normalized)) return true;
  if (["false", "0", "nein", "no"].includes(normalized)) return false;
  return fallback;
};

const currentYear = new Date().getFullYear();

function ExcelUpload({
  participants,
  setParticipants,
}: Props) {

  const [search, setSearch] =
    useState("");
  const [weighListCategory, setWeighListCategory] = useState("U11|männlich");
  const [weighListImportMessage, setWeighListImportMessage] = useState("");

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
            Anwesend: parseBooleanCell(row.Anwesend, true),
            Bezahlt: parseBooleanCell(row.Bezahlt, false),
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

  const normalizedSearch = search.trim().toLowerCase();
  const filteredParticipants = participants.filter((participant) =>
    [participant.Vorname, participant.Nachname, participant.Verein].some(
      (value) => String(value ?? "").toLowerCase().includes(normalizedSearch)
    )
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

  const updateParticipantStatus = (
    targetParticipant: Participant,
    field: "Anwesend" | "Bezahlt",
    value: boolean
  ) => {
    setParticipants((prevParticipants) =>
      prevParticipants.map((participant) =>
        participant === targetParticipant
          ? field === "Anwesend"
            ? { ...participant, Anwesend: value, ...(value ? {} : { Bezahlt: false }) }
            : participant.Anwesend === false
              ? participant
              : { ...participant, Bezahlt: value }
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
        Anwesend: participant.Anwesend !== false,
        Bezahlt: participant.Bezahlt === true,
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

  const exportWeighList = () => {
    const [ageClass, gender] = weighListCategory.split("|");
    const weighListParticipants = getWeighListParticipants(
      participants,
      ageClass,
      gender
    );

    if (weighListParticipants.length === 0) {
      setWeighListImportMessage(`Keine anwesenden Teilnehmer für ${ageClass} - ${gender} gefunden.`);
      return;
    }

    const worksheet = XLSX.utils.json_to_sheet(
      weighListParticipants.map((participant) => ({
        "Teilnehmer-ID": participant.id ?? "",
        Vorname: participant.Vorname,
        Nachname: participant.Nachname,
        Jahrgang: participant.Jahrgang,
        Geschlecht: participant.Geschlecht,
        Altersklasse: ageClass,
        Gewicht: participant.Gewicht,
        Verein: participant.Verein,
      }))
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Wiegeliste");

    const genderPart = gender === "männlich" ? "maennlich" : "weiblich";
    XLSX.writeFile(workbook, `wiegeliste-${ageClass.toLowerCase()}-${genderPart}.xlsx`);
    setWeighListImportMessage("");
  };

  const handleWeighListReturn = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const workbook = XLSX.read(loadEvent.target?.result, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          setWeighListImportMessage("Die Datei enthält kein Tabellenblatt.");
          return;
        }

        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
          workbook.Sheets[sheetName],
          { defval: "" }
        );
        const result = applyWeighListUpdates(participants, rows);
        setParticipants(result.participants);
        setWeighListImportMessage(
          `${result.updated} Gewichte aktualisiert. ${result.notFound} Teilnehmer-IDs nicht gefunden, ${result.invalid} ungültige Gewichte ignoriert. Es wurden keine Teilnehmer hinzugefügt.`
        );
      } catch {
        setWeighListImportMessage("Die Wiegeliste konnte nicht gelesen werden.");
      } finally {
        event.target.value = "";
      }
    };

    reader.readAsArrayBuffer(file);
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
        <div className="weigh-list-tools">
          <label className="weigh-list-category">
            <span>Separate Wiegeliste</span>
            <select
              className="form-select"
              aria-label="Wiegelisten-Kategorie"
              value={weighListCategory}
              onChange={(event) => setWeighListCategory(event.target.value)}
            >
              {["U11", "U13", "U15"].flatMap((ageClass) =>
                ["männlich", "weiblich"].map((gender) => (
                  <option key={`${ageClass}|${gender}`} value={`${ageClass}|${gender}`}>
                    {ageClass} - {gender}
                  </option>
                ))
              )}
            </select>
          </label>
          <button className="btn btn-outline-primary" onClick={exportWeighList}>
            Wiegeliste exportieren
          </button>
          <label className="btn btn-outline-secondary mb-0">
            Rücklauf importieren
            <input
              className="visually-hidden"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleWeighListReturn}
            />
          </label>
        </div>
        {weighListImportMessage && (
          <p className="weigh-list-import-message" role="status">
            {weighListImportMessage}
          </p>
        )}

        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
          <div className="d-flex flex-wrap gap-2">
            <span className="stat-chip">{participants.length} Teilnehmer</span>
            <span className="stat-chip">
              {participants.filter((participant) => participant.Anwesend !== false).length} anwesend
            </span>
            <span className="stat-chip">
              {participants.filter((participant) => participant.Bezahlt === true).length} bezahlt
            </span>
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
              placeholder="Name oder Verein suchen ..."
              aria-label="Teilnehmer oder Verein suchen"
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
            <table className="table table-hover align-middle participant-table mb-0">
              <thead>
                <tr>
                  <th>Teilnehmer</th>
                  <th>Jahrgang</th>
                  <th>Geschlecht</th>
                  <th className="text-center">Gewicht</th>
                  <th className="text-center">Starts</th>
                  <th className="participant-age-column text-center">Altersprüfung</th>
                  <th>Verein</th>
                  <th className="text-center">Anwesend</th>
                  <th className="text-center">Bezahlt</th>
                  <th className="text-end">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {filteredParticipants.map((participant, index) => {
                  const participantKey = getParticipantKey(participant, index);
                  const ageClasses = getParticipantAgeClasses(participant);
                  const ageClassValue = ageClasses.join(", ");
                  const ageWarnings = getAgeClassWarnings(
                    participant,
                    currentYear
                  );
                  const hasExistingChoice = !ageClassChoices.some(
                    (choice) => choice.value === ageClassValue
                  );

                  return (
                    <tr
                      key={participantKey}
                      className={participant.Anwesend === false ? "participant-row-absent" : ""}
                    >
                      <td className="participant-name-cell">
                        {participant.Vorname} {participant.Nachname}
                      </td>
                      <td>{participant.Jahrgang}</td>
                      <td>{participant.Geschlecht}</td>
                      <td className="text-center">
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
                      <td className="text-center">
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
                      <td className="participant-age-column text-center">
                        <div className={`participant-age-check${ageWarnings.length > 0 ? " is-warning" : " is-valid"}`} role="status">
                          <span>{ageWarnings.length > 0 ? "Warnung" : "Passt"}</span>
                          {ageWarnings.length > 0 && <small>{ageWarnings.join(" ")}</small>}
                        </div>
                      </td>
                      <td className="participant-club-cell">{participant.Verein}</td>
                      <td className="text-center">
                        <div className="form-check form-switch participant-status-switch">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            aria-label={`Anwesenheit für ${participant.Vorname} ${participant.Nachname}`}
                            checked={participant.Anwesend !== false}
                            onChange={(event) =>
                              updateParticipantStatus(participant, "Anwesend", event.target.checked)
                            }
                          />
                        </div>
                      </td>
                      <td className="text-center">
                        <div className="form-check form-switch participant-status-switch">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            aria-label={`Bezahlt für ${participant.Vorname} ${participant.Nachname}`}
                            title={participant.Anwesend === false ? "Abwesende Teilnehmer können nicht bezahlt werden" : undefined}
                            checked={participant.Bezahlt === true}
                            disabled={participant.Anwesend === false}
                            onChange={(event) =>
                              updateParticipantStatus(participant, "Bezahlt", event.target.checked)
                            }
                          />
                        </div>
                      </td>
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