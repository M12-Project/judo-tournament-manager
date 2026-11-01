import type { jsPDF } from "jspdf";
import type { Participant } from "../types/Participant";
import type { PoolType } from "../types/PoolType";
import {
  createKnockoutFights,
  createRoundRobinFights,
  getPoolType,
} from "./fightListLogic";

export interface FightListPdfSheet {
  groupName: string;
  poolIndex: number;
  participants: Participant[];
  system: "POOL" | "KO";
}

export type FightListPdfMode = "fights" | "participants";

const toFilenamePart = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const capitalize = (value: string) =>
  value.length > 0
    ? `${value[0].toLocaleUpperCase("de-DE")}${value.slice(1)}`
    : value;

export function getFightListPdfFilename(
  sheets: FightListPdfSheet[],
  mode: FightListPdfMode
) {
  const documentType = mode === "fights" ? "Kampfliste" : "Teilnehmerliste";
  const pluralDocumentType = mode === "fights"
    ? "Kampflisten"
    : "Teilnehmerlisten";

  if (sheets.length === 0) {
    return `Judo-${documentType}.pdf`;
  }

  const categories = Array.from(new Set(
    sheets.map((sheet) => {
      const participant = sheet.participants[0];

      if (!participant) {
        return toFilenamePart(sheet.groupName);
      }

      return [
        toFilenamePart(participant.Altersklasse),
        toFilenamePart(capitalize(participant.Geschlecht)),
      ].filter(Boolean).join("-");
    })
  ));

  const categoryLabel = categories.length === 1
    ? categories[0]
    : "Alle-Gruppen";

  if (sheets.length === 1) {
    const [sheet] = sheets;
    const highestWeight = Math.max(
      ...sheet.participants.map((participant) => Number(participant.Gewicht))
        .filter(Number.isFinite),
      0
    );
    const weightLabel = `${formatWeight(highestWeight)}kg`;
    const poolLabel = `Pool-${String.fromCharCode(65 + sheet.poolIndex)}`;

    return `${categoryLabel}-bis-${weightLabel}-${poolLabel}-${documentType}.pdf`;
  }

  const scopeLabel = categories.length === 1 ? "Alle-Pools" : "Alle-Gruppen";
  return `Judo-${categoryLabel}-${scopeLabel}-${pluralDocumentType}.pdf`;
}

const getPoolTypeLabel = (poolType: PoolType | null, poolSize: number) => {
  if (poolType === "KO") {
    return "KO-System";
  }

  return poolType
    ? `${poolType} - Jeder gegen jeden`
    : `${poolSize} Teilnehmer - Jeder gegen jeden`;
};

const formatWeight = (weight: number) =>
  Number.isInteger(weight) ? String(weight) : weight.toFixed(1).replace(/\.0$/, "");

const drawPoolHeader = (
  pdf: jsPDF,
  groupName: string,
  poolLabel: string,
  poolTypeLabel: string,
  maxWeight: number,
  participantCount: number
) => {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const fieldCount = Math.max(0, participantCount);
  const fieldsWidth = Math.min(140, pageWidth - 28);
  const fieldGap = 2;
  const fieldWidth = fieldCount > 0
    ? (fieldsWidth - fieldGap * (fieldCount - 1)) / fieldCount
    : 0;
  const fieldsX = (pageWidth - fieldsWidth) / 2;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text("Kampfliste", 14, 17);
  pdf.setFontSize(12);
  pdf.text(`${groupName} - Pool ${poolLabel}`, 14, 25);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(`Kampfsystem: ${poolTypeLabel}`, 14, 32);
  pdf.setFont("helvetica", "bold");
  pdf.text(`Max. Gewicht: ${formatWeight(maxWeight)} kg`, 14, 54);

  for (let place = 1; place <= fieldCount; place += 1) {
    const x = fieldsX + (place - 1) * (fieldWidth + fieldGap);

    pdf.setDrawColor(85, 95, 92);
    pdf.rect(x, 36, fieldWidth, 12);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.text(`${place}. Platz:`, x + 2, 40.5);
    pdf.line(x + 2, 45, x + fieldWidth - 2, 45);
  }
};

const drawPoolRoundLayout = (
  pdf: jsPDF,
  fights: ReturnType<typeof createRoundRobinFights>,
  startY: number,
  header: {
    groupName: string;
    poolLabel: string;
    poolTypeLabel: string;
    maxWeight: number;
    participantCount: number;
  }
) => {
  const rounds = Array.from(
    new Set(fights.map((fight) => fight.roundNumber))
  ).map((roundNumber) => ({
    roundNumber,
    fights: fights.filter((fight) => fight.roundNumber === roundNumber),
  }));
  const roundsPerPage: typeof rounds[] = [];
  let pageRounds: typeof rounds = [];
  let pageFightCount = 0;

  rounds.forEach((round) => {
    if (
      pageRounds.length > 0 &&
      (pageFightCount + round.fights.length > 6 || pageRounds.length >= 3)
    ) {
      roundsPerPage.push(pageRounds);
      pageRounds = [];
      pageFightCount = 0;
    }

    pageRounds.push(round);
    pageFightCount += round.fights.length;
  });

  if (pageRounds.length > 0) {
    roundsPerPage.push(pageRounds);
  }

  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 12;
  const gap = 5;
  const cardHeight = 35;
  const cardGap = 4;
  const topStep = 7;

  roundsPerPage.forEach((pageRounds, pageIndex) => {
    if (pageIndex > 0) {
      pdf.addPage("a4", "landscape");
      drawPoolHeader(
        pdf,
        header.groupName,
        header.poolLabel,
        header.poolTypeLabel,
        header.maxWeight,
        header.participantCount
      );
    }

    const columnWidth =
      (pageWidth - margin * 2 - gap * (pageRounds.length - 1)) /
      pageRounds.length;

    pageRounds.forEach((round, columnIndex) => {
      const x = margin + columnIndex * (columnWidth + gap);
      const roundY = startY + columnIndex * topStep;

      pdf.setFillColor(34, 79, 74);
      pdf.roundedRect(x, roundY, columnWidth, 8, 1, 1, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.text(`RUNDE ${round.roundNumber}`, x + 3, roundY + 5.5);
      pdf.setTextColor(0, 0, 0);

      round.fights.forEach((fight, fightIndex) => {
        const cardY = roundY + 11 + fightIndex * (cardHeight + cardGap);
        const checkX = x + columnWidth - 8;
        const nameX = x + 3;
        const nameWidth = columnWidth - 15;

        pdf.setDrawColor(85, 95, 92);
        pdf.setLineWidth(0.35);
        pdf.roundedRect(x, cardY, columnWidth, cardHeight, 1, 1, "S");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        pdf.text(`KAMPF ${fight.matchNumber}`, nameX, cardY + 5.5);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(6.5);
        pdf.text("Sieger markieren", checkX - 1, cardY + 5.5, {
          align: "right",
        });

        [fight.first, fight.second].forEach((competitor, competitorIndex) => {
          const rowY = cardY + 8 + competitorIndex * 8;
          let fontSize = 8;

          pdf.setFont("helvetica", "normal");
          while (
            fontSize > 6 &&
            pdf.getTextWidth(competitor.label) > nameWidth
          ) {
            fontSize -= 0.25;
            pdf.setFontSize(fontSize);
          }

          pdf.text(competitor.label, nameX, rowY + 5.3);
          pdf.rect(checkX, rowY + 1.5, 4, 4);
        });

        pdf.setDrawColor(175, 180, 178);
        pdf.line(x + 2, cardY + 24, x + columnWidth - 2, cardY + 24);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7);
        pdf.text("Wertung: __________________    Zeit: __________", nameX, cardY + 31);
      });
    });

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.text(
      `Pool-Rundentabelle - Seite ${pageIndex + 1} von ${roundsPerPage.length}`,
      pageWidth - margin,
      pdf.internal.pageSize.getHeight() - 6,
      { align: "right" }
    );
  });
};

const drawSheet = (
  pdf: jsPDF,
  sheet: FightListPdfSheet,
  mode: FightListPdfMode,
  autoTable: typeof import("jspdf-autotable").default
) => {
  const { groupName, poolIndex, participants, system } = sheet;
  const poolType = getPoolType(participants.length, system);
  const title = mode === "fights" ? "Kampfliste" : "Teilnehmerliste";
  const poolLabel = String.fromCharCode(65 + poolIndex);

  const weights = participants
    .map((participant) => Number(participant.Gewicht))
    .filter(Number.isFinite);
  const maxWeight = weights.length > 0 ? Math.max(...weights) : 0;

  if (mode === "fights" && system === "POOL") {
    drawPoolHeader(
      pdf,
      groupName,
      poolLabel,
      getPoolTypeLabel(poolType, participants.length),
      maxWeight,
      participants.length
    );
    drawPoolRoundLayout(pdf, createRoundRobinFights(participants), 59, {
      groupName,
      poolLabel,
      poolTypeLabel: getPoolTypeLabel(poolType, participants.length),
      maxWeight,
      participantCount: participants.length,
    });
    return;
  }

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text(title, 14, 17);
  pdf.setFontSize(12);
  pdf.text(`${groupName} - Pool ${poolLabel}`, 14, 25);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(`Kampfsystem: ${getPoolTypeLabel(poolType, participants.length)}`, 14, 32);

  const showParticipantTable = mode === "participants" || system === "KO";

  if (showParticipantTable) {
    autoTable(pdf, {
      startY: 38,
      head: [["Los", "Name", "Gewicht", "Verein"]],
      body: participants.map((participant, index) => [
        String(index + 1),
        `${participant.Vorname} ${participant.Nachname}`,
        `${participant.Gewicht} kg`,
        participant.Verein,
      ]),
      theme: "grid",
      styles: { font: "helvetica", fontSize: 8, cellPadding: 2.2 },
      headStyles: { fillColor: [34, 79, 74] },
      columnStyles: {
        0: { cellWidth: 12 },
        2: { cellWidth: 22 },
      },
    });
  }

  if (mode === "participants") {
    return;
  }

  const fights = system === "KO"
    ? createKnockoutFights(participants)
    : createRoundRobinFights(participants);
  const finalY = showParticipantTable
    ? (pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 50
    : 32;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text("Kampffolge", 14, finalY + 9);

  const fightRows = fights.length > 0
    ? fights.flatMap((fight) => [
        [
          {
            content: `Kampf ${fight.matchNumber}\nRunde ${fight.roundNumber}`,
            rowSpan: 2,
            styles: { fontStyle: "bold" as const, valign: "middle" as const },
          },
          { content: fight.first.label },
          "",
          "",
          "",
        ],
        [
          { content: fight.second.label },
          "",
          "",
          "",
        ],
      ])
    : [["-", "Nicht genügend Teilnehmer", "", "", ""]];

  autoTable(pdf, {
    startY: finalY + 12,
    head: [["Kampf / Runde", "Kämpfer", "Wertung", "Zeit", "Sieger"]],
    body: fightRows,
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8, cellPadding: 3, minCellHeight: 11 },
    headStyles: { fillColor: [34, 79, 74] },
    columnStyles: {
      0: { cellWidth: 27 },
      1: { cellWidth: 70 },
      2: { cellWidth: 28 },
      3: { cellWidth: 22 },
      4: { cellWidth: 22 },
    },
  });
};

export async function createFightListPdf(
  sheets: FightListPdfSheet[],
  mode: FightListPdfMode
): Promise<jsPDF> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const firstSheet = sheets[0];
  const firstOrientation = mode === "fights" && firstSheet?.system === "POOL"
    ? "landscape"
    : "portrait";
  const pdf = new jsPDF({ orientation: firstOrientation, unit: "mm", format: "a4" });

  sheets.forEach((sheet, index) => {
    const orientation = mode === "fights" && sheet.system === "POOL"
      ? "landscape"
      : "portrait";

    if (index > 0) {
      pdf.addPage("a4", orientation);
    }

    drawSheet(pdf, sheet, mode, autoTable);
  });

  return pdf;
}

export async function downloadFightListPdf(
  sheets: FightListPdfSheet[],
  mode: FightListPdfMode
) {
  if (sheets.length === 0) {
    return;
  }

  const pdf = await createFightListPdf(sheets, mode);
  pdf.save(getFightListPdfFilename(sheets, mode));
}