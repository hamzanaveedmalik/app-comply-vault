"use client";

import type { ExtractionData } from "~/server/extraction/types";

interface ExtractedFieldsProps {
  extraction: ExtractionData | null | undefined;
}

export default function ExtractedFields({ extraction }: ExtractedFieldsProps) {
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Scroll to transcript segment when evidence link is clicked
  const scrollToTimestamp = (startTime: number) => {
    // Find the segment with matching timestamp
    const segmentElement = document.querySelector(
      `[data-timestamp="${Math.floor(startTime)}"]`
    );
    if (segmentElement) {
      segmentElement.scrollIntoView({ behavior: "smooth", block: "center" });
      // Highlight the segment temporarily
      segmentElement.classList.add("bg-yellow-100");
      setTimeout(() => {
        segmentElement.classList.remove("bg-yellow-100");
      }, 2000);
    }
  };

  if (!extraction) {
    return (
      <div className="rounded-md bg-gray-50 p-4">
        <p className="text-sm text-gray-600">
          Extraction is in progress or not available yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-h-[600px] overflow-y-auto">
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
      {extraction.recommendations && extraction.recommendations.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Recommendations ({extraction.recommendations.length})
          </h3>
          <ul className="space-y-3">
            {extraction.recommendations.map((rec, idx) => (
              <li key={idx} className="border-l-2 border-green-500 pl-3">
                <div className="flex items-start justify-between">
                  <p className="text-sm text-gray-900 flex-1">{rec.text}</p>
                  <button
                    onClick={() => scrollToTimestamp(rec.startTime)}
                    className="ml-2 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {formatTime(rec.startTime)}
                  </button>
                </div>
                {rec.confidence !== undefined && (
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      Confidence: {(rec.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Disclosures */}
      {extraction.disclosures && extraction.disclosures.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Disclosures ({extraction.disclosures.length})
          </h3>
          <ul className="space-y-3">
            {extraction.disclosures.map((dis, idx) => (
              <li key={idx} className="border-l-2 border-orange-500 pl-3">
                <div className="flex items-start justify-between">
                  <p className="text-sm text-gray-900 flex-1">{dis.text}</p>
                  <button
                    onClick={() => scrollToTimestamp(dis.startTime)}
                    className="ml-2 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {formatTime(dis.startTime)}
                  </button>
                </div>
                {dis.confidence !== undefined && (
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      Confidence: {(dis.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Decisions */}
      {extraction.decisions && extraction.decisions.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Decisions ({extraction.decisions.length})
          </h3>
          <ul className="space-y-3">
            {extraction.decisions.map((dec, idx) => (
              <li key={idx} className="border-l-2 border-purple-500 pl-3">
                <div className="flex items-start justify-between">
                  <p className="text-sm text-gray-900 flex-1">{dec.text}</p>
                  <button
                    onClick={() => scrollToTimestamp(dec.startTime)}
                    className="ml-2 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {formatTime(dec.startTime)}
                  </button>
                </div>
                {dec.confidence !== undefined && (
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      Confidence: {(dec.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Follow-ups */}
      {extraction.followUps && extraction.followUps.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Follow-ups ({extraction.followUps.length})
          </h3>
          <ul className="space-y-3">
            {extraction.followUps.map((fu, idx) => (
              <li key={idx} className="border-l-2 border-blue-500 pl-3">
                <div className="flex items-start justify-between">
                  <p className="text-sm text-gray-900 flex-1">{fu.text}</p>
                  <button
                    onClick={() => scrollToTimestamp(fu.startTime)}
                    className="ml-2 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {formatTime(fu.startTime)}
                  </button>
                </div>
                {fu.confidence !== undefined && (
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      Confidence: {(fu.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(!extraction.topics || extraction.topics.length === 0) &&
        (!extraction.recommendations || extraction.recommendations.length === 0) &&
        (!extraction.disclosures || extraction.disclosures.length === 0) &&
        (!extraction.decisions || extraction.decisions.length === 0) &&
        (!extraction.followUps || extraction.followUps.length === 0) && (
          <div className="rounded-md bg-gray-50 p-4">
            <p className="text-sm text-gray-600">
              No fields were extracted from this transcript.
            </p>
          </div>
        )}
    </div>
  );
}

