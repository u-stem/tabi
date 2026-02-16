import type {
  CandidateResponse,
  DayPatternResponse,
  DayResponse,
  ScheduleResponse,
  TripResponse,
} from "@sugara/shared";
import { CATEGORY_LABELS, TRANSPORT_METHOD_LABELS } from "@sugara/shared";
import { formatDate, formatTime, toDateString } from "@/lib/format";

// Ordered by: When → What → Where → How → Extra → Meta
export const EXPORT_FIELDS = [
  "date",
  "dayNumber",
  "startTime",
  "endTime",
  "name",
  "category",
  "address",
  "departurePlace",
  "arrivalPlace",
  "transportMethod",
  "urls",
  "memo",
  "pattern",
] as const;

export type ExportField = (typeof EXPORT_FIELDS)[number];

export const EXPORT_FIELD_LABELS: Record<ExportField, string> = {
  date: "日付",
  dayNumber: "日目",
  startTime: "開始時間",
  endTime: "終了時間",
  name: "名前",
  category: "カテゴリ",
  address: "住所",
  departurePlace: "出発地",
  arrivalPlace: "到着地",
  transportMethod: "移動手段",
  urls: "URL",
  memo: "メモ",
  pattern: "パターン",
};

export const DEFAULT_SELECTED_FIELDS: ExportField[] = [
  "date",
  "name",
  "startTime",
  "endTime",
  "address",
  "urls",
];

export type ExportFormat = "xlsx" | "csv";

export type PatternMode = "separateSheets" | "patternColumn";

export type CSVDelimiter = "comma" | "tab";
export type CSVLineEnding = "crlf" | "lf";

export type CSVOptions = {
  delimiter: CSVDelimiter;
  bom: boolean;
  lineEnding: CSVLineEnding;
};

export const DEFAULT_CSV_OPTIONS: CSVOptions = {
  delimiter: "comma",
  bom: true,
  lineEnding: "crlf",
};

export type ExportOptions = {
  format?: ExportFormat;
  fields: ExportField[];
  patternMode: PatternMode;
  includeCandidates: boolean;
  fileName?: string;
  csvOptions?: CSVOptions;
};

export function buildDefaultFileName(tripTitle: string): string {
  return `${tripTitle}_${toDateString(new Date())}`;
}

// Fields not applicable to candidates (no day/pattern context)
const CANDIDATE_EXCLUDED_FIELDS: Set<ExportField> = new Set(["date", "dayNumber", "pattern"]);

export function filterCandidateFields(fields: ExportField[]): ExportField[] {
  return fields.filter((f) => !CANDIDATE_EXCLUDED_FIELDS.has(f));
}

export function scheduleToRow(
  schedule: ScheduleResponse,
  day: DayResponse,
  patternLabel: string | null,
  fields: ExportField[],
): Record<string, string | number> {
  const row: Record<string, string | number> = {};
  for (const field of fields) {
    const label = EXPORT_FIELD_LABELS[field];
    switch (field) {
      case "date":
        row[label] = formatDate(day.date);
        break;
      case "dayNumber":
        row[label] = day.dayNumber;
        break;
      case "pattern":
        row[label] = patternLabel ?? "";
        break;
      case "category":
        row[label] = CATEGORY_LABELS[schedule.category];
        break;
      case "startTime":
        row[label] = schedule.startTime ? formatTime(schedule.startTime) : "";
        break;
      case "endTime":
        row[label] = schedule.endTime ? formatTime(schedule.endTime) : "";
        break;
      case "transportMethod":
        row[label] = schedule.transportMethod
          ? (TRANSPORT_METHOD_LABELS[
              schedule.transportMethod as keyof typeof TRANSPORT_METHOD_LABELS
            ] ?? schedule.transportMethod)
          : "";
        break;
      case "urls":
        row[label] = schedule.urls.join("\n");
        break;
      default:
        row[label] = (schedule[field as keyof ScheduleResponse] as string) ?? "";
        break;
    }
  }
  return row;
}

export function buildScheduleRows(
  day: DayResponse,
  patterns: DayPatternResponse[],
  fields: ExportField[],
): Record<string, string | number>[] {
  const rows: Record<string, string | number>[] = [];
  for (const pattern of patterns) {
    const sorted = [...pattern.schedules].sort((a, b) => a.sortOrder - b.sortOrder);
    for (const schedule of sorted) {
      rows.push(scheduleToRow(schedule, day, pattern.label, fields));
    }
  }
  return rows;
}

export function buildCandidateRows(
  candidates: CandidateResponse[],
  fields: ExportField[],
): Record<string, string | number>[] {
  const candidateFields = filterCandidateFields(fields);
  const stubDay: DayResponse = {
    id: "",
    dayNumber: 0,
    date: "",
    memo: null,
    patterns: [],
  };

  return candidates.map((candidate) => scheduleToRow(candidate, stubDay, null, candidateFields));
}

const DEFAULT_MAX_PREVIEW_ROWS = 3;

/** Build sample rows for the preview table. */
export function buildPreviewRows(
  trip: TripResponse,
  fields: ExportField[],
  maxRows: number = DEFAULT_MAX_PREVIEW_ROWS,
): Record<string, string | number>[] {
  const rows: Record<string, string | number>[] = [];
  for (const day of trip.days) {
    if (rows.length >= maxRows) break;
    for (const pattern of day.patterns) {
      if (rows.length >= maxRows) break;
      const sorted = [...pattern.schedules].sort((a, b) => a.sortOrder - b.sortOrder);
      for (const schedule of sorted) {
        if (rows.length >= maxRows) break;
        rows.push(scheduleToRow(schedule, day, pattern.label, fields));
      }
    }
  }
  return rows;
}

export async function exportTripToExcel(trip: TripResponse, options: ExportOptions): Promise<void> {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  // Exclude pattern field unless patternColumn mode
  const fields =
    options.patternMode === "patternColumn"
      ? options.fields
      : options.fields.filter((f) => f !== "pattern");

  switch (options.patternMode) {
    case "separateSheets": {
      // Collect all unique pattern labels across all days
      const labelMap = new Map<string, Record<string, string | number>[]>();
      for (const day of trip.days) {
        for (const pattern of day.patterns) {
          const existing = labelMap.get(pattern.label) ?? [];
          existing.push(...buildScheduleRows(day, [pattern], fields));
          labelMap.set(pattern.label, existing);
        }
      }
      for (const [label, rows] of labelMap) {
        const ws = XLSX.utils.json_to_sheet(rows);
        // Sheet name max 31 chars in xlsx
        XLSX.utils.book_append_sheet(wb, ws, label.slice(0, 31));
      }
      break;
    }
    case "patternColumn": {
      const rows = trip.days.flatMap((day) => buildScheduleRows(day, day.patterns, fields));
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, "旅程");
      break;
    }
  }

  if (options.includeCandidates && trip.candidates.length > 0) {
    const candidateRows = buildCandidateRows(trip.candidates, fields);
    const ws = XLSX.utils.json_to_sheet(candidateRows);
    XLSX.utils.book_append_sheet(wb, ws, "候補");
  }

  const name = options.fileName || `${trip.title}_${toDateString(new Date())}`;
  XLSX.writeFile(wb, `${name}.xlsx`);
}

// --- CSV ---

export function escapeCSVValue(value: string | number, delimiter: CSVDelimiter = "comma"): string {
  const str = String(value);
  const sep = delimiter === "tab" ? "\t" : ",";
  if (str.includes('"') || str.includes(sep) || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function rowsToCSV(
  headers: string[],
  rows: Record<string, string | number>[],
  delimiter: CSVDelimiter = "comma",
  lineEnding: CSVLineEnding = "crlf",
): string {
  const sep = delimiter === "tab" ? "\t" : ",";
  const eol = lineEnding === "lf" ? "\n" : "\r\n";
  const headerLine = headers.map((h) => escapeCSVValue(h, delimiter)).join(sep);
  const dataLines = rows.map((row) =>
    headers.map((h) => escapeCSVValue(row[h] ?? "", delimiter)).join(sep),
  );
  return [headerLine, ...dataLines].join(eol);
}

function downloadDelimitedText(
  content: string,
  fileName: string,
  bom: boolean = true,
  delimiter: CSVDelimiter = "comma",
): void {
  const prefix = bom ? "\uFEFF" : "";
  const mimeType = delimiter === "tab" ? "text/tab-separated-values" : "text/csv";
  const blob = new Blob([prefix + content], { type: `${mimeType};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
}

export async function exportTripToCSV(trip: TripResponse, options: ExportOptions): Promise<void> {
  const { delimiter, bom, lineEnding } = options.csvOptions ?? DEFAULT_CSV_OPTIONS;

  // CSV always uses patternColumn mode (no separate sheets)
  const fields =
    options.patternMode === "patternColumn"
      ? options.fields
      : options.fields.filter((f) => f !== "pattern");

  const headers = fields.map((f) => EXPORT_FIELD_LABELS[f]);
  const rows = trip.days.flatMap((day) => buildScheduleRows(day, day.patterns, fields));
  let csv = rowsToCSV(headers, rows, delimiter, lineEnding);

  if (options.includeCandidates && trip.candidates.length > 0) {
    const eol = lineEnding === "lf" ? "\n" : "\r\n";
    const candidateFields = filterCandidateFields(fields);
    const candidateHeaders = candidateFields.map((f) => EXPORT_FIELD_LABELS[f]);
    const candidateRows = buildCandidateRows(trip.candidates, fields);
    csv += `${eol}${eol}--- 候補 ---${eol}${rowsToCSV(candidateHeaders, candidateRows, delimiter, lineEnding)}`;
  }

  const name = options.fileName || `${trip.title}_${toDateString(new Date())}`;
  const ext = delimiter === "tab" ? "tsv" : "csv";
  downloadDelimitedText(csv, `${name}.${ext}`, bom, delimiter);
}

export async function exportTrip(trip: TripResponse, options: ExportOptions): Promise<void> {
  if (options.format === "csv") {
    return exportTripToCSV(trip, options);
  }
  return exportTripToExcel(trip, options);
}
