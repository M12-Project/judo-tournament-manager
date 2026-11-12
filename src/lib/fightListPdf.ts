import type { jsPDF } from "jspdf";
import type { Participant } from "../types/Participant";
import type { PoolType } from "../types/PoolType";
import {
  createKnockoutFights,
  createDoubleKnockoutFights,
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
    const systemLabel = sheet.system === "KO" ? "Doppel-KO-" : "";

    return `${categoryLabel}-bis-${weightLabel}-${poolLabel}-${systemLabel}${documentType}.pdf`;
  }

  const scopeLabel = categories.length === 1 ? "Alle-Pools" : "Alle-Gruppen";
  return `Judo-${categoryLabel}-${scopeLabel}-${pluralDocumentType}.pdf`;
}

const getPoolTypeLabel = (poolType: PoolType | null, poolSize: number) => {
  if (poolType === "KO") {
    return "Doppel-KO-System";
  }

  return poolType
    ? `${poolType} - Jeder gegen Jeden`
    : `${poolSize} Teilnehmer - Jeder gegen Jeden`;
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
  const cardHeight = 40;
  const cardGap = 3;
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
        pdf.setFontSize(6.5);
        pdf.text("Wertung:", nameX, cardY + 34);
        pdf.line(nameX + 15, cardY + 35, x + columnWidth * 0.6, cardY + 35);
        pdf.text("Zeit:", x + columnWidth * 0.64, cardY + 34);
        pdf.line(
          x + columnWidth * 0.75,
          cardY + 35,
          x + columnWidth - 2,
          cardY + 35
        );
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

const drawDoubleKnockoutSheet = (
  pdf: jsPDF,
  sheet: FightListPdfSheet
) => {
  const { groupName, poolIndex, participants } = sheet;
  const poolLabel = String.fromCharCode(65 + poolIndex);
  const fights = createDoubleKnockoutFights(participants);
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const weights = participants
    .map((participant) => Number(participant.Gewicht))
    .filter(Number.isFinite);
  const maxWeight = weights.length > 0 ? Math.max(...weights) : 0;
  const placementColumns = Math.min(8, participants.length);
  const placementRows = Math.ceil(participants.length / placementColumns);
  const placementGap = 2;
  const placementWidth =
    (pageWidth - 24 - placementGap * (placementColumns - 1)) /
    placementColumns;
  const cardHeight = 45;
  const cardGapY = 1;
  const cardGapX = 5;
  const startY = 37 + placementRows * 12 + 3;
  const cardWidth = (pageWidth - 24 - cardGapX) / 2;
  const fightsPerPage = 6;
  const pageCount = Math.max(1, Math.ceil(fights.length / fightsPerPage));

  const drawHeader = (pageNumber: number) => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.text("Doppel-KO Kampfliste", 12, 14);
    pdf.setFontSize(11);
    pdf.text(`${groupName} - Pool ${poolLabel} (${participants.length} Teilnehmer)`, 12, 21);
    pdf.setFontSize(9);
    pdf.text(`Höchstgewicht: ${formatWeight(maxWeight)} kg`, pageWidth - 12, 21, {
      align: "right",
    });
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.text(
      "Sieger: obere Runde / weiter. Verlierer: Verliererrunde; nach der zweiten Niederlage ausgeschieden.",
      12,
      27
    );
    pdf.text(
      "Name in späteren Kämpfen nach dem angegebenen Quellkampf handschriftlich eintragen. Finale 2 nur bei Bedarf.",
      12,
      32
    );

    for (let place = 1; place <= participants.length; place += 1) {
      const row = Math.floor((place - 1) / placementColumns);
      const column = (place - 1) % placementColumns;
      const x = 12 + column * (placementWidth + placementGap);
      const y = 37 + row * 12;

      pdf.setDrawColor(85, 95, 92);
      pdf.setLineWidth(0.3);
      pdf.rect(x, y, placementWidth, 10);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6.5);
      pdf.text(`${place}. Platz`, x + 1.5, y + 4);
      pdf.line(x + 1.5, y + 8, x + placementWidth - 1.5, y + 8);
    }

    pdf.setFontSize(7);
    pdf.text(`Seite ${pageNumber} von ${pageCount}`, pageWidth - 12, pageHeight - 5, {
      align: "right",
    });
  };

  const stageColor = (stage: "upper" | "lower" | "final") => {
    if (stage === "upper") {
      return [222, 239, 252] as const;
    }

    if (stage === "lower") {
      return [255, 232, 232] as const;
    }

    return [239, 230, 250] as const;
  };

  const drawFightCard = (
    fight: ReturnType<typeof createDoubleKnockoutFights>[number],
    positionInPage: number
  ) => {
    const column = Math.floor(positionInPage / 3);
    const row = positionInPage % 3;
    const x = 12 + column * (cardWidth + cardGapX);
    const y = startY + row * (cardHeight + cardGapY);
    const color = stageColor(fight.stage);
    const stageLabel = fight.stage === "upper"
      ? "OBERE RUNDE"
      : fight.stage === "lower"
        ? "VERLIERERRUNDE"
        : fight.roundNumber === 1
          ? "FINALE 1"
          : "FINALE 2 - NUR BEI BEDARF";

    pdf.setDrawColor(80, 90, 100);
    pdf.setLineWidth(0.45);
    pdf.roundedRect(x, y, cardWidth, cardHeight, 1.5, 1.5, "S");
    pdf.setFillColor(color[0], color[1], color[2]);
    pdf.roundedRect(x, y, cardWidth, 9, 1.5, 1.5, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.text(`KAMPF ${fight.matchNumber}`, x + 3, y + 6);
    pdf.setFontSize(7);
    pdf.text(`${stageLabel} - RUNDE ${fight.roundNumber}`, x + 31, y + 6);

    [fight.first, fight.second].forEach((competitor, competitorIndex) => {
      const rowY = y + 10 + competitorIndex * 8;
      const prefilledName =
        fight.stage === "upper" &&
        fight.roundNumber === 1 &&
        Boolean(competitor.participant);
      const sourceHint = prefilledName
        ? ""
        : competitor.participant
          ? `Eintragen: Freilos - ${competitor.label}`
          : `Eintragen: ${competitor.label}`;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      pdf.text(`${competitorIndex + 1}.`, x + 3, rowY + 3);

      if (prefilledName) {
        pdf.setFontSize(8);
        pdf.text(competitor.label, x + 12, rowY + 3);
      } else {
        pdf.setDrawColor(130, 135, 140);
        pdf.line(x + 12, rowY + 4, x + cardWidth - 3, rowY + 4);
        pdf.setTextColor(95, 95, 95);
        pdf.setFontSize(6);
        pdf.text(sourceHint, x + 12, rowY + 8);
        pdf.setTextColor(0, 0, 0);
      }
    });

    const routeY = y + 28;
    pdf.setDrawColor(190, 195, 200);
    pdf.line(x + 3, routeY - 2, x + cardWidth - 3, routeY - 2);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.5);
    pdf.text(`Sieger -> ${fight.winnerDestination}`, x + 3, routeY + 3);
    pdf.text(`Verlierer -> ${fight.loserDestination}`, x + 3, routeY + 7);
    pdf.setFontSize(6.5);
    pdf.text("Wertung:", x + 3, y + 42);
    pdf.line(x + 20, y + 43, x + cardWidth * 0.6, y + 43);
    pdf.text("Zeit:", x + cardWidth * 0.64, y + 42);
    pdf.line(
      x + cardWidth * 0.75,
      y + 43,
      x + cardWidth - 3,
      y + 43
    );
  };

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    if (pageIndex > 0) {
      pdf.addPage("a4", "landscape");
    }

    drawHeader(pageIndex + 1);
    fights
      .slice(pageIndex * fightsPerPage, (pageIndex + 1) * fightsPerPage)
      .forEach((fight, index) => {
        drawFightCard(fight, index);
      });
  }
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

  if (mode === "fights" && system === "KO") {
    drawDoubleKnockoutSheet(pdf, sheet);
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
      head: [["Nr", "Name"]],
      body: participants.map((participant, index) => [
        String(index + 1),
        `${participant.Vorname} ${participant.Nachname}`,
      ]),
      theme: "grid",
      styles: { font: "helvetica", fontSize: 8, cellPadding: 2.2 },
      headStyles: { fillColor: [34, 79, 74] },
      columnStyles: {
        0: { cellWidth: 12 },
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
  const firstOrientation = mode === "fights" && firstSheet?.system !== undefined
    ? "landscape"
    : "portrait";
  const pdf = new jsPDF({ orientation: firstOrientation, unit: "mm", format: "a4" });

  sheets.forEach((sheet, index) => {
    const orientation = mode === "fights"
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