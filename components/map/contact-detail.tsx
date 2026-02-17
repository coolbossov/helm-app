"use client";

import { useState } from "react";
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
} from "lucide-react";
import { Button, BusinessTypeBadge, Badge, Spinner } from "@/components/ui";
import { useContactDetail } from "@/lib/hooks";
import { useActivities } from "@/lib/hooks/use-activities";
import { ActivityTimeline } from "./activity-timeline";
import { AddNoteForm } from "./add-note-form";
import { formatPhone, formatAddress, getDisplayName } from "@/lib/utils";

interface ContactDetailProps {
  contactId: string | null;
  onClose: () => void;
}

export function ContactDetail({ contactId, onClose }: ContactDetailProps) {
  const { contact, loading } = useContactDetail(contactId);
  const { activities, loading: activitiesLoading, addActivity } = useActivities(contactId);
  const [addingNote, setAddingNote] = useState(false);

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
        {/* Badges */}
        <div className="flex flex-wrap gap-1.5">
          {contact.business_type.map((type) => (
            <BusinessTypeBadge key={type} type={type} />
          ))}
          {contact.priority && (
            <Badge
              className="bg-amber-50 text-amber-700 border border-amber-200"
            >
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
          {contact.website && (
            <div className="flex items-center gap-2 text-sm">
              <Globe className="h-4 w-4 text-gray-400" />
              <a
                href={
                  contact.website.startsWith("http")
                    ? contact.website
                    : `https://${contact.website}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="truncate text-blue-600 hover:underline"
              >
                {contact.website}
              </a>
            </div>
          )}
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
          {navigateUrl && (
            <a href={navigateUrl} target="_blank" rel="noopener noreferrer">
              <Button className="w-full" size="lg">
                <Navigation className="h-4 w-4" />
                Navigate
              </Button>
            </a>
          )}
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
}
