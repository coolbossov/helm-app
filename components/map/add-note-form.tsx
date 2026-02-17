"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import type { ActivityType, CreateActivityInput } from "@/types";

interface AddNoteFormProps {
  onSubmit: (input: CreateActivityInput) => Promise<boolean>;
  onCancel: () => void;
}

const TYPES: { value: ActivityType; label: string }[] = [
  { value: "note", label: "Note" },
  { value: "call", label: "Call" },
  { value: "visit", label: "Visit" },
];

export function AddNoteForm({ onSubmit, onCancel }: AddNoteFormProps) {
  const [type, setType] = useState<ActivityType>("note");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!content.trim()) return;
    setSubmitting(true);
    const ok = await onSubmit({ activity_type: type, title: content.slice(0, 100), content });
    setSubmitting(false);
    if (ok) {
      setContent("");
      onCancel();
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="flex gap-1.5">
        {TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => setType(t.value)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              type === t.value
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Add a note…"
        rows={3}
        className="w-full resize-none rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={submitting || !content.trim()}
          className="flex-1"
        >
          {submitting ? "Saving…" : "Save"}
        </Button>
        <Button size="sm" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
