import type {
  CandidateResponse,
  DayPatternResponse,
  DayResponse,
  ScheduleResponse,
  TripResponse,
} from "@sugara/shared";
import { CATEGORY_LABELS, SPLIT_TYPE_LABELS, TRANSPORT_METHOD_LABELS } from "@sugara/shared";
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

export type ExportFieldLabels = Record<ExportField, string>;

// Default labels (Japanese) used when no translation is provided
const DEFAULT_EXPORT_FIELD_LABELS: ExportFieldLabels = {
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

/** @deprecated Use translated labels from exportLabels namespace instead */
export const EXPORT_FIELD_LABELS = DEFAULT_EXPORT_FIELD_LABELS;

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

export type ExpenseExportItem = {
  title: string;
  amount: number;
  paidByName: string;
  splitType: string;
  category: string | null;
  splits: { name: string; amount: number }[];
};

export type ExpenseSettlement = {
  totalAmount: number;
  balances: { name: string; net: number }[];
  transfers: { fromName: string; toName: string; amount: number }[];
};

export type ExpenseExportData = {
  expenses: ExpenseExportItem[];
  settlement: ExpenseSettlement;
};

export type ExpenseExportHeaders = {
  title: string;
  category: string;
  amount: string;
  paidBy: string;
  splitType: string;
};

const DEFAULT_EXPENSE_EXPORT_HEADERS: ExpenseExportHeaders = {
  title: "タイトル",
  category: "カテゴリ",
  amount: "金額",
  paidBy: "支払者",
  splitType: "分担方法",
};

/** @deprecated Use translated labels from exportLabels namespace instead */
export const EXPENSE_EXPORT_HEADERS = DEFAULT_EXPENSE_EXPORT_HEADERS;

export type ExportSheetNames = {
  itinerary: string;
  candidates: string;
  expenses: string;
  csvCandidatesSeparator: string;
  csvExpensesSeparator: string;
};

export type ExportOptions = {
  format?: ExportFormat;
  fields: ExportField[];
  patternMode: PatternMode;
  includeCandidates: boolean;
  includeExpenses: boolean;
  expenseData?: ExpenseExportData;
  fileName?: string;
  csvOptions?: CSVOptions;
  fieldLabels?: ExportFieldLabels;
  expenseLabels?: ExpenseExportLabels;
  sheetNames?: ExportSheetNames;
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
  fieldLabels?: ExportFieldLabels,
): Record<string, string | number> {
  const labels = fieldLabels ?? DEFAULT_EXPORT_FIELD_LABELS;
  const row: Record<string, string | number> = {};
  for (const field of fields) {
    const label = labels[field];
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
  fieldLabels?: ExportFieldLabels,
): Record<string, string | number>[] {
  const rows: Record<string, string | number>[] = [];
  for (const pattern of patterns) {
    const sorted = [...pattern.schedules].sort((a, b) => a.sortOrder - b.sortOrder);
    for (const schedule of sorted) {
      rows.push(scheduleToRow(schedule, day, pattern.label, fields, fieldLabels));
    }
  }
  return rows;
}

export function buildCandidateRows(
  candidates: CandidateResponse[],
  fields: ExportField[],
  fieldLabels?: ExportFieldLabels,
): Record<string, string | number>[] {
  const candidateFields = filterCandidateFields(fields);
  const stubDay: DayResponse = {
    id: "",
    dayNumber: 0,
    date: "",
    memo: null,
    patterns: [],
  };

  return candidates.map((candidate) =>
    scheduleToRow(candidate, stubDay, null, candidateFields, fieldLabels),
  );
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

export type ExpenseExportResult = {
  headers: string[];
  rows: Record<string, string | number>[];
};

export type ExpenseExportLabels = ExpenseExportHeaders & {
  total: string;
  balanceSection: string;
  settlementSection: string;
  transferArrow: (from: string, to: string) => string;
};

export function buildExpenseExport(
  data: ExpenseExportData,
  labels?: ExpenseExportLabels,
): ExpenseExportResult {
  const defaultLabels: ExpenseExportLabels = {
    ...DEFAULT_EXPENSE_EXPORT_HEADERS,
    total: "合計",
    balanceSection: "[過不足]",
    settlementSection: "[精算]",
    transferArrow: (from, to) => `${from} → ${to}`,
  };
  const L = labels ?? defaultLabels;
  const H = {
    title: L.title,
    category: L.category,
    amount: L.amount,
    paidBy: L.paidBy,
    splitType: L.splitType,
  };

  // Collect unique member names in sorted order for stable output
  const memberNameSet = new Set<string>();
  for (const e of data.expenses) {
    for (const s of e.splits) {
      memberNameSet.add(s.name);
    }
  }
  const memberNames = [...memberNameSet].sort((a, b) => a.localeCompare(b));

  const staticHeaders = Object.values(H);
  const headers = [...staticHeaders, ...memberNames];

  const blank = (): Record<string, string | number> => {
    const row: Record<string, string | number> = {};
    for (const h of headers) row[h] = "";
    return row;
  };

  const rows: Record<string, string | number>[] = [];

  // Expense list
  for (const e of data.expenses) {
    const row: Record<string, string | number> = {
      [H.category]: e.category ?? "",
      [H.title]: e.title,
      [H.amount]: e.amount,
      [H.paidBy]: e.paidByName,
      [H.splitType]:
        SPLIT_TYPE_LABELS[e.splitType as keyof typeof SPLIT_TYPE_LABELS] ?? e.splitType,
    };
    // Per-member split amounts
    const splitMap = new Map(e.splits.map((s) => [s.name, s.amount]));
    for (const name of memberNames) {
      row[name] = splitMap.get(name) ?? "";
    }
    rows.push(row);
  }

  // Total
  rows.push(blank());
  rows.push({
    ...blank(),
    [H.title]: L.total,
    [H.amount]: data.settlement.totalAmount,
  });

  // Balances (skip if all zero)
  const nonZeroBalances = data.settlement.balances
    .filter((b) => b.net !== 0)
    .sort((a, b) => b.net - a.net);

  if (nonZeroBalances.length > 0) {
    rows.push(blank());
    rows.push({ ...blank(), [H.title]: L.balanceSection });
    for (const b of nonZeroBalances) {
      rows.push({ ...blank(), [H.title]: b.name, [H.amount]: b.net });
    }
  }

  // Transfers
  if (data.settlement.transfers.length > 0) {
    const sorted = [...data.settlement.transfers].sort((a, b) => b.amount - a.amount);
    rows.push(blank());
    rows.push({ ...blank(), [H.title]: L.settlementSection });
    for (const t of sorted) {
      rows.push({
        ...blank(),
        [H.title]: L.transferArrow(t.fromName, t.toName),
        [H.amount]: t.amount,
      });
    }
  }

  return { headers, rows };
}

function addRowsToWorksheet(
  wb: import("exceljs").Workbook,
  sheetName: string,
  rows: Record<string, string | number>[],
  headers?: string[],
): void {
  const ws = wb.addWorksheet(sheetName.slice(0, 31));
  if (rows.length === 0) return;
  const cols = headers ?? Object.keys(rows[0]);
  ws.columns = cols.map((key) => ({ header: key, key }));
  for (const row of rows) {
    ws.addRow(row);
  }
}

export async function exportTripToExcel(trip: TripResponse, options: ExportOptions): Promise<void> {
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();

  // Exclude pattern field unless patternColumn mode
  const fields =
    options.patternMode === "patternColumn"
      ? options.fields
      : options.fields.filter((f) => f !== "pattern");

  const sn = options.sheetNames ?? {
    itinerary: "旅程",
    candidates: "候補",
    expenses: "費用",
    csvCandidatesSeparator: "--- 候補 ---",
    csvExpensesSeparator: "--- 費用 ---",
  };
  const fl = options.fieldLabels;

  switch (options.patternMode) {
    case "separateSheets": {
      // Collect all unique pattern labels across all days
      const labelMap = new Map<string, Record<string, string | number>[]>();
      for (const day of trip.days) {
        for (const pattern of day.patterns) {
          const existing = labelMap.get(pattern.label) ?? [];
          existing.push(...buildScheduleRows(day, [pattern], fields, fl));
          labelMap.set(pattern.label, existing);
        }
      }
      for (const [label, rows] of labelMap) {
        addRowsToWorksheet(wb, label, rows);
      }
      break;
    }
    case "patternColumn": {
      const rows = trip.days.flatMap((day) => buildScheduleRows(day, day.patterns, fields, fl));
      addRowsToWorksheet(wb, sn.itinerary, rows);
      break;
    }
  }

  if (options.includeCandidates && trip.candidates.length > 0) {
    const candidateRows = buildCandidateRows(trip.candidates, fields, fl);
    addRowsToWorksheet(wb, sn.candidates, candidateRows);
  }

  if (options.includeExpenses && options.expenseData && options.expenseData.expenses.length > 0) {
    const { headers: expenseHeaders, rows: expenseRows } = buildExpenseExport(
      options.expenseData,
      options.expenseLabels,
    );
    addRowsToWorksheet(wb, sn.expenses, expenseRows, expenseHeaders);
  }

  const name = options.fileName || `${trip.title}_${toDateString(new Date())}`;
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
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
  URL.revokeObjectURL(url);
}

export async function exportTripToCSV(trip: TripResponse, options: ExportOptions): Promise<void> {
  const { delimiter, bom, lineEnding } = options.csvOptions ?? DEFAULT_CSV_OPTIONS;

  // CSV always uses patternColumn mode (no separate sheets)
  const fields =
    options.patternMode === "patternColumn"
      ? options.fields
      : options.fields.filter((f) => f !== "pattern");

  const fl = options.fieldLabels ?? DEFAULT_EXPORT_FIELD_LABELS;
  const sn = options.sheetNames ?? {
    itinerary: "旅程",
    candidates: "候補",
    expenses: "費用",
    csvCandidatesSeparator: "--- 候補 ---",
    csvExpensesSeparator: "--- 費用 ---",
  };

  const headers = fields.map((f) => fl[f]);
  const rows = trip.days.flatMap((day) => buildScheduleRows(day, day.patterns, fields, fl));
  let csv = rowsToCSV(headers, rows, delimiter, lineEnding);

  const eol = lineEnding === "lf" ? "\n" : "\r\n";

  if (options.includeCandidates && trip.candidates.length > 0) {
    const candidateFields = filterCandidateFields(fields);
    const candidateHeaders = candidateFields.map((f) => fl[f]);
    const candidateRows = buildCandidateRows(trip.candidates, fields, fl);
    csv += `${eol}${eol}${sn.csvCandidatesSeparator}${eol}${rowsToCSV(candidateHeaders, candidateRows, delimiter, lineEnding)}`;
  }

  if (options.includeExpenses && options.expenseData && options.expenseData.expenses.length > 0) {
    const { headers: expenseHeaders, rows: expenseRows } = buildExpenseExport(
      options.expenseData,
      options.expenseLabels,
    );
    csv += `${eol}${eol}${sn.csvExpensesSeparator}${eol}${rowsToCSV(expenseHeaders, expenseRows, delimiter, lineEnding)}`;
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
