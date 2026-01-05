"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ExtractionData } from "~/server/extraction/types";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { Alert, AlertDescription } from "~/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Pencil, Trash2, Plus } from "lucide-react";

interface EditableFieldsProps {
  meetingId: string;
  extraction: ExtractionData | null | undefined;
  isReadOnly?: boolean;
  transcript?: { segments: Array<{ startTime: number; endTime: number; speaker: string; text: string }> } | null;
}

export default function EditableFields({
  meetingId,
  extraction,
  isReadOnly = false,
  transcript,
}: EditableFieldsProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState<{
    fieldType: string;
    index: number;
  } | null>(null);
  const [isAdding, setIsAdding] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editReason, setEditReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const scrollToTimestamp = (startTime: number) => {
    const segmentElement = document.querySelector(
      `[data-timestamp="${Math.floor(startTime)}"]`
    );
    if (segmentElement) {
      segmentElement.scrollIntoView({ behavior: "smooth", block: "center" });
      segmentElement.classList.add("bg-yellow-100");
      setTimeout(() => {
        segmentElement.classList.remove("bg-yellow-100");
      }, 2000);
    }
  };

  const handleEdit = async (
    fieldType: string,
    action: "update" | "add" | "remove",
    index?: number,
    item?: any
  ) => {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/meetings/${meetingId}/edit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fieldType,
          action,
          index,
          item,
          reason: editReason || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save edit");
      }

      // Refresh the page to show updated data
      router.refresh();
      setIsEditing(null);
      setIsAdding(null);
      setEditValue("");
      setEditReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  if (!extraction) {
    return (
      <Alert>
        <AlertDescription>
          Extraction is in progress or not available yet.
        </AlertDescription>
      </Alert>
    );
  }

  const renderEditableList = (
    fieldType: "topics" | "recommendations" | "disclosures" | "decisions" | "followUps",
    items: any[],
    label: string,
    borderColor: string
  ) => {
    if (isReadOnly) {
      // Read-only view
      if (items.length === 0) return null;
      return (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            {label} ({items.length})
          </h3>
          <ul className="space-y-3">
            {items.map((item, idx) => (
              <li key={idx} className={`border-l-2 ${borderColor} pl-3`}>
                <div className="flex items-start justify-between">
                  <p className="text-sm text-gray-900 flex-1">{item.text}</p>
                  {item.startTime !== undefined && (
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => scrollToTimestamp(item.startTime)}
                      className="ml-2 h-auto p-0 text-xs"
                    >
                      {formatTime(item.startTime)}
                    </Button>
                  )}
                </div>
                {item.confidence !== undefined && (
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      Confidence: {(item.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      );
    }

    // Editable view
    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-700">
            {label} ({items.length})
          </h3>
          {!isReadOnly && (
            <Dialog open={isAdding === fieldType} onOpenChange={(open) => setIsAdding(open ? fieldType : null)}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add {label.slice(0, -1)}</DialogTitle>
                  <DialogDescription>
                    Add a new item to {label.toLowerCase()}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label htmlFor="add-text">Text</Label>
                    <Textarea
                      id="add-text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      placeholder="Enter text..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="add-timestamp">Timestamp (seconds, optional)</Label>
                    <Input
                      id="add-timestamp"
                      type="number"
                      min="0"
                      step="1"
                      value={editStartTime ?? ""}
                      onChange={(e) => setEditStartTime(e.target.value ? parseFloat(e.target.value) : undefined)}
                      placeholder="e.g., 120 for 2:00"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Enter the timestamp in seconds, or click a timestamp in the transcript to link this item
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="add-reason">Reason (optional)</Label>
                    <Input
                      id="add-reason"
                      value={editReason}
                      onChange={(e) => setEditReason(e.target.value)}
                      placeholder="Why are you adding this?"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsAdding(null);
                      setEditValue("");
                      setEditReason("");
                      setEditStartTime(undefined);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      if (editValue.trim()) {
                        const startTime = editStartTime ?? 0;
                        const endTime = startTime + 10; // Default 10 second duration
                        handleEdit(fieldType, "add", undefined, {
                          text: editValue.trim(),
                          startTime,
                          endTime,
                          snippet: editValue.trim(),
                        });
                      }
                    }}
                    disabled={!editValue.trim() || isSaving}
                  >
                    Add
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
        <ul className="space-y-3">
          {items.map((item, idx) => (
            <li key={idx} className={`border-l-2 ${borderColor} pl-3`}>
              {isEditing?.fieldType === fieldType && isEditing.index === idx ? (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="edit-text" className="text-xs">Text</Label>
                    <Textarea
                      id="edit-text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      placeholder="Enter text..."
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-timestamp" className="text-xs">Timestamp (seconds)</Label>
                    <Input
                      id="edit-timestamp"
                      type="number"
                      min="0"
                      step="1"
                      value={editStartTime ?? item.startTime ?? ""}
                      onChange={(e) => setEditStartTime(e.target.value ? parseFloat(e.target.value) : undefined)}
                      placeholder="e.g., 120 for 2:00"
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Click a timestamp in the transcript to link this item
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        if (editValue.trim()) {
                          const startTime = editStartTime ?? item.startTime ?? 0;
                          const endTime = item.endTime ?? startTime + 10;
                          handleEdit(fieldType, "update", idx, {
                            ...item,
                            text: editValue.trim(),
                            startTime,
                            endTime,
                          });
                        }
                      }}
                      disabled={!editValue.trim() || isSaving}
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setIsEditing(null);
                        setEditValue("");
                        setEditReason("");
                        setEditStartTime(undefined);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between">
                  <p className="text-sm text-gray-900 flex-1">{item.text}</p>
                  <div className="flex items-center gap-2 ml-2">
                    {item.startTime !== undefined && (
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => scrollToTimestamp(item.startTime)}
                        className="h-auto p-0 text-xs"
                      >
                        {formatTime(item.startTime)}
                      </Button>
                    )}
                    {!isReadOnly && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setIsEditing({ fieldType, index: idx });
                            setEditValue(item.text);
                            setEditReason("");
                            setEditStartTime(item.startTime);
                          }}
                          className="h-8 w-8 p-0"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm("Are you sure you want to remove this item?")) {
                              handleEdit(fieldType, "remove", idx);
                            }
                          }}
                          className="h-8 w-8 p-0 text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}
              {item.confidence !== undefined && (
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-xs text-gray-500">
                    Confidence: {(item.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-h-[600px] overflow-y-auto">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Topics */}
      {extraction.topics && extraction.topics.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Topics</h3>
          <ul className="space-y-1">
            {extraction.topics.map((topic, idx) => (
              <li key={idx} className="text-sm text-gray-600">
                • {topic}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendations */}
      {renderEditableList(
        "recommendations",
        extraction.recommendations || [],
        "Recommendations",
        "border-green-500"
      )}

      {/* Disclosures */}
      {renderEditableList(
        "disclosures",
        extraction.disclosures || [],
        "Disclosures",
        "border-orange-500"
      )}

      {/* Decisions */}
      {renderEditableList(
        "decisions",
        extraction.decisions || [],
        "Decisions",
        "border-purple-500"
      )}

      {/* Follow-ups */}
      {renderEditableList(
        "followUps",
        extraction.followUps || [],
        "Follow-ups",
        "border-blue-500"
      )}

      {(!extraction.topics || extraction.topics.length === 0) &&
        (!extraction.recommendations || extraction.recommendations.length === 0) &&
        (!extraction.disclosures || extraction.disclosures.length === 0) &&
        (!extraction.decisions || extraction.decisions.length === 0) &&
        (!extraction.followUps || extraction.followUps.length === 0) && (
          <Alert>
            <AlertDescription>
              No fields were extracted from this transcript.
            </AlertDescription>
          </Alert>
        )}

      {/* Soft Gap Prompts */}
      <SoftGapPrompts extraction={extraction} />
    </div>
  );
}

function SoftGapPrompts({ extraction }: { extraction: ExtractionData | null | undefined }) {
  const [dismissedPrompts, setDismissedPrompts] = useState<Set<string>>(new Set());

  if (!extraction) return null;

  const recommendations = extraction.recommendations || [];
  const disclosures = extraction.disclosures || [];
  const hasRecommendations = recommendations.length > 0;
  const hasDisclosures = disclosures.length > 0;
  const needsPrompt = hasRecommendations && !hasDisclosures;

  if (!needsPrompt || dismissedPrompts.has("no-disclosures")) {
    return null;
  }

  return (
    <Alert variant="default" className="mt-4">
      <div className="flex items-start justify-between w-full">
        <div className="flex-1">
          <h4 className="text-sm font-semibold mb-1">Soft Gap Prompt</h4>
          <AlertDescription>
            {recommendations.length} recommendation{recommendations.length > 1 ? "s" : ""} detected, but no risk disclosure{recommendations.length > 1 ? "s" : ""} found.
            Please confirm if risk was discussed or add disclosure if needed.
          </AlertDescription>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDismissedPrompts(new Set([...dismissedPrompts, "no-disclosures"]))}
          className="ml-2 h-auto p-1"
        >
          ×
        </Button>
      </div>
    </Alert>
  );
}

