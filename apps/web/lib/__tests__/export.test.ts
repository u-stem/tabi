import type {
  CandidateResponse,
  DayPatternResponse,
  DayResponse,
  ScheduleResponse,
  TripResponse,
} from "@sugara/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildCandidateRows,
  buildDefaultFileName,
  buildPreviewRows,
  buildScheduleRows,
  DEFAULT_CSV_OPTIONS,
  DEFAULT_SELECTED_FIELDS,
  EXPORT_FIELD_LABELS,
  EXPORT_FIELDS,
  type ExportField,
  type ExportOptions,
  escapeCSVValue,
  exportTripToCSV,
  exportTripToExcel,
  filterCandidateFields,
  rowsToCSV,
  scheduleToRow,
} from "../export";

function makeSchedule(overrides: Partial<ScheduleResponse> = {}): ScheduleResponse {
  return {
    id: "s1",
    name: "Tokyo Tower",
    category: "sightseeing",
    address: "Tokyo, Japan",
    startTime: "09:00",
    endTime: "11:00",
    sortOrder: 0,
    memo: "Great view",
    urls: ["https://example.com"],
    departurePlace: "Hotel",
    arrivalPlace: "Tokyo Tower",
    transportMethod: "train",
    color: "blue",
    endDayOffset: null,
    updatedAt: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeDay(overrides: Partial<DayResponse> = {}): DayResponse {
  return {
    id: "d1",
    dayNumber: 1,
    date: "2025-04-01",
    memo: null,
    patterns: [
      {
        id: "p1",
        label: "Default",
        isDefault: true,
        sortOrder: 0,
        schedules: [makeSchedule()],
      },
    ],
    ...overrides,
  };
}

function makeTrip(overrides: Partial<TripResponse> = {}): TripResponse {
  return {
    id: "t1",
    title: "Tokyo Trip",
    destination: "Tokyo",
    startDate: "2025-04-01",
    endDate: "2025-04-03",
    status: "planned",
    role: "owner",
    days: [makeDay()],
    candidates: [],
    scheduleCount: 1,
    memberCount: 1,
    ...overrides,
  };
}

describe("EXPORT_FIELDS / EXPORT_FIELD_LABELS", () => {
  it("has 13 fields defined", () => {
    expect(EXPORT_FIELDS).toHaveLength(13);
  });

  it("has a Japanese label for every field", () => {
    for (const field of EXPORT_FIELDS) {
      expect(EXPORT_FIELD_LABELS[field]).toBeDefined();
      expect(typeof EXPORT_FIELD_LABELS[field]).toBe("string");
    }
  });

  it("DEFAULT_SELECTED_FIELDS is a subset of EXPORT_FIELDS", () => {
    for (const field of DEFAULT_SELECTED_FIELDS) {
      expect(EXPORT_FIELDS).toContain(field);
    }
  });
});

describe("scheduleToRow", () => {
  it("selects only requested fields", () => {
    const schedule = makeSchedule();
    const day = makeDay();
    const fields: ExportField[] = ["name", "address"];
    const row = scheduleToRow(schedule, day, null, fields);

    expect(Object.keys(row)).toEqual([EXPORT_FIELD_LABELS.name, EXPORT_FIELD_LABELS.address]);
    expect(row[EXPORT_FIELD_LABELS.name]).toBe("Tokyo Tower");
    expect(row[EXPORT_FIELD_LABELS.address]).toBe("Tokyo, Japan");
  });

  it("converts category to Japanese label", () => {
    const schedule = makeSchedule({ category: "restaurant" });
    const day = makeDay();
    const row = scheduleToRow(schedule, day, null, ["category"]);

    expect(row[EXPORT_FIELD_LABELS.category]).toBe("飲食");
  });

  it("converts transportMethod to Japanese label", () => {
    const schedule = makeSchedule({ transportMethod: "shinkansen" });
    const day = makeDay();
    const row = scheduleToRow(schedule, day, null, ["transportMethod"]);

    expect(row[EXPORT_FIELD_LABELS.transportMethod]).toBe("新幹線");
  });

  it("formats date to Japanese format", () => {
    const schedule = makeSchedule();
    const day = makeDay({ date: "2025-04-01" });
    const row = scheduleToRow(schedule, day, null, ["date"]);

    expect(row[EXPORT_FIELD_LABELS.date]).toBe("2025年4月1日");
  });

  it("formats time to HH:MM", () => {
    const schedule = makeSchedule({ startTime: "09:00:00", endTime: "11:30:00" });
    const day = makeDay();
    const row = scheduleToRow(schedule, day, null, ["startTime", "endTime"]);

    expect(row[EXPORT_FIELD_LABELS.startTime]).toBe("09:00");
    expect(row[EXPORT_FIELD_LABELS.endTime]).toBe("11:30");
  });

  it("handles null/undefined fields as empty string", () => {
    const schedule = makeSchedule({
      address: null,
      startTime: null,
      memo: null,
      urls: [],
      transportMethod: null,
    });
    const day = makeDay();
    const row = scheduleToRow(schedule, day, null, [
      "address",
      "startTime",
      "memo",
      "urls",
      "transportMethod",
    ]);

    expect(row[EXPORT_FIELD_LABELS.address]).toBe("");
    expect(row[EXPORT_FIELD_LABELS.startTime]).toBe("");
    expect(row[EXPORT_FIELD_LABELS.memo]).toBe("");
    expect(row[EXPORT_FIELD_LABELS.urls]).toBe("");
    expect(row[EXPORT_FIELD_LABELS.transportMethod]).toBe("");
  });

  it("joins multiple urls with newline", () => {
    const schedule = makeSchedule({
      urls: ["https://example.com", "https://maps.google.com"],
    });
    const day = makeDay();
    const row = scheduleToRow(schedule, day, null, ["urls"]);

    expect(row[EXPORT_FIELD_LABELS.urls]).toBe("https://example.com\nhttps://maps.google.com");
  });

  it("includes dayNumber", () => {
    const schedule = makeSchedule();
    const day = makeDay({ dayNumber: 3 });
    const row = scheduleToRow(schedule, day, null, ["dayNumber"]);

    expect(row[EXPORT_FIELD_LABELS.dayNumber]).toBe(3);
  });

  it("includes pattern label when provided", () => {
    const schedule = makeSchedule();
    const day = makeDay();
    const row = scheduleToRow(schedule, day, "Rain Plan", ["pattern"]);

    expect(row[EXPORT_FIELD_LABELS.pattern]).toBe("Rain Plan");
  });

  it("uses empty string for pattern when null", () => {
    const schedule = makeSchedule();
    const day = makeDay();
    const row = scheduleToRow(schedule, day, null, ["pattern"]);

    expect(row[EXPORT_FIELD_LABELS.pattern]).toBe("");
  });
});

describe("buildScheduleRows", () => {
  it("returns rows sorted by sortOrder", () => {
    const patterns: DayPatternResponse[] = [
      {
        id: "p1",
        label: "Default",
        isDefault: true,
        sortOrder: 0,
        schedules: [
          makeSchedule({ id: "s1", name: "Second", sortOrder: 1 }),
          makeSchedule({ id: "s2", name: "First", sortOrder: 0 }),
        ],
      },
    ];
    const day = makeDay({ patterns });
    const rows = buildScheduleRows(day, patterns, ["name"]);

    expect(rows[0][EXPORT_FIELD_LABELS.name]).toBe("First");
    expect(rows[1][EXPORT_FIELD_LABELS.name]).toBe("Second");
  });

  it("handles multiple patterns (patternColumn mode)", () => {
    const patterns: DayPatternResponse[] = [
      {
        id: "p1",
        label: "Default",
        isDefault: true,
        sortOrder: 0,
        schedules: [makeSchedule({ id: "s1", name: "A" })],
      },
      {
        id: "p2",
        label: "Rain",
        isDefault: false,
        sortOrder: 1,
        schedules: [makeSchedule({ id: "s2", name: "B" })],
      },
    ];
    const day = makeDay({ patterns });
    const rows = buildScheduleRows(day, patterns, ["name", "pattern"]);

    expect(rows).toHaveLength(2);
    expect(rows[0][EXPORT_FIELD_LABELS.pattern]).toBe("Default");
    expect(rows[1][EXPORT_FIELD_LABELS.pattern]).toBe("Rain");
  });
});

describe("buildCandidateRows", () => {
  it("excludes day-context fields but keeps schedule properties", () => {
    const candidates: CandidateResponse[] = [
      {
        ...makeSchedule({ id: "c1", name: "Candidate 1", transportMethod: "train" }),
        likeCount: 0,
        hmmCount: 0,
        myReaction: null,
      },
    ];
    const fields: ExportField[] = ["date", "dayNumber", "name", "category", "transportMethod"];
    const rows = buildCandidateRows(candidates, fields);

    expect(rows).toHaveLength(1);
    expect(rows[0]).not.toHaveProperty(EXPORT_FIELD_LABELS.date);
    expect(rows[0]).not.toHaveProperty(EXPORT_FIELD_LABELS.dayNumber);
    expect(rows[0][EXPORT_FIELD_LABELS.name]).toBe("Candidate 1");
    expect(rows[0][EXPORT_FIELD_LABELS.transportMethod]).toBe("電車");
  });
});

describe("filterCandidateFields", () => {
  it("removes only day-context fields (date, dayNumber, pattern)", () => {
    const all: ExportField[] = [
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
    ];
    const filtered = filterCandidateFields(all);

    expect(filtered).toEqual([
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
    ]);
  });

  it("preserves order of remaining fields", () => {
    const fields: ExportField[] = ["memo", "name", "urls"];
    const filtered = filterCandidateFields(fields);

    expect(filtered).toEqual(["memo", "name", "urls"]);
  });
});

describe("buildPreviewRows", () => {
  it("returns at most 3 rows", () => {
    const patterns: DayPatternResponse[] = [
      {
        id: "p1",
        label: "Default",
        isDefault: true,
        sortOrder: 0,
        schedules: [
          makeSchedule({ id: "s1", name: "A", sortOrder: 0 }),
          makeSchedule({ id: "s2", name: "B", sortOrder: 1 }),
          makeSchedule({ id: "s3", name: "C", sortOrder: 2 }),
          makeSchedule({ id: "s4", name: "D", sortOrder: 3 }),
        ],
      },
    ];
    const trip = makeTrip({ days: [makeDay({ patterns })] });
    const rows = buildPreviewRows(trip, ["name"]);

    expect(rows).toHaveLength(3);
    expect(rows[0][EXPORT_FIELD_LABELS.name]).toBe("A");
    expect(rows[2][EXPORT_FIELD_LABELS.name]).toBe("C");
  });

  it("returns empty array for trip with no schedules", () => {
    const trip = makeTrip({
      days: [
        makeDay({
          patterns: [{ id: "p1", label: "Default", isDefault: true, sortOrder: 0, schedules: [] }],
        }),
      ],
    });
    const rows = buildPreviewRows(trip, ["name"]);

    expect(rows).toHaveLength(0);
  });
});

const { mockWriteFile, mockBookNew, mockJsonToSheet, mockBookAppendSheet } = vi.hoisted(() => {
  const mockWriteFile = vi.fn();
  const mockBookNew = vi.fn().mockReturnValue({ SheetNames: [], Sheets: {} });
  const mockJsonToSheet = vi.fn().mockReturnValue({});
  const mockBookAppendSheet = vi.fn();
  return { mockWriteFile, mockBookNew, mockJsonToSheet, mockBookAppendSheet };
});

vi.mock("xlsx", () => ({
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  utils: {
    book_new: (...args: unknown[]) => mockBookNew(...args),
    json_to_sheet: (...args: unknown[]) => mockJsonToSheet(...args),
    book_append_sheet: (...args: unknown[]) => mockBookAppendSheet(...args),
  },
}));

describe("exportTripToExcel", () => {
  beforeEach(() => {
    mockWriteFile.mockClear();
    mockBookNew.mockClear();
    mockJsonToSheet.mockClear();
    mockBookAppendSheet.mockClear();
    mockBookNew.mockReturnValue({ SheetNames: [], Sheets: {} });
    mockJsonToSheet.mockReturnValue({});
  });

  function makeOptions(overrides: Partial<ExportOptions> = {}): ExportOptions {
    return {
      fields: ["name", "startTime", "endTime"],
      patternMode: "separateSheets",
      includeCandidates: false,
      ...overrides,
    };
  }

  it("creates separate sheets for separateSheets mode", async () => {
    const trip = makeTrip({
      days: [
        makeDay({
          patterns: [
            {
              id: "p1",
              label: "Default",
              isDefault: true,
              sortOrder: 0,
              schedules: [makeSchedule()],
            },
            {
              id: "p2",
              label: "Rain",
              isDefault: false,
              sortOrder: 1,
              schedules: [makeSchedule({ id: "s2", name: "Indoor" })],
            },
          ],
        }),
      ],
    });

    await exportTripToExcel(trip, makeOptions({ patternMode: "separateSheets" }));

    expect(mockBookAppendSheet).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      "Default",
    );
    expect(mockBookAppendSheet).toHaveBeenCalledWith(expect.anything(), expect.anything(), "Rain");
  });

  it("creates a single sheet with pattern column for patternColumn mode", async () => {
    const trip = makeTrip({
      days: [
        makeDay({
          patterns: [
            {
              id: "p1",
              label: "Default",
              isDefault: true,
              sortOrder: 0,
              schedules: [makeSchedule()],
            },
            {
              id: "p2",
              label: "Rain",
              isDefault: false,
              sortOrder: 1,
              schedules: [makeSchedule({ id: "s2" })],
            },
          ],
        }),
      ],
    });

    await exportTripToExcel(
      trip,
      makeOptions({
        patternMode: "patternColumn",
        fields: ["name", "pattern"],
      }),
    );

    expect(mockBookAppendSheet).toHaveBeenCalledWith(expect.anything(), expect.anything(), "旅程");
  });

  it("adds a candidates sheet when includeCandidates is true", async () => {
    const candidates: CandidateResponse[] = [
      {
        ...makeSchedule({ id: "c1", name: "Candidate" }),
        likeCount: 2,
        hmmCount: 1,
        myReaction: null,
      },
    ];
    const trip = makeTrip({ candidates });

    await exportTripToExcel(trip, makeOptions({ includeCandidates: true }));

    const sheetNames = mockBookAppendSheet.mock.calls.map((call: unknown[]) => call[2]);
    expect(sheetNames).toContain("候補");
  });

  it("does not add candidates sheet when includeCandidates is false", async () => {
    const candidates: CandidateResponse[] = [
      {
        ...makeSchedule({ id: "c1", name: "Candidate" }),
        likeCount: 0,
        hmmCount: 0,
        myReaction: null,
      },
    ];
    const trip = makeTrip({ candidates });

    await exportTripToExcel(trip, makeOptions({ includeCandidates: false }));

    const sheetNames = mockBookAppendSheet.mock.calls.map((call: unknown[]) => call[2]);
    expect(sheetNames).not.toContain("候補");
  });

  it("generates the correct file name", async () => {
    const trip = makeTrip({ title: "Tokyo Trip" });
    // Mock Date to control output
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-04-15"));

    await exportTripToExcel(trip, makeOptions());

    const fileNameArg = mockWriteFile.mock.calls.at(-1)?.[1] as string;
    expect(fileNameArg).toBe("Tokyo Trip_2025-04-15.xlsx");

    vi.useRealTimers();
  });

  it("strips pattern field from fields when not in patternColumn mode", async () => {
    const trip = makeTrip();
    await exportTripToExcel(
      trip,
      makeOptions({
        patternMode: "separateSheets",
        fields: ["name", "pattern", "startTime"],
      }),
    );

    // json_to_sheet receives rows without pattern column
    const rows = mockJsonToSheet.mock.calls.at(-1)?.[0] as Record<string, unknown>[];
    if (rows && rows.length > 0) {
      expect(rows[0]).not.toHaveProperty(EXPORT_FIELD_LABELS.pattern);
    }
  });

  it("uses custom fileName when provided", async () => {
    const trip = makeTrip({ title: "Tokyo Trip" });
    await exportTripToExcel(trip, makeOptions({ fileName: "my-custom-name" }));

    const fileNameArg = mockWriteFile.mock.calls.at(-1)?.[1] as string;
    expect(fileNameArg).toBe("my-custom-name.xlsx");
  });
});

describe("buildDefaultFileName", () => {
  it("returns title with today's date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-04-15"));

    expect(buildDefaultFileName("Tokyo Trip")).toBe("Tokyo Trip_2025-04-15");

    vi.useRealTimers();
  });
});

describe("escapeCSVValue", () => {
  it("returns plain string as-is", () => {
    expect(escapeCSVValue("hello")).toBe("hello");
  });

  it("wraps value containing comma in double quotes", () => {
    expect(escapeCSVValue("a,b")).toBe('"a,b"');
  });

  it("wraps value containing newline in double quotes", () => {
    expect(escapeCSVValue("line1\nline2")).toBe('"line1\nline2"');
  });

  it("escapes double quotes by doubling them", () => {
    expect(escapeCSVValue('say "hi"')).toBe('"say ""hi"""');
  });

  it("handles value with both comma and double quotes", () => {
    expect(escapeCSVValue('a,"b"')).toBe('"a,""b"""');
  });

  it("converts number to string", () => {
    expect(escapeCSVValue(42)).toBe("42");
  });

  it("does not quote comma when delimiter is tab", () => {
    expect(escapeCSVValue("a,b", "tab")).toBe("a,b");
  });

  it("quotes value containing tab when delimiter is tab", () => {
    expect(escapeCSVValue("a\tb", "tab")).toBe('"a\tb"');
  });

  it("still quotes newline and double quotes when delimiter is tab", () => {
    expect(escapeCSVValue('say "hi"', "tab")).toBe('"say ""hi"""');
    expect(escapeCSVValue("line1\nline2", "tab")).toBe('"line1\nline2"');
  });
});

describe("rowsToCSV", () => {
  it("generates CSV with headers and rows", () => {
    const headers = ["Name", "Age"];
    const rows = [
      { Name: "Alice", Age: 30 },
      { Name: "Bob", Age: 25 },
    ];
    const csv = rowsToCSV(headers, rows);

    expect(csv).toBe("Name,Age\r\nAlice,30\r\nBob,25");
  });

  it("escapes values correctly in CSV output", () => {
    const headers = ["Name", "Memo"];
    const rows = [{ Name: "Place, A", Memo: 'say "hi"' }];
    const csv = rowsToCSV(headers, rows);

    expect(csv).toBe('Name,Memo\r\n"Place, A","say ""hi"""');
  });

  it("handles empty rows", () => {
    const headers = ["Name"];
    const rows: Record<string, string | number>[] = [];
    const csv = rowsToCSV(headers, rows);

    expect(csv).toBe("Name");
  });

  it("uses empty string for missing keys", () => {
    const headers = ["Name", "Address"];
    const rows = [{ Name: "A" }];
    const csv = rowsToCSV(headers, rows);

    expect(csv).toBe("Name,Address\r\nA,");
  });

  it("uses tab delimiter when specified", () => {
    const headers = ["Name", "Age"];
    const rows = [{ Name: "Alice", Age: 30 }];
    const csv = rowsToCSV(headers, rows, "tab");

    expect(csv).toBe("Name\tAge\r\nAlice\t30");
  });

  it("uses LF line ending when specified", () => {
    const headers = ["Name", "Age"];
    const rows = [
      { Name: "Alice", Age: 30 },
      { Name: "Bob", Age: 25 },
    ];
    const csv = rowsToCSV(headers, rows, "comma", "lf");

    expect(csv).toBe("Name,Age\nAlice,30\nBob,25");
  });

  it("combines tab delimiter with LF line ending", () => {
    const headers = ["Name"];
    const rows = [{ Name: "A" }, { Name: "B" }];
    const csv = rowsToCSV(headers, rows, "tab", "lf");

    expect(csv).toBe("Name\nA\nB");
  });
});

describe("exportTripToCSV", () => {
  beforeEach(() => {
    vi.stubGlobal("URL", { createObjectURL: vi.fn().mockReturnValue("blob:test") });
  });

  it("creates a BOM-prefixed CSV blob and triggers download", async () => {
    const mockClick = vi.fn();
    const mockLink = { href: "", download: "", click: mockClick };
    vi.spyOn(document, "createElement").mockReturnValue(mockLink as unknown as HTMLElement);

    const trip = makeTrip();

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-04-15"));

    await exportTripToCSV(trip, {
      fields: ["name", "startTime"],
      patternMode: "patternColumn",
      includeCandidates: false,
    });

    expect(mockLink.download).toBe("Tokyo Trip_2025-04-15.csv");
    expect(mockClick).toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("uses custom fileName when provided", async () => {
    const mockClick = vi.fn();
    const mockLink = { href: "", download: "", click: mockClick };
    vi.spyOn(document, "createElement").mockReturnValue(mockLink as unknown as HTMLElement);

    const trip = makeTrip();
    await exportTripToCSV(trip, {
      fields: ["name"],
      patternMode: "patternColumn",
      includeCandidates: false,
      fileName: "custom",
    });

    expect(mockLink.download).toBe("custom.csv");
  });

  it("appends candidates after schedule rows with separator", async () => {
    const mockClick = vi.fn();
    const mockLink = { href: "", download: "", click: mockClick };
    vi.spyOn(document, "createElement").mockReturnValue(mockLink as unknown as HTMLElement);

    let capturedContent = "";
    vi.stubGlobal(
      "Blob",
      class {
        content: string;
        constructor(parts: string[]) {
          this.content = parts.join("");
          capturedContent = this.content;
        }
      },
    );

    const candidates: CandidateResponse[] = [
      {
        ...makeSchedule({ id: "c1", name: "Candidate Spot" }),
        likeCount: 0,
        hmmCount: 0,
        myReaction: null,
      },
    ];
    const trip = makeTrip({ candidates });
    await exportTripToCSV(trip, {
      fields: ["name"],
      patternMode: "patternColumn",
      includeCandidates: true,
    });

    // BOM prefix
    expect(capturedContent.charCodeAt(0)).toBe(0xfeff);
    // Contains candidate section
    expect(capturedContent).toContain("候補");
    expect(capturedContent).toContain("Candidate Spot");
  });

  it("omits BOM when csvOptions.bom is false", async () => {
    let capturedContent = "";
    vi.stubGlobal(
      "Blob",
      class {
        content: string;
        constructor(parts: string[]) {
          this.content = parts.join("");
          capturedContent = this.content;
        }
      },
    );

    const mockClick = vi.fn();
    const mockLink = { href: "", download: "", click: mockClick };
    vi.spyOn(document, "createElement").mockReturnValue(mockLink as unknown as HTMLElement);

    const trip = makeTrip();
    await exportTripToCSV(trip, {
      fields: ["name"],
      patternMode: "patternColumn",
      includeCandidates: false,
      csvOptions: { ...DEFAULT_CSV_OPTIONS, bom: false },
    });

    expect(capturedContent.charCodeAt(0)).not.toBe(0xfeff);
  });

  it("uses tab delimiter and downloads with .tsv extension", async () => {
    let capturedContent = "";
    vi.stubGlobal(
      "Blob",
      class {
        content: string;
        constructor(parts: string[]) {
          this.content = parts.join("");
          capturedContent = this.content;
        }
      },
    );

    const mockClick = vi.fn();
    const mockLink = { href: "", download: "", click: mockClick };
    vi.spyOn(document, "createElement").mockReturnValue(mockLink as unknown as HTMLElement);

    const trip = makeTrip();
    await exportTripToCSV(trip, {
      fields: ["name", "startTime"],
      patternMode: "patternColumn",
      includeCandidates: false,
      csvOptions: { delimiter: "tab", bom: true, lineEnding: "crlf" },
    });

    expect(mockLink.download).toMatch(/\.tsv$/);
    expect(capturedContent).toContain("\t");
    expect(capturedContent).not.toMatch(/名前,/);
  });

  it("uses LF line ending when specified", async () => {
    let capturedContent = "";
    vi.stubGlobal(
      "Blob",
      class {
        content: string;
        constructor(parts: string[]) {
          this.content = parts.join("");
          capturedContent = this.content;
        }
      },
    );

    const mockClick = vi.fn();
    const mockLink = { href: "", download: "", click: mockClick };
    vi.spyOn(document, "createElement").mockReturnValue(mockLink as unknown as HTMLElement);

    const trip = makeTrip();
    await exportTripToCSV(trip, {
      fields: ["name"],
      patternMode: "patternColumn",
      includeCandidates: false,
      csvOptions: { delimiter: "comma", bom: true, lineEnding: "lf" },
    });

    // Strip BOM, then check line endings
    const withoutBom = capturedContent.slice(1);
    expect(withoutBom).not.toContain("\r\n");
    expect(withoutBom).toContain("\n");
  });

  it("uses candidate separator with correct line ending", async () => {
    let capturedContent = "";
    vi.stubGlobal(
      "Blob",
      class {
        content: string;
        constructor(parts: string[]) {
          this.content = parts.join("");
          capturedContent = this.content;
        }
      },
    );

    const mockClick = vi.fn();
    const mockLink = { href: "", download: "", click: mockClick };
    vi.spyOn(document, "createElement").mockReturnValue(mockLink as unknown as HTMLElement);

    const candidates: CandidateResponse[] = [
      {
        ...makeSchedule({ id: "c1", name: "Candidate Spot" }),
        likeCount: 0,
        hmmCount: 0,
        myReaction: null,
      },
    ];
    const trip = makeTrip({ candidates });
    await exportTripToCSV(trip, {
      fields: ["name"],
      patternMode: "patternColumn",
      includeCandidates: true,
      csvOptions: { delimiter: "comma", bom: false, lineEnding: "lf" },
    });

    expect(capturedContent).toContain("\n\n--- 候補 ---\n");
    expect(capturedContent).not.toContain("\r\n");
  });
});
