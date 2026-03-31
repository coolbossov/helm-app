"use client";

import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Database,
  MapPin,
  Users,
  Upload,
  ChevronDown,
  ChevronRight,
  Plus,
  Pencil,
  Minus,
  AlertCircle,
  Eye,
} from "lucide-react";
import { Button, Card, CardHeader, CardContent, Badge, Spinner } from "@/components/ui";

// --- Types ---

interface VisitLogEntry {
  id: string;
  created_at: string;
  name: string;
  route_id?: string;
  stop_id?: string;
}

interface SyncLog {
  id: string;
  started_at: string;
  completed_at: string | null;
  status: "running" | "completed" | "failed";
  contacts_synced: number;
  contacts_created: number;
  contacts_updated: number;
  contacts_geocoded: number;
  error_message: string | null;
  created_at: string;
}

interface ContactChangeDetail {
  name: string;
  type: "created" | "updated" | "unchanged";
  fieldsChanged?: string[];
}

interface SyncDetails {
  contacts_synced: number;
  contacts_created: number;
  contacts_updated: number;
  contacts_unchanged: number;
  contacts_geocoded: number;
  details: ContactChangeDetail[];
}

interface PushPreview {
  field_updates: Array<{
    id: string;
    contact_name: string;
    fields: Record<string, unknown>;
  }>;
  activities: Array<{
    id: string;
    contact_name: string;
    type: string;
    title: string;
  }>;
  total_field_updates: number;
  total_activities: number;
}

interface FieldUpdateDetail {
  contactName: string;
  fields: Record<string, unknown>;
  status: "synced" | "failed";
  error?: string;
}

interface ActivitySyncDetail {
  contactName: string;
  type: string;
  title: string;
  status: "synced" | "failed";
  error?: string;
}

interface PushResult {
  fields_processed: number;
  fields_failed: number;
  activities_synced: number;
  activities_failed: number;
  field_details: FieldUpdateDetail[];
  activity_details: ActivitySyncDetail[];
}

// --- Helpers ---

/** Human-readable field labels */
const FIELD_LABELS: Record<string, string> = {
  first_name: "First Name",
  last_name: "Last Name",
  account_name: "Account",
  email: "Email",
  phone: "Phone",
  mobile: "Mobile",
  website: "Website",
  mailing_street: "Street",
  mailing_city: "City",
  mailing_state: "State",
  mailing_zip: "Zip",
  mailing_country: "Country",
  business_type: "Business Type",
  priority: "Priority",
  lifecycle_stage: "Lifecycle Stage",
  contacting_status: "Contact Status",
  contacting_tips: "Contact Tips",
  prospecting_notes: "Notes",
};

function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

// --- Components ---

function SyncSummaryCard({ data }: { data: SyncDetails }) {
  const [expanded, setExpanded] = useState(false);
  const changedDetails = data.details.filter((d) => d.type !== "unchanged");
  const hasDetails = changedDetails.length > 0;

  return (
    <div className="rounded-lg border border-green-200 bg-green-50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <span className="text-sm font-semibold text-green-800">Sync Complete</span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-4">
        <div className="flex items-center gap-1.5">
          <Plus className="h-3 w-3 text-green-600" />
          <span className="text-gray-700">
            <span className="font-medium">{data.contacts_created}</span> created
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Pencil className="h-3 w-3 text-amber-600" />
          <span className="text-gray-700">
            <span className="font-medium">{data.contacts_updated}</span> updated
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Minus className="h-3 w-3 text-gray-400" />
          <span className="text-gray-700">
            <span className="font-medium">{data.contacts_unchanged}</span> unchanged
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <MapPin className="h-3 w-3 text-blue-600" />
          <span className="text-gray-700">
            <span className="font-medium">{data.contacts_geocoded}</span> geocoded
          </span>
        </div>
      </div>

      {hasDetails && (
        <div className="mt-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs font-medium text-green-700 hover:text-green-900"
          >
            {expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            {expanded ? "Hide Details" : `Show Details (${changedDetails.length})`}
          </button>

          {expanded && (
            <div className="mt-2 max-h-64 overflow-y-auto space-y-1.5">
              {changedDetails.map((detail, i) => (
                <div
                  key={i}
                  className={`flex flex-wrap items-center gap-2 rounded px-2 py-1 text-xs ${
                    detail.type === "created"
                      ? "border-l-2 border-green-400 bg-green-50"
                      : "border-l-2 border-amber-400 bg-amber-50"
                  }`}
                >
                  <span className="font-medium text-gray-800 min-w-0 shrink-0">
                    {detail.name}
                  </span>
                  {detail.type === "created" ? (
                    <Badge className="bg-green-100 text-green-700 border-green-200">new</Badge>
                  ) : (
                    detail.fieldsChanged?.map((field) => (
                      <Badge key={field} className="bg-amber-100 text-amber-700 border-amber-200">
                        {fieldLabel(field)}
                      </Badge>
                    ))
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PushPreviewCard({
  preview,
  onConfirm,
  onCancel,
  pushing,
}: {
  preview: PushPreview;
  onConfirm: () => void;
  onCancel: () => void;
  pushing: boolean;
}) {
  const isEmpty = preview.total_field_updates === 0 && preview.total_activities === 0;

  if (isEmpty) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <span className="text-sm text-green-800">
            Nothing to push — all changes are in sync.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Eye className="h-4 w-4 text-blue-600" />
        <span className="text-sm font-semibold text-blue-800">Push Preview</span>
      </div>

      {preview.total_field_updates > 0 && (
        <div className="mb-3">
          <p className="text-xs font-medium text-gray-600 mb-1">
            Field Updates ({preview.total_field_updates})
          </p>
          <div className="space-y-1">
            {preview.field_updates.map((fu) => (
              <div key={fu.id} className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="font-medium text-gray-800">{fu.contact_name}</span>
                <span className="text-gray-400">&mdash;</span>
                {Object.keys(fu.fields).map((f) => (
                  <Badge key={f} className="bg-blue-100 text-blue-700 border-blue-200">
                    {fieldLabel(f)}
                  </Badge>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {preview.total_activities > 0 && (
        <div className="mb-3">
          <p className="text-xs font-medium text-gray-600 mb-1">
            Activity Notes ({preview.total_activities})
          </p>
          <div className="space-y-1">
            {preview.activities.map((a) => (
              <div key={a.id} className="text-xs">
                <span className="font-medium text-gray-800">{a.contact_name}</span>
                <span className="text-gray-400"> &mdash; </span>
                <span className="text-gray-600">
                  {a.type}: {a.title}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-blue-200">
        <Button onClick={onConfirm} disabled={pushing}>
          <Upload className={`h-4 w-4 ${pushing ? "animate-pulse" : ""}`} />
          {pushing ? "Pushing..." : "Confirm Push"}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={pushing}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function PushResultCard({ result }: { result: PushResult }) {
  const hasFailures = result.fields_failed > 0 || result.activities_failed > 0;
  const allDetails = [
    ...result.field_details.map((d) => ({ ...d, kind: "field" as const })),
    ...result.activity_details.map((d) => ({
      contactName: d.contactName,
      status: d.status,
      error: d.error,
      kind: "activity" as const,
      type: d.type,
      title: d.title,
    })),
  ];

  return (
    <div
      className={`rounded-lg border p-4 ${
        hasFailures
          ? "border-amber-200 bg-amber-50"
          : "border-green-200 bg-green-50"
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        {hasFailures ? (
          <AlertCircle className="h-4 w-4 text-amber-600" />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-green-600" />
        )}
        <span
          className={`text-sm font-semibold ${
            hasFailures ? "text-amber-800" : "text-green-800"
          }`}
        >
          Push Complete
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-4 mb-3">
        <span className="text-gray-700">
          <span className="font-medium">{result.fields_processed}</span> fields synced
        </span>
        {result.fields_failed > 0 && (
          <span className="text-red-600">
            <span className="font-medium">{result.fields_failed}</span> fields failed
          </span>
        )}
        <span className="text-gray-700">
          <span className="font-medium">{result.activities_synced}</span> activities synced
        </span>
        {result.activities_failed > 0 && (
          <span className="text-red-600">
            <span className="font-medium">{result.activities_failed}</span> activities failed
          </span>
        )}
      </div>

      {allDetails.length > 0 && (
        <div className="max-h-48 overflow-y-auto space-y-1">
          {allDetails.map((d, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 rounded px-2 py-1 text-xs ${
                d.status === "failed"
                  ? "border-l-2 border-red-400 bg-red-50"
                  : "border-l-2 border-green-400 bg-green-50/50"
              }`}
            >
              {d.status === "synced" ? (
                <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
              ) : (
                <XCircle className="h-3 w-3 text-red-500 shrink-0" />
              )}
              <span className="font-medium text-gray-800">{d.contactName}</span>
              {d.kind === "activity" && (
                <span className="text-gray-500">{d.title}</span>
              )}
              {d.error && <span className="text-red-600">{d.error}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Main Page ---

export default function SettingsPage() {
  // Pull sync state
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncDetails, setSyncDetails] = useState<SyncDetails | null>(null);

  // Push state
  const [pushPreviewLoading, setPushPreviewLoading] = useState(false);
  const [pushPreview, setPushPreview] = useState<PushPreview | null>(null);
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<PushResult | null>(null);
  const [pushError, setPushError] = useState<string | null>(null);

  // Sync history
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch("/api/sync/status");
      if (res.ok) {
        const json = await res.json();
        setLogs(json.data ?? []);
      }
    } catch {
      // Ignore
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Visit log
  const [visitLog, setVisitLog] = useState<VisitLogEntry[]>([]);
  const [visitLogLoading, setVisitLogLoading] = useState(false);
  const [visitLogLoaded, setVisitLogLoaded] = useState(false);

  const fetchVisitLog = useCallback(async () => {
    setVisitLogLoading(true);
    try {
      const res = await fetch("/api/visit-log");
      if (res.ok) {
        const json = await res.json();
        setVisitLog(json.data ?? []);
        setVisitLogLoaded(true);
      }
    } catch { /* ignore */ } finally {
      setVisitLogLoading(false);
    }
  }, []);

  // --- Pull Sync ---

  async function handleSync() {
    setSyncing(true);
    setSyncError(null);
    setSyncDetails(null);

    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const json = await res.json();

      if (!res.ok) {
        setSyncError(json.error);
      } else {
        setSyncDetails({
          contacts_synced: json.contacts_synced,
          contacts_created: json.contacts_created,
          contacts_updated: json.contacts_updated,
          contacts_unchanged: json.contacts_unchanged,
          contacts_geocoded: json.contacts_geocoded,
          details: json.details ?? [],
        });
        fetchLogs();
      }
    } catch {
      setSyncError("Sync failed. Check your connection and try again.");
    } finally {
      setSyncing(false);
    }
  }

  // --- Push Preview + Confirm ---

  async function handlePushPreview() {
    setPushPreviewLoading(true);
    setPushPreview(null);
    setPushResult(null);
    setPushError(null);

    try {
      const res = await fetch("/api/sync/push/preview");
      const json = await res.json();

      if (!res.ok) {
        setPushError(json.error);
      } else {
        setPushPreview(json);
      }
    } catch {
      setPushError("Failed to load push preview.");
    } finally {
      setPushPreviewLoading(false);
    }
  }

  async function handlePushConfirm() {
    setPushing(true);
    setPushError(null);

    try {
      const res = await fetch("/api/sync/push", { method: "POST" });
      const json = await res.json();

      if (!res.ok) {
        setPushError(json.error);
      } else {
        setPushPreview(null);
        setPushResult({
          fields_processed: json.fields_processed,
          fields_failed: json.fields_failed,
          activities_synced: json.activities_synced,
          activities_failed: json.activities_failed,
          field_details: json.field_details ?? [],
          activity_details: json.activity_details ?? [],
        });
      }
    } catch {
      setPushError("Push failed. Check your connection and try again.");
    } finally {
      setPushing(false);
    }
  }

  function handlePushCancel() {
    setPushPreview(null);
  }

  // --- Render ---

  const statusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "running":
        return <Spinner size="sm" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  return (
    <div className="h-full overflow-y-auto">
    <div className="mx-auto max-w-2xl space-y-6 p-4 pb-20 sm:p-6">
      <h1 className="text-xl font-bold text-gray-900">Settings</h1>

      {/* CRM Sync — Pull */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-blue-600" />
            <h2 className="text-sm font-semibold text-gray-900">CRM Sync</h2>
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-gray-600">
            Sync all contacts from Zoho Bigin CRM and geocode new addresses.
            This may take a few minutes for large contact lists.
          </p>

          <div className="space-y-3">
            {/* Sync Now button */}
            <Button onClick={handleSync} disabled={syncing}>
              <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing..." : "Sync Now"}
            </Button>

            {/* Syncing indicator */}
            {syncing && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Spinner size="sm" />
                Fetching contacts from Bigin...
              </div>
            )}

            {/* Sync error */}
            {syncError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-red-700">{syncError}</span>
                </div>
              </div>
            )}

            {/* Sync result */}
            {syncDetails && <SyncSummaryCard data={syncDetails} />}
          </div>
        </CardContent>
      </Card>

      {/* CRM Push */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-indigo-600" />
            <h2 className="text-sm font-semibold text-gray-900">Push to CRM</h2>
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-gray-600">
            Push field changes and activity notes from the app back to Zoho Bigin.
            Review what will be pushed before confirming.
          </p>

          <div className="space-y-3">
            {/* Push button — only shown when no preview/result is active */}
            {!pushPreview && !pushResult && (
              <Button
                variant="secondary"
                onClick={handlePushPreview}
                disabled={pushPreviewLoading}
              >
                {pushPreviewLoading ? (
                  <Spinner size="sm" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {pushPreviewLoading ? "Loading preview..." : "Push to CRM"}
              </Button>
            )}

            {/* Push error */}
            {pushError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-red-700">{pushError}</span>
                </div>
              </div>
            )}

            {/* Push preview */}
            {pushPreview && (
              <PushPreviewCard
                preview={pushPreview}
                onConfirm={handlePushConfirm}
                onCancel={handlePushCancel}
                pushing={pushing}
              />
            )}

            {/* Push result */}
            {pushResult && (
              <>
                <PushResultCard result={pushResult} />
                <Button
                  variant="secondary"
                  onClick={() => {
                    setPushResult(null);
                    setPushError(null);
                  }}
                  className="text-xs"
                >
                  Dismiss
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sync History */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-900">Sync History</h2>
          </div>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="flex justify-center py-4">
              <Spinner />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-center text-sm text-gray-500 py-4">
              No sync history yet. Click &quot;Sync Now&quot; to start.
            </p>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 rounded-lg border border-gray-100 p-3"
                >
                  <div className="mt-0.5">{statusIcon(log.status)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium capitalize text-gray-900">
                        {log.status}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(log.started_at).toLocaleString()}
                      </span>
                    </div>

                    {log.status === "completed" && (
                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {log.contacts_synced} synced
                        </span>
                        {log.contacts_created > 0 && (
                          <span className="flex items-center gap-1">
                            <Plus className="h-3 w-3 text-green-500" />
                            {log.contacts_created} new
                          </span>
                        )}
                        {log.contacts_updated > 0 && (
                          <span className="flex items-center gap-1">
                            <Pencil className="h-3 w-3 text-amber-500" />
                            {log.contacts_updated} updated
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {log.contacts_geocoded} geocoded
                        </span>
                      </div>
                    )}

                    {log.error_message && (
                      <p className="mt-1 text-xs text-red-500">
                        {log.error_message}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Visit Log */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-green-600" />
              <h2 className="text-sm font-semibold text-gray-900">Visit Log</h2>
            </div>
            {!visitLogLoaded && (
              <Button variant="secondary" onClick={fetchVisitLog} disabled={visitLogLoading} className="text-xs py-1 px-2 h-auto">
                {visitLogLoading ? <Spinner size="sm" /> : "Load"}
              </Button>
            )}
            {visitLogLoaded && (
              <Button variant="secondary" onClick={fetchVisitLog} disabled={visitLogLoading} className="text-xs py-1 px-2 h-auto">
                {visitLogLoading ? <Spinner size="sm" /> : <RefreshCw className="h-3 w-3" />}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!visitLogLoaded && !visitLogLoading && (
            <p className="text-center text-sm text-gray-500 py-4">
              Click Load to see recent visit activity.
            </p>
          )}
          {visitLogLoading && (
            <div className="flex justify-center py-4"><Spinner /></div>
          )}
          {visitLogLoaded && visitLog.length === 0 && (
            <p className="text-center text-sm text-gray-500 py-4">
              No visits logged yet.
            </p>
          )}
          {visitLogLoaded && visitLog.length > 0 && (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {visitLog.map((entry) => (
                <div key={entry.id} className="flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-gray-900 truncate block">{entry.name}</span>
                    <span className="text-xs text-gray-400">
                      {new Date(entry.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </div>
  );
}
