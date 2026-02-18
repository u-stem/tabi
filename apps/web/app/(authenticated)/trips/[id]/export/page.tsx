"use client";

import type { TripResponse } from "@sugara/shared";
import { useQuery } from "@tanstack/react-query";
import { CheckCheck, Download, X } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api } from "@/lib/api";
import { pageTitle } from "@/lib/constants";
import {
  buildCandidateRows,
  buildDefaultFileName,
  buildScheduleRows,
  type CSVDelimiter,
  type CSVLineEnding,
  DEFAULT_CSV_OPTIONS,
  EXPORT_FIELD_LABELS,
  EXPORT_FIELDS,
  type ExportField,
  type ExportFormat,
  exportTrip,
  filterCandidateFields,
  type PatternMode,
} from "@/lib/export";
import { useAuthRedirect } from "@/lib/hooks/use-auth-redirect";
import { MSG } from "@/lib/messages";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

const PATTERN_MODE_LABELS: Record<PatternMode, string> = {
  separateSheets: "パターンごとにシート分け",
  patternColumn: "1シートにまとめる (パターン列あり)",
};

const FORMAT_LABELS: Record<ExportFormat, string> = {
  xlsx: "Excel (.xlsx)",
  csv: "CSV (.csv)",
};

export default function TripExportPage() {
  const params = useParams();
  const tripId = params.id as string;

  const {
    data: trip,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.trips.detail(tripId),
    queryFn: () => api<TripResponse>(`/api/trips/${tripId}`),
  });
  useAuthRedirect(error);

  useEffect(() => {
    if (trip) {
      document.title = pageTitle(`${trip.title}（エクスポート）`);
    }
  }, [trip?.title]);

  const [format, setFormat] = useState<ExportFormat>("xlsx");
  const [selectedFields, setSelectedFields] = useState<ExportField[]>([]);
  const [patternMode, setPatternMode] = useState<PatternMode>("separateSheets");
  const [includeCandidates, setIncludeCandidates] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [fileName, setFileName] = useState("");
  const [delimiter, setDelimiter] = useState<CSVDelimiter>(DEFAULT_CSV_OPTIONS.delimiter);
  const [bom, setBom] = useState(DEFAULT_CSV_OPTIONS.bom);
  const [lineEnding, setLineEnding] = useState<CSVLineEnding>(DEFAULT_CSV_OPTIONS.lineEnding);

  useEffect(() => {
    if (trip && !fileName) {
      setFileName(buildDefaultFileName(trip.title));
    }
  }, [trip, fileName]);

  const selectedSet = useMemo(() => new Set(selectedFields), [selectedFields]);

  const toggleField = useCallback((field: ExportField) => {
    setSelectedFields((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field],
    );
  }, []);

  function selectAll() {
    setSelectedFields([...EXPORT_FIELDS]);
  }

  function resetToDefault() {
    setSelectedFields([]);
  }

  // CSV does not support separate sheets
  const effectivePatternMode = format === "csv" ? "patternColumn" : patternMode;

  function handleFormatChange(newFormat: ExportFormat) {
    setFormat(newFormat);
    if (newFormat === "csv" && patternMode === "separateSheets") {
      setPatternMode("patternColumn");
      if (!selectedFields.includes("pattern")) {
        setSelectedFields((prev) => [...prev, "pattern"]);
      }
    }
  }

  function handlePatternModeChange(mode: PatternMode) {
    setPatternMode(mode);
    if (mode === "patternColumn" && !selectedFields.includes("pattern")) {
      setSelectedFields((prev) => [...prev, "pattern"]);
    }
  }

  const effectiveFields = useMemo(
    () =>
      effectivePatternMode === "patternColumn"
        ? selectedFields
        : selectedFields.filter((f) => f !== "pattern"),
    [selectedFields, effectivePatternMode],
  );

  const [activeSheet, setActiveSheet] = useState("");

  type SheetData = {
    fields: ExportField[];
    rows: Record<string, string | number>[];
  };

  const previewSheets = useMemo(() => {
    if (!trip || effectiveFields.length === 0) return new Map<string, SheetData>();

    const sheets = new Map<string, SheetData>();

    if (effectivePatternMode === "separateSheets") {
      for (const day of trip.days) {
        for (const pattern of day.patterns) {
          const existing = sheets.get(pattern.label);
          if (existing) {
            existing.rows.push(...buildScheduleRows(day, [pattern], effectiveFields));
          } else {
            sheets.set(pattern.label, {
              fields: effectiveFields,
              rows: buildScheduleRows(day, [pattern], effectiveFields),
            });
          }
        }
      }
    } else {
      const rows = trip.days.flatMap((day) =>
        buildScheduleRows(day, day.patterns, effectiveFields),
      );
      sheets.set("旅程", { fields: effectiveFields, rows });
    }

    if (includeCandidates && trip.candidates.length > 0) {
      const candidateFields = filterCandidateFields(effectiveFields);
      sheets.set("候補", {
        fields: candidateFields,
        rows: buildCandidateRows(trip.candidates, effectiveFields),
      });
    }

    return sheets;
  }, [trip, effectiveFields, effectivePatternMode, includeCandidates]);

  const sheetNames = useMemo(() => [...previewSheets.keys()], [previewSheets]);

  // CSV: no sheet tabs, show candidates inline
  const showSheetTabs = format !== "csv" && sheetNames.length > 1;

  useEffect(() => {
    if (sheetNames.length > 0 && !sheetNames.includes(activeSheet)) {
      setActiveSheet(sheetNames[0]);
    }
  }, [sheetNames, activeSheet]);

  const activeSheetData = previewSheets.get(activeSheet);
  const activeFields = activeSheetData?.fields ?? [];
  const activeRows = activeSheetData?.rows ?? [];

  // For CSV preview: show candidates inline below the schedule table
  const candidateSheetData = format === "csv" ? previewSheets.get("候補") : undefined;

  const fileExtension =
    format === "csv" && delimiter === "tab" ? ".tsv" : format === "csv" ? ".csv" : ".xlsx";

  async function handleExport() {
    if (!trip) return;
    setExporting(true);
    try {
      await exportTrip(trip, {
        format,
        fields: effectiveFields,
        patternMode: effectivePatternMode,
        includeCandidates,
        fileName: fileName.trim() || undefined,
        csvOptions: format === "csv" ? { delimiter, bom, lineEnding } : undefined,
      });
      toast.success(MSG.EXPORT_SUCCESS);
    } catch {
      toast.error(MSG.EXPORT_FAILED);
    } finally {
      setExporting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-destructive">{MSG.TRIP_FETCH_FAILED}</p>
      </div>
    );
  }

  return (
    <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
      {/* Settings */}
      <div className="rounded-lg border p-5 space-y-6 self-start">
        {/* Format selection */}
        <div className="flex flex-col gap-4">
          <Label htmlFor="export-format">フォーマット</Label>
          <Select value={format} onValueChange={handleFormatChange}>
            <SelectTrigger id="export-format" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(FORMAT_LABELS) as [ExportFormat, string][]).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Field selection */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Label>出力する列</Label>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={selectAll}>
                <CheckCheck className="h-3.5 w-3.5" />
                全選択
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={resetToDefault}
                disabled={selectedFields.length === 0}
              >
                <X className="h-3.5 w-3.5" />
                選択解除
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {EXPORT_FIELDS.map((field) => {
              const disabled = field === "pattern" && effectivePatternMode !== "patternColumn";
              const active = selectedSet.has(field) && !disabled;
              const id = `export-field-${field}`;
              return (
                <div
                  key={field}
                  className={cn(
                    "flex select-none items-center gap-2 text-sm",
                    disabled && "opacity-40",
                  )}
                >
                  <Checkbox
                    id={id}
                    checked={active}
                    disabled={disabled}
                    onCheckedChange={() => toggleField(field)}
                  />
                  <Label htmlFor={id} className="flex-1 font-normal">
                    {EXPORT_FIELD_LABELS[field]}
                  </Label>
                  <span
                    className={cn(
                      "flex h-5 min-w-5 items-center justify-center rounded-full text-xs",
                      active ? "bg-muted text-muted-foreground" : "invisible",
                    )}
                  >
                    {active ? effectiveFields.indexOf(field) + 1 : null}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pattern mode */}
        <div className="flex flex-col gap-4">
          <Label htmlFor="export-pattern-mode">パターン</Label>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Select
                  value={effectivePatternMode}
                  onValueChange={handlePatternModeChange}
                  disabled={format === "csv"}
                >
                  <SelectTrigger id="export-pattern-mode" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(PATTERN_MODE_LABELS) as [PatternMode, string][]).map(
                      ([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </span>
            </TooltipTrigger>
            {format === "csv" && <TooltipContent>CSV ではシート分けできません</TooltipContent>}
          </Tooltip>
        </div>

        {/* CSV options */}
        {format === "csv" && (
          <div className="flex flex-col gap-4">
            <Label>CSV 設定</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="csv-delimiter" className="text-xs text-muted-foreground">
                  区切り文字
                </Label>
                <Select value={delimiter} onValueChange={(v) => setDelimiter(v as CSVDelimiter)}>
                  <SelectTrigger id="csv-delimiter" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="comma">カンマ (,)</SelectItem>
                    <SelectItem value="tab">タブ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="csv-line-ending" className="text-xs text-muted-foreground">
                  改行コード
                </Label>
                <Select value={lineEnding} onValueChange={(v) => setLineEnding(v as CSVLineEnding)}>
                  <SelectTrigger id="csv-line-ending" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="crlf">CRLF (Windows)</SelectItem>
                    <SelectItem value="lf">LF (Mac/Linux)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="csv-bom"
                checked={bom}
                onCheckedChange={(checked) => setBom(checked === true)}
              />
              <Label htmlFor="csv-bom" className="select-none font-normal">
                BOM を付与 (Excel で日本語を正しく表示)
              </Label>
            </div>
          </div>
        )}

        {/* Candidates */}
        {trip.candidates.length > 0 && (
          <div className="flex items-center gap-2">
            <Checkbox
              id="export-include-candidates"
              checked={includeCandidates}
              onCheckedChange={(checked) => setIncludeCandidates(checked === true)}
            />
            <Label htmlFor="export-include-candidates" className="select-none">
              候補を含める ({trip.candidates.length}件)
            </Label>
          </div>
        )}
      </div>

      {/* Preview + Export */}
      <div className="min-w-0 space-y-6">
        <div className="flex items-center gap-2">
          <Input
            id="export-filename"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            placeholder="ファイル名"
            className="flex-1"
          />
          <span className="shrink-0 text-sm text-muted-foreground">{fileExtension}</span>
          <Button
            onClick={handleExport}
            disabled={effectiveFields.length === 0 || exporting}
            size="sm"
            className="shrink-0"
          >
            <Download className="h-4 w-4" />
            {exporting ? "エクスポート中..." : "エクスポート"}
          </Button>
        </div>

        <div className="rounded-lg border">
          {showSheetTabs && (
            <div className="flex border-b bg-muted/30 px-2 pt-2">
              {sheetNames.map((name) => (
                <button
                  key={name}
                  type="button"
                  className={cn(
                    "rounded-t-md px-3 py-1.5 text-sm transition-colors",
                    name === activeSheet
                      ? "-mb-px border border-b-0 bg-background font-medium"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setActiveSheet(name)}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
          <div className="overflow-x-auto overscroll-x-contain">
            {activeFields.length > 0 && activeRows.length > 0 ? (
              <>
                <table className="text-xs">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      {activeFields.map((field) => (
                        <th
                          key={field}
                          className="whitespace-nowrap px-3 py-2 text-left font-medium"
                        >
                          {EXPORT_FIELD_LABELS[field]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeRows.map((row, index) => {
                      const nameLabel = EXPORT_FIELD_LABELS.name;
                      const rowKey = `${activeSheet}-${row[nameLabel]}-${index}`;
                      return (
                        <tr key={rowKey} className="border-b last:border-b-0">
                          {activeFields.map((field) => (
                            <td
                              key={field}
                              className={cn(
                                "px-3 py-1.5",
                                field === "urls" || field === "memo"
                                  ? "whitespace-pre"
                                  : "h-8 max-w-[200px] whitespace-nowrap truncate",
                              )}
                            >
                              {row[EXPORT_FIELD_LABELS[field]] ?? ""}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {/* CSV: show candidates inline */}
                {candidateSheetData && candidateSheetData.rows.length > 0 && (
                  <>
                    <div className="border-t px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/30">
                      --- 候補 ---
                    </div>
                    <table className="text-xs">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          {candidateSheetData.fields.map((field) => (
                            <th
                              key={field}
                              className="whitespace-nowrap px-3 py-2 text-left font-medium"
                            >
                              {EXPORT_FIELD_LABELS[field]}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {candidateSheetData.rows.map((row, index) => {
                          const nameLabel = EXPORT_FIELD_LABELS.name;
                          const rowKey = `candidate-${row[nameLabel]}-${index}`;
                          return (
                            <tr key={rowKey} className="border-b last:border-b-0">
                              {candidateSheetData.fields.map((field) => (
                                <td
                                  key={field}
                                  className={cn(
                                    "px-3 py-1.5",
                                    field === "urls" || field === "memo"
                                      ? "whitespace-pre"
                                      : "h-8 max-w-[200px] whitespace-nowrap truncate",
                                  )}
                                >
                                  {row[EXPORT_FIELD_LABELS[field]] ?? ""}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </>
                )}
              </>
            ) : (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                {effectiveFields.length === 0
                  ? "出力する列を選択するとプレビューが表示されます"
                  : "このシートにデータがありません"}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
