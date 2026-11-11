export interface Participant {
  id?: string;
  Vorname: string;
  Nachname: string;
  Jahrgang: number;
  Geschlecht: string;
  Gewicht: number;
  Altersklasse: string;
  Altersklassen?: string[];
  Verein: string;
}