"use client";

import { useState, memo } from "react";
import {
  X,
  Navigation,
  ExternalLink,
  Phone,
  Mail,
  Globe,
  MapPin,
  AlertCircle,
  Plus,
  Pencil,
  Check,
  Footprints,
} from "lucide-react";
import { Button, BusinessTypeBadge, Badge, Spinner } from "@/components/ui";
import { useContactDetail } from "@/lib/hooks";
import { useActivities } from "@/lib/hooks/use-activities";
import { ActivityTimeline } from "./activity-timeline";
import { AddNoteForm } from "./add-note-form";
import { formatPhone, formatAddress, getDisplayName } from "@/lib/utils";
import { BUSINESS_TYPE_COLORS, VISIT_STATUS_COLORS, type VisitStatus } from "@/types";

const BUSINESS_TYPES = Object.keys(BUSINESS_TYPE_COLORS);

interface ContactDetailProps {
  contactId: string | null;
  onClose: () => void;
}

export const ContactDetail = memo(function ContactDetail({ contactId, onClose }: ContactDetailProps) {
  const { contact, loading, refetch } = useContactDetail(contactId);
  const { activities, loading: activitiesLoading, addActivity } = useActivities(contactId);
  const [addingNote, setAddingNote] = useState(false);
  const [editingTypes, setEditingTypes] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [savingTypes, setSavingTypes] = useState(false);
  const [loggingVisit, setLoggingVisit] = useState(false);
  const [editingVisitStatus, setEditingVisitStatus] = useState(false);
  const [savingVisitStatus, setSavingVisitStatus] = useState(false);

  const startEditTypes = () => {
    setSelectedTypes(contact?.business_type ?? []);
    setEditingTypes(true);
  };

  const toggleType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const saveTypes = async () => {
    if (!contactId) return;
    setSavingTypes(true);
    try {
      await fetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ business_type: selectedTypes }),
      });
      setEditingTypes(false);
      refetch();
    } catch (e) {
      console.error(e);
    } finally {
      setSavingTypes(false);
    }
  };

  const logVisit = async () => {
    if (!contactId) return;
    setLoggingVisit(true);
    try {
      await addActivity({ activity_type: "visit", title: "Visit logged" });
      refetch();
    } catch (e) {
      console.error(e);
    } finally {
      setLoggingVisit(false);
    }
  };

  const updateVisitStatus = async (status: VisitStatus) => {
    if (!contactId) return;
    setSavingVisitStatus(true);
    try {
      await fetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visit_status: status }),
      });
      setEditingVisitStatus(false);
      refetch();
    } catch (e) {
      console.error(e);
    } finally {
      setSavingVisitStatus(false);
    }
  };

  if (!contactId) return null;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-gray-400">
        <AlertCircle className="h-8 w-8" />
        <p className="text-sm">Contact not found</p>
      </div>
    );
  }

  const displayName = getDisplayName(contact);
  const address = formatAddress(
    contact.mailing_street,
    contact.mailing_city,
    contact.mailing_state,
    contact.mailing_zip
  );
  const phone = formatPhone(contact.phone) || formatPhone(contact.mobile);
  const rawPhone = contact.phone || contact.mobile;
  const navigateUrl = address
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`
    : null;
  const zohoUrl = `https://bigin.zoho.com/crm/${process.env.NEXT_PUBLIC_ZOHO_ORG_ID || '896749555'}/tab/Contacts/${contact.zoho_id}`;

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-gray-100 px-4 py-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-semibold text-gray-900">
            {displayName}
          </h3>
          {contact.account_name && contact.account_name !== contact.last_name && (
            <p className="text-sm text-gray-500">{contact.last_name}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="ml-2 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4 px-4 py-4">
        {/* Business Type Badges */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex flex-wrap gap-1.5">
              {!editingTypes && contact.business_type.map((type) => (
                <BusinessTypeBadge key={type} type={type} />
              ))}
            </div>
            {!editingTypes ? (
              <button
                onClick={startEditTypes}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                onClick={saveTypes}
                disabled={savingTypes}
                className="flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium text-green-600 hover:bg-green-50"
              >
                {savingTypes ? <Spinner /> : <Check className="h-3.5 w-3.5" />}
                Save
              </button>
            )}
          </div>
          {editingTypes && (
            <div className="flex flex-wrap gap-2 rounded-lg border border-gray-200 p-2">
              {BUSINESS_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => toggleType(type)}
                  className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                    selectedTypes.includes(type)
                      ? "text-white border-transparent"
                      : "text-gray-500 border-gray-200 bg-white hover:bg-gray-50"
                  }`}
                  style={
                    selectedTypes.includes(type)
                      ? { backgroundColor: BUSINESS_TYPE_COLORS[type] }
                      : undefined
                  }
                >
                  {type}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Status Badges */}
        <div className="flex flex-wrap gap-1.5">
          {contact.priority && (
            <Badge className="bg-amber-50 text-amber-700 border border-amber-200">
              {contact.priority}
            </Badge>
          )}
          {contact.lifecycle_stage && (
            <Badge className="bg-gray-100 text-gray-600">
              {contact.lifecycle_stage}
            </Badge>
          )}
          {contact.contacting_status && (
            <Badge className="bg-blue-50 text-blue-600 border border-blue-200">
              {contact.contacting_status}
            </Badge>
          )}
        </div>

        {/* Visit Status */}
        <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{
                  backgroundColor:
                    VISIT_STATUS_COLORS[
                      (contact.visit_status ?? "Never Visited") as VisitStatus
                    ],
                }}
              />
              <span className="text-sm font-medium text-gray-800">
                {contact.visit_status ?? "Never Visited"}
              </span>
              {contact.last_visit_date && (
                <span className="text-xs text-gray-400">
                  · {new Date(contact.last_visit_date).toLocaleDateString()}
                </span>
              )}
            </div>
            <button
              onClick={() => setEditingVisitStatus((v) => !v)}
              className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
          {editingVisitStatus && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(Object.keys(VISIT_STATUS_COLORS) as VisitStatus[]).map((s) => (
                <button
                  key={s}
                  disabled={savingVisitStatus}
                  onClick={() => updateVisitStatus(s)}
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                    contact.visit_status === s
                      ? "text-white border-transparent"
                      : "text-gray-600 border-gray-200 bg-white hover:bg-gray-100"
                  }`}
                  style={
                    contact.visit_status === s
                      ? { backgroundColor: VISIT_STATUS_COLORS[s] }
                      : undefined
                  }
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Address */}
        {address && (
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
            <span className="text-gray-700">{address}</span>
          </div>
        )}

        {/* Contact info */}
        <div className="space-y-2">
          {phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-gray-400" />
              <a
                href={`tel:${rawPhone}`}
                className="text-blue-600 hover:underline"
              >
                {phone}
              </a>
            </div>
          )}
          {contact.email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-gray-400" />
              <a
                href={`mailto:${contact.email}`}
                className="truncate text-blue-600 hover:underline"
              >
                {contact.email}
              </a>
            </div>
          )}
          {contact.website && (() => {
            // Only render links for http/https URLs — reject javascript:, file:, data: etc.
            const safeUrl = /^https?:\/\//i.test(contact.website)
              ? contact.website
              : /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/i.test(contact.website)
                ? `https://${contact.website}`
                : null;
            return safeUrl ? (
              <div className="flex items-center gap-2 text-sm">
                <Globe className="h-4 w-4 text-gray-400" />
                <a
                  href={safeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-blue-600 hover:underline"
                >
                  {contact.website}
                </a>
              </div>
            ) : null;
          })()}
        </div>

        {/* Notes */}
        {contact.contacting_tips && (
          <div>
            <h4 className="mb-1 text-xs font-semibold text-gray-500 uppercase">
              Contacting Tips
            </h4>
            <p className="text-sm text-gray-700 whitespace-pre-line">
              {contact.contacting_tips}
            </p>
          </div>
        )}
        {contact.prospecting_notes && (
          <div>
            <h4 className="mb-1 text-xs font-semibold text-gray-500 uppercase">
              Prospecting Notes
            </h4>
            <p className="text-sm text-gray-700 whitespace-pre-line">
              {contact.prospecting_notes}
            </p>
          </div>
        )}

        {/* Activity timeline */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs font-semibold text-gray-500 uppercase">Activity</h4>
            <button
              onClick={() => setAddingNote((v) => !v)}
              className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium text-blue-600 hover:bg-blue-50"
            >
              <Plus className="h-3 w-3" />
              Add note
            </button>
          </div>
          {addingNote && (
            <div className="mb-3">
              <AddNoteForm
                onSubmit={addActivity}
                onCancel={() => setAddingNote(false)}
              />
            </div>
          )}
          <ActivityTimeline activities={activities} loading={activitiesLoading} />
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-2 pt-2">
          <div className="flex gap-2">
            {navigateUrl && (
              <a href={navigateUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
                <Button className="w-full" size="lg">
                  <Navigation className="h-4 w-4" />
                  Navigate
                </Button>
              </a>
            )}
            <Button
              onClick={logVisit}
              disabled={loggingVisit}
              size="lg"
              variant="secondary"
              className="shrink-0 gap-1.5 bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
            >
              {loggingVisit ? (
                <Spinner />
              ) : (
                <Footprints className="h-4 w-4" />
              )}
              {navigateUrl ? "" : "Log Visit"}
            </Button>
          </div>
          <div className="flex gap-2">
            <a
              href={zohoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1"
            >
              <Button variant="secondary" className="w-full">
                <ExternalLink className="h-4 w-4" />
                Open in CRM
              </Button>
            </a>
            {rawPhone && (
              <a href={`tel:${rawPhone}`} className="flex-1">
                <Button variant="secondary" className="w-full">
                  <Phone className="h-4 w-4" />
                  Call
                </Button>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
