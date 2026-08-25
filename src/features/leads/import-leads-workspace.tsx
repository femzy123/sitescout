"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  Download,
  FileSpreadsheet,
  FileUp,
  LoaderCircle,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  importFieldLabels,
  importTargetFields,
  leadIntakeSchema,
  normalizeWebsiteUrl,
  resolveImportedRow,
  suggestColumnMapping,
  type ColumnMapping,
  type ImportTargetField,
} from "@/lib/lead-intake";
import { cn } from "@/lib/utils";

type ParsedRow = { rowNumber: number; values: Record<string, string> };
type ImportResult = {
  importId: string;
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  rejectedCount: number;
  issues: Array<{ row: number; code: string; message: string }>;
};
type Step = "upload" | "mapping" | "preview" | "result";

const assignableFields = importTargetFields.filter(
  (field): field is Exclude<ImportTargetField, "metadata"> =>
    field !== "metadata",
);
const steps: Array<{ id: Step; label: string }> = [
  { id: "upload", label: "Upload" },
  { id: "mapping", label: "Map fields" },
  { id: "preview", label: "Review" },
  { id: "result", label: "Results" },
];

function SelectColumn({
  label,
  value,
  headers,
  exclude,
  onChange,
}: {
  label: string;
  value?: string;
  headers: string[];
  exclude?: string;
  onChange: (value: string | undefined) => void;
}) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-wider text-muted">
      {label}
      <select
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || undefined)}
        className="mt-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-medium normal-case tracking-normal text-foreground outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20"
      >
        <option value="">Not mapped</option>
        {headers.map((header) => (
          <option key={header} value={header} disabled={header === exclude}>
            {header}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ImportLeadsWorkspace() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const preview = useMemo(
    () =>
      rows.map((row) => {
        const resolved = resolveImportedRow(row.values, mapping, sourceName);
        const validation = leadIntakeSchema.safeParse(resolved);
        let issue = validation.success
          ? undefined
          : validation.error.issues[0]?.message;
        if (!issue && resolved.websiteUrl) {
          try {
            normalizeWebsiteUrl(resolved.websiteUrl);
          } catch (error) {
            issue = error instanceof Error ? error.message : "Invalid website";
          }
        }
        return { row: row.rowNumber, resolved, issue };
      }),
    [mapping, rows, sourceName],
  );
  const validCount = preview.filter((row) => !row.issue).length;
  const rejectedPreviewCount = preview.length - validCount;
  const mappedColumns = new Set(
    Object.entries(mapping)
      .filter(([field]) => field !== "metadata")
      .flatMap(([, value]) => value ?? []),
  );
  const currentStepIndex = steps.findIndex((item) => item.id === step);

  function reset() {
    setStep("upload");
    setFileName("");
    setSourceName("");
    setHeaders([]);
    setRows([]);
    setMapping({});
    setResult(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  function acceptFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Choose a .csv file");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("CSV files must be 2 MB or smaller");
      return;
    }

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (header) => header.trim(),
      complete: (parsed) => {
        if (parsed.meta.renamedHeaders) {
          toast.error("CSV headers must be unique");
          return;
        }
        const parsedHeaders = parsed.meta.fields?.filter(Boolean) ?? [];
        if (!parsedHeaders.length) {
          toast.error("The CSV needs a header row");
          return;
        }
        if (parsedHeaders.length > 100) {
          toast.error("CSV files can contain at most 100 columns");
          return;
        }
        if (parsed.data.length > 1000) {
          toast.error("CSV files can contain at most 1,000 data rows");
          return;
        }
        if (!parsed.data.length) {
          toast.error("The CSV does not contain any data rows");
          return;
        }
        const fatal = parsed.errors.find(
          (error) =>
            error.code !== "TooFewFields" && error.code !== "TooManyFields",
        );
        if (fatal) {
          toast.error(`Could not parse CSV: ${fatal.message}`);
          return;
        }
        setFileName(file.name);
        setSourceName(file.name.replace(/\.csv$/i, ""));
        setHeaders(parsedHeaders);
        setRows(
          parsed.data.map((values, index) => ({
            rowNumber: index + 2,
            values: Object.fromEntries(
              parsedHeaders.map((header) => [header, values[header] ?? ""]),
            ),
          })),
        );
        setMapping(suggestColumnMapping(parsedHeaders));
        setStep("mapping");
      },
      error: (error) => toast.error(`Could not read CSV: ${error.message}`),
    });
  }

  function setMappedColumn(
    field: Exclude<ImportTargetField, "metadata">,
    position: 0 | 1,
    column: string | undefined,
  ) {
    setMapping((current) => {
      const next = { ...current };
      const columns = [...(current[field] ?? [])];
      columns[position] = column ?? "";
      const compact = columns.filter(Boolean);
      if (compact.length) next[field] = compact;
      else delete next[field];
      if (column && next.metadata) {
        next.metadata = next.metadata.filter((header) => header !== column);
      }
      return next;
    });
  }

  function toggleMetadata(header: string) {
    setMapping((current) => {
      const metadata = new Set(current.metadata ?? []);
      if (metadata.has(header)) metadata.delete(header);
      else metadata.add(header);
      return { ...current, metadata: [...metadata] };
    });
  }

  async function runImport() {
    setImporting(true);
    try {
      const response = await fetch("/api/leads/imports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName, sourceName, mapping, rows }),
      });
      const data = (await response.json()) as ImportResult & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not import leads");
      setResult(data);
      setStep("result");
      router.refresh();
      toast.success("Lead import completed");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not import leads",
      );
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl pb-12">
      <div className="mb-7 flex items-center justify-between gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/leads">
            <ArrowLeft className="size-4" />
            Back to leads
          </Link>
        </Button>
        <a
          href="/sitescout-lead-import-template.csv"
          download
          className="inline-flex items-center gap-2 text-sm font-semibold text-violet-300 transition hover:text-violet-200"
        >
          <Download className="size-4" />
          Download template
        </a>
      </div>

      <header className="mb-8 max-w-3xl">
        <p className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-violet-300">
          <span className="h-px w-6 bg-current" />
          Lead intake
        </p>
        <h1 className="font-display text-4xl font-bold tracking-tighter sm:text-5xl">
          Turn a spreadsheet into a working pipeline.
        </h1>
        <p className="mt-3 text-base leading-7 text-muted">
          Your file stays in this browser until you confirm. SiteScout sends
          only mapped rows, keeps existing values, and never starts analysis
          automatically.
        </p>
      </header>

      <div className="mb-5 flex items-center overflow-x-auto rounded-2xl border border-border bg-surface/70 p-2">
        {steps.map((item, index) => (
          <div key={item.id} className="flex min-w-0 flex-1 items-center">
            <div
              aria-current={index === currentStepIndex ? "step" : undefined}
              className={cn(
                "flex min-w-max items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold",
                index === currentStepIndex
                  ? "bg-violet-500/15 text-violet-200"
                  : index < currentStepIndex
                    ? "text-emerald-300"
                    : "text-muted",
              )}
            >
              <span
                className={cn(
                  "grid size-6 place-items-center rounded-full border text-[10px]",
                  index <= currentStepIndex
                    ? "border-current"
                    : "border-border",
                )}
              >
                {index < currentStepIndex ? (
                  <Check className="size-3" />
                ) : (
                  index + 1
                )}
              </span>
              {item.label}
            </div>
            {index < steps.length - 1 && (
              <span className="mx-1 h-px min-w-4 flex-1 bg-border" />
            )}
          </div>
        ))}
      </div>

      <main className="overflow-hidden rounded-3xl border border-border bg-[#111014] shadow-[0_30px_80px_-48px_rgba(0,0,0,.9)]">
        {step === "upload" && (
          <section className="p-5 sm:p-10">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                const file = event.dataTransfer.files[0];
                if (file) acceptFile(file);
              }}
              className={cn(
                "group grid min-h-80 w-full place-items-center rounded-2xl border border-dashed p-8 text-center outline-none transition focus-visible:ring-2 focus-visible:ring-violet-400",
                dragging
                  ? "border-violet-400 bg-violet-500/10"
                  : "border-border-strong bg-background/40 hover:border-violet-400/70 hover:bg-violet-500/5",
              )}
            >
              <span>
                <span className="mx-auto grid size-16 place-items-center rounded-2xl border border-violet-400/30 bg-violet-500/10 text-violet-300 transition group-hover:-translate-y-1">
                  <FileUp className="size-7" />
                </span>
                <span className="mt-5 block font-display text-2xl font-bold tracking-tighter">
                  Drop your CSV here
                </span>
                <span className="mt-2 block text-sm text-muted">
                  or click to browse · up to 2 MB and 1,000 rows
                </span>
              </span>
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) acceptFile(file);
              }}
            />
          </section>
        )}

        {step === "mapping" && (
          <section>
            <div className="border-b border-border p-5 sm:p-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <FileSpreadsheet className="size-4 text-violet-300" />
                    {fileName}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {rows.length.toLocaleString()} rows · {headers.length}{" "}
                    columns
                  </p>
                </div>
                <label className="w-full text-xs font-semibold uppercase tracking-wider text-muted sm:max-w-xs">
                  Source label
                  <Input
                    value={sourceName}
                    onChange={(event) => setSourceName(event.target.value)}
                    className="mt-2"
                    maxLength={160}
                  />
                </label>
              </div>
            </div>
            <div className="p-5 sm:p-7">
              <div className="mb-5">
                <h2 className="font-display text-2xl font-bold tracking-tighter">
                  Match columns to lead fields
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Primary is tried first; fallback is used when the primary cell
                  is blank.
                </p>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {assignableFields.map((field) => {
                  const values = mapping[field] ?? [];
                  return (
                    <div
                      key={field}
                      className={cn(
                        "rounded-xl border p-4",
                        field === "businessName"
                          ? "border-violet-400/40 bg-violet-500/5"
                          : "border-border bg-surface/60",
                      )}
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-bold">
                          {importFieldLabels[field]}
                          {field === "businessName" && (
                            <span className="ml-1 text-violet-300">*</span>
                          )}
                        </p>
                        {values.length > 0 && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                            Mapped
                          </span>
                        )}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <SelectColumn
                          label="Primary"
                          value={values[0]}
                          headers={headers}
                          exclude={values[1]}
                          onChange={(value) => setMappedColumn(field, 0, value)}
                        />
                        <SelectColumn
                          label="Fallback"
                          value={values[1]}
                          headers={headers}
                          exclude={values[0]}
                          onChange={(value) => setMappedColumn(field, 1, value)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-5 rounded-xl border border-border bg-surface/60 p-4">
                <h3 className="text-sm font-bold">Keep as source metadata</h3>
                <p className="mt-1 text-xs leading-5 text-muted">
                  Useful reference fields are stored with new businesses but do
                  not overwrite lead fields. Everything else is ignored.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {headers
                    .filter((header) => !mappedColumns.has(header))
                    .map((header) => {
                      const active = mapping.metadata?.includes(header);
                      return (
                        <button
                          key={header}
                          type="button"
                          aria-pressed={active}
                          onClick={() => toggleMetadata(header)}
                          className={cn(
                            "rounded-lg border px-3 py-2 text-xs font-semibold transition",
                            active
                              ? "border-violet-400/50 bg-violet-500/15 text-violet-200"
                              : "border-border bg-background text-muted hover:text-foreground",
                          )}
                        >
                          {active && <Check className="mr-1 inline size-3" />}
                          {header}
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>
            <footer className="flex flex-col-reverse gap-3 border-t border-border p-5 sm:flex-row sm:justify-between sm:p-7">
              <Button variant="ghost" onClick={reset}>
                <RotateCcw className="size-4" />
                Choose another file
              </Button>
              <Button
                onClick={() => setStep("preview")}
                disabled={!mapping.businessName?.length || !sourceName.trim()}
              >
                Review {rows.length.toLocaleString()} rows
                <ArrowRight className="size-4" />
              </Button>
            </footer>
          </section>
        )}

        {step === "preview" && (
          <section>
            <div className="border-b border-border p-5 sm:p-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="font-display text-2xl font-bold tracking-tighter">
                    Review resolved leads
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    Showing the first 10 rows. Invalid rows are rejected
                    individually.
                  </p>
                </div>
                <div className="flex gap-2">
                  <span className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-300">
                    {validCount} ready
                  </span>
                  {rejectedPreviewCount > 0 && (
                    <span className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-300">
                      {rejectedPreviewCount} warnings
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-190 text-left text-sm">
                <thead className="border-b border-border bg-surface/60 text-[10px] uppercase tracking-widest text-muted">
                  <tr>
                    <th className="px-5 py-3">Row</th>
                    <th className="px-5 py-3">Business</th>
                    <th className="px-5 py-3">Contact</th>
                    <th className="px-5 py-3">Website</th>
                    <th className="px-5 py-3">Address / issue</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 10).map((item) => (
                    <tr
                      key={item.row}
                      className="border-b border-border/70 last:border-0"
                    >
                      <td className="px-5 py-4 tabular text-muted">
                        {item.row}
                      </td>
                      <td className="px-5 py-4 font-semibold">
                        {item.resolved.businessName || (
                          <span className="text-danger">Missing</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-muted-strong">
                        <span className="block">
                          {item.resolved.contactName ?? "—"}
                        </span>
                        <span className="block text-xs text-muted">
                          {item.resolved.contactEmail ??
                            item.resolved.contactPhone ??
                            ""}
                        </span>
                      </td>
                      <td className="max-w-48 truncate px-5 py-4 text-muted">
                        {item.resolved.websiteUrl ?? "—"}
                      </td>
                      <td className="max-w-72 px-5 py-4 text-muted">
                        {item.issue ? (
                          <span className="flex items-start gap-2 text-amber-300">
                            <CircleAlert className="mt-0.5 size-4 shrink-0" />
                            {item.issue}
                          </span>
                        ) : (
                          (item.resolved.formattedAddress ?? "—")
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 10 && (
              <p className="border-t border-border px-5 py-3 text-center text-xs text-muted">
                Plus {(rows.length - 10).toLocaleString()} more rows
              </p>
            )}
            <footer className="flex flex-col-reverse gap-3 border-t border-border p-5 sm:flex-row sm:justify-between sm:p-7">
              <Button variant="ghost" onClick={() => setStep("mapping")}>
                <ArrowLeft className="size-4" />
                Adjust mapping
              </Button>
              <Button
                onClick={runImport}
                disabled={importing || validCount === 0}
              >
                {importing ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <FileUp className="size-4" />
                )}
                {importing
                  ? "Importing..."
                  : `Import ${validCount.toLocaleString()} valid rows`}
              </Button>
            </footer>
          </section>
        )}

        {step === "result" && result && (
          <section className="p-5 sm:p-10">
            <div className="mx-auto max-w-3xl text-center">
              <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-300">
                <Check className="size-7" />
              </span>
              <h2 className="mt-5 font-display text-3xl font-bold tracking-tighter">
                Your pipeline is ready.
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                {result.totalRows.toLocaleString()} rows processed from{" "}
                {fileName}. No analysis was started.
              </p>
            </div>
            <div className="mx-auto mt-8 grid max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-4">
              {[
                {
                  label: "Created",
                  value: result.createdCount,
                  color: "text-emerald-300",
                },
                {
                  label: "Enriched",
                  value: result.updatedCount,
                  color: "text-violet-300",
                },
                {
                  label: "Unchanged",
                  value: result.skippedCount,
                  color: "text-muted-strong",
                },
                {
                  label: "Rejected",
                  value: result.rejectedCount,
                  color: "text-amber-300",
                },
              ].map((stat) => (
                <div key={stat.label} className="bg-surface p-5 text-center">
                  <p
                    className={cn(
                      "font-display text-3xl font-bold tabular",
                      stat.color,
                    )}
                  >
                    {stat.value}
                  </p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-muted">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
            {result.issues.length > 0 && (
              <div className="mx-auto mt-6 max-w-3xl rounded-xl border border-amber-400/20 bg-amber-500/5 p-4">
                <h3 className="flex items-center gap-2 text-sm font-bold text-amber-200">
                  <CircleAlert className="size-4" />
                  Rows needing attention
                </h3>
                <ul className="mt-3 max-h-40 space-y-2 overflow-y-auto text-sm text-muted">
                  {result.issues.map((issue) => (
                    <li key={`${issue.row}-${issue.code}`}>
                      <span className="font-semibold text-muted-strong">
                        Row {issue.row}:
                      </span>{" "}
                      {issue.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button variant="secondary" onClick={reset}>
                <RotateCcw className="size-4" />
                Import another CSV
              </Button>
              <Button asChild>
                <Link href="/leads">
                  View leads
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
