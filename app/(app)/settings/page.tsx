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
} from "lucide-react";
import { Button, Card, CardHeader, CardContent, Spinner } from "@/components/ui";

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

export default function SettingsPage() {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<string | null>(null);
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

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);

    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const json = await res.json();

      if (!res.ok) {
        setSyncResult(`Error: ${json.error}`);
      } else {
        setSyncResult(
          `Synced ${json.contacts_synced} contacts, geocoded ${json.contacts_geocoded}`
        );
        fetchLogs();
      }
    } catch (err) {
      setSyncResult("Sync failed. Check your connection and try again.");
    } finally {
      setSyncing(false);
    }
  }

  async function handlePush() {
    setPushing(true);
    setPushResult(null);
    try {
      const res = await fetch("/api/sync/push", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setPushResult(`Error: ${json.error}`);
      } else {
        setPushResult(
          `Pushed ${json.fields_processed} field updates, ${json.activities_synced} activities`
        );
      }
    } catch {
      setPushResult("Push failed. Check your connection and try again.");
    } finally {
      setPushing(false);
    }
  }

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
    <div className="mx-auto max-w-2xl space-y-6 p-4 pb-20 sm:p-6">
      <h1 className="text-xl font-bold text-gray-900">Settings</h1>

      {/* CRM Sync */}
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
            <div className="flex items-center gap-3">
              <Button onClick={handleSync} disabled={syncing}>
                <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Syncing…" : "Sync Now"}
              </Button>

              {syncResult && (
                <p
                  className={`text-sm ${
                    syncResult.startsWith("Error")
                      ? "text-red-600"
                      : "text-green-600"
                  }`}
                >
                  {syncResult}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button variant="secondary" onClick={handlePush} disabled={pushing}>
                <Upload className={`h-4 w-4 ${pushing ? "animate-pulse" : ""}`} />
                {pushing ? "Pushing…" : "Push to CRM"}
              </Button>

              {pushResult && (
                <p
                  className={`text-sm ${
                    pushResult.startsWith("Error")
                      ? "text-red-600"
                      : "text-green-600"
                  }`}
                >
                  {pushResult}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sync Log */}
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
              No sync history yet. Click "Sync Now" to start.
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
    </div>
  );
}
