/* ----------------------------------------------------------
 * runtimeDiagnostics.ts
 *
 * Map StepZen runtime diagnostics back onto SDL source so we can
 * surface VS Code Diagnostics, including HTTP fetch timings.
 * Implements ancestor-walk to accurately match nested fetch spans.
 * ---------------------------------------------------------*/
import * as vscode from "vscode";
import { findDefinition } from "../utils/stepzenProjectScanner";
import { services } from "../services";
import { StepZenDiagnostic } from "../types";

/*────────────────────────────── types ─────────────────────────────*/
/**
 * Summary of request information collected from diagnostics
 * Used to display timing and status information in the editor
 */
interface RequestSummary {
  pathKey: string;        // Path in the GraphQL response (e.g. "Query.users")
  originalField?: string; // Original field name if different from path
  maxStatus?: number;     // HTTP status code (highest if multiple)
  maxMs?: number;         // Request duration in milliseconds (highest if multiple)
}

/**
 * Raw OpenTelemetry span data from StepZen diagnostics
 * Contains timing and attribute information for tracing
 */
interface RawSpan {
  spanId: string;         // Unique identifier for the span
  name: string;           // Name of the span (e.g. "fetch:users")
  parentSpanId?: string;  // ID of parent span for hierarchical tracing
  startTimeUnixNano?: string; // Start time in nanoseconds since Unix epoch
  endTimeUnixNano?: string;   // End time in nanoseconds since Unix epoch
  attributes?: { key: string; value: { intValue?: number; stringValue?: string; boolValue?: boolean } }[]; // Custom attributes
}

/*──────────────────── summarise raw diagnostics ───────────────────*/
/**
 * Processes raw StepZen diagnostics data to create request summaries
 * Extracts timing and status information from OpenTelemetry spans
 * 
 * @param raw Array of raw diagnostic entries from StepZen response
 * @returns Record mapping path keys to request summaries
 */
export function summariseDiagnostics(raw: StepZenDiagnostic[]): Record<string, RequestSummary> {
  const byPath: Record<string, RequestSummary> = {};

  // 1) Build full span map and collect fetch spans
  const spanById = new Map<string, RawSpan>();
  const fetchSpans: RawSpan[] = [];
  const otelEntry = raw.find(d => !!d.otel?.traces?.resourceSpans);
  if (otelEntry && otelEntry.otel?.traces?.resourceSpans) {
    for (const rs of otelEntry.otel.traces.resourceSpans) {
      for (const ss of rs.scopeSpans || []) {
        for (const s of ss.spans || []) {
          const span = s as RawSpan;
          if (span.spanId) {
            spanById.set(span.spanId, span);
          }
          if (span.name?.startsWith('fetch:')) {
            fetchSpans.push(span);
          }
        }
      }
    }
    services.logger.debug(`[*] Collected ${spanById.size} spans, of which ${fetchSpans.length} are fetch spans`);
  } else {
    services.logger.debug(`[*] No OTel entry found in diagnostics`);
  }

  // ancestor-check helper
  function isAncestor(span: RawSpan, targetId: string): boolean {
    let pid = span.parentSpanId;
    while (pid) {
      if (pid === targetId) {
        return true;
      }
      const parent = spanById.get(pid);
      pid = parent?.parentSpanId;
    }
    return false;
  }

  // 2) Iterate diagnostics entries
  let lastKey = "$operation";
  for (const d of raw) {
    if (d.documentHash !== undefined) {
      lastKey = "$operation";
    }
    const key = Array.isArray(d.path) ? (d.path.join('.') || '$operation') : lastKey;
    lastKey = key;

    let bucket = byPath[key];
    if (!bucket) {
      bucket = { pathKey: key, originalField: d.fieldName };
      byPath[key] = bucket;
    }
    if (!bucket.originalField && d.fieldName) {
      bucket.originalField = d.fieldName;
    }

    // direct HTTP status
    const code = d.response?.statusCode ?? d.response?.status_code;
    if (typeof code === 'number') {
      bucket.maxStatus = Math.max(bucket.maxStatus ?? 0, code);
    }
    // direct DB/GraphQL timing
    const ns = d.duration ?? d.execution?.duration ?? d.prepare?.duration;
    if (ns !== null && ns !== undefined) {
      const ms = ns / 1e6;
      bucket.maxMs = Math.max(bucket.maxMs ?? 0, ms);
    }

    // match fetch spans by ancestor
    if (d.spanID) {
      const matches = fetchSpans.filter(span => isAncestor(span, d.spanID || ''));
      if (matches.length) {
        // logger.debug(`[*] matched ${matches.length} fetch span(s) for spanID=${d.spanID} at path=${key}`);
      }
      for (const span of matches) {
        applyHttpSpan(span, bucket);
      }
    }
  }

  return byPath;
}

/**
 * Extracts HTTP timing and status information from a span and updates the request summary
 * 
 * @param span The OpenTelemetry span containing HTTP request data
 * @param bucket The request summary to update with span information
 */
function applyHttpSpan(span: RawSpan, bucket: RequestSummary) {
  const start = span.startTimeUnixNano ? Number(span.startTimeUnixNano) : NaN;
  const end = span.endTimeUnixNano ? Number(span.endTimeUnixNano) : NaN;
  if (!isNaN(start) && !isNaN(end) && end > start) {
    const httpMs = (end - start) / 1e6;
    bucket.maxMs = Math.max(bucket.maxMs ?? 0, httpMs);
    // logger.debug(`    [${span.name}] duration=${httpMs.toFixed(1)}ms`);
  }
  const attr = span.attributes?.find(a => a.key === 'http.status_code');
  const raw = attr?.value?.intValue ?? attr?.value?.stringValue;
  const st = typeof raw === 'string' ? Number(raw) : raw;
  if (typeof st === 'number' && !isNaN(st)) {
    bucket.maxStatus = Math.max(bucket.maxStatus ?? 0, st);
    // logger.debug(`    [status] ${st}`);
  }
}

/*──────────────────── mapping & publish ─────────────────────────*/
/**
 * Converts a location object to VS Code location format
 * 
 * @param l Location object with filePath, line, and character properties
 * @returns VS Code URI and range for the location
 */
function toVsLoc(l: { filePath: string; line: number; character: number }): { uri: vscode.Uri; range: vscode.Range } {
  const uri = vscode.Uri.file(l.filePath);
  const pos = new vscode.Position(l.line, l.character);
  return { uri, range: new vscode.Range(pos, pos) };
}

/**
 * Attempts to locate a field in the source code based on its path key
 * Uses the definition index to find the right file and position
 * 
 * @param pathKey Path key in dot notation (e.g. "Query.users")
 * @returns VS Code location of the field or undefined if not found
 */
function locateField(pathKey: string): { uri: vscode.Uri; range: vscode.Range } | undefined {
  if (pathKey === '$operation') {
    return undefined;
  }
  const parts = pathKey.split('.');
  if (parts.length === 2) {
    const locs = findDefinition(parts[1]) || [];
    const match = locs.find((l) => l.container === parts[0]);
    if (match) {
      return toVsLoc(match);
    }
    return undefined;
  } else if (parts.length === 1) {
    const locs = findDefinition(parts[0]) || [];
    const match = locs.find((l) => ['Query','Mutation','Subscription'].includes(l.container || ''));
    if (match) {
      return toVsLoc(match);
    }
    return undefined;
  }
  return undefined;
}

/**
 * Determines the appropriate diagnostic severity based on HTTP status code
 * 
 * @param status HTTP status code
 * @returns Information for 2xx/3xx, Warning for 4xx, Error for 5xx
 */
function severityForStatus(status?: number): vscode.DiagnosticSeverity {
  if (!status || status < 400) {
    return vscode.DiagnosticSeverity.Information;
  }
  if (status >= 500) {
    return vscode.DiagnosticSeverity.Error;
  }
  return vscode.DiagnosticSeverity.Warning;
}

/**
 * Publishes diagnostics to VS Code's diagnostic collection
 * Maps request summaries to their source locations and creates diagnostic entries
 * 
 * @param summaries Record of request summaries by path key
 * @param collection VS Code diagnostic collection to publish to
 */
export function publishDiagnostics(
  summaries: Record<string, RequestSummary>,
  collection: vscode.DiagnosticCollection
) {
  collection.clear();
  const perFile = new Map<string, vscode.Diagnostic[]>();
  for (const s of Object.values(summaries)) {
    const loc = locateField(s.pathKey) || (s.originalField && locateField(s.originalField));
    if (!loc) {
      continue;
    }
    const diag = new vscode.Diagnostic(loc.range, `${s.pathKey} → ${s.maxStatus ?? ''}${s.maxMs ? ` ${s.maxMs.toFixed(1)} ms` : ''}`, severityForStatus(s.maxStatus));
    diag.source = 'StepZen';
    const key = loc.uri.toString();
    const arr = perFile.get(key) || [];
    arr.push(diag);
    perFile.set(key, arr);
  }
  for (const [file, diags] of perFile) {
    collection.set(vscode.Uri.parse(file), diags);
  }
  services.logger.info(`StepZen runtime diagnostics → ${perFile.size} file(s)`);
}
