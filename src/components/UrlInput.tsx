"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";

export function UrlInput() {
  const [urlText, setUrlText] = useState("");
  const [sourceNote, setSourceNote] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const processBatch = useAction(api.urlActions.processBatchUrls);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!urlText.trim()) return;

    setIsProcessing(true);

    try {
      // Extract URLs from text (supports space or comma separated)
      const urls = urlText
        .split(/[\s,]+/)
        .map(line => line.trim())
        .filter(line => line.startsWith('http://') || line.startsWith('https://'));

      // Deduplicate to avoid re-processing identical URLs in one paste
      const uniqueUrls = [...new Set(urls)];

      if (uniqueUrls.length === 0) {
        alert("No valid URLs found. Include full http(s) URLs.");
        return;
      }

      // Process URLs in batches
      const results = await processBatch({
        urls: uniqueUrls,
        sourceNote: sourceNote.trim() || undefined,
      });

      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.length - successCount;

      if (failureCount === 0) {
        setUrlText("");
        setSourceNote("");
        alert(`Successfully processed ${successCount} URL${successCount === 1 ? "" : "s"}!`);
      } else {
        const firstError = results.find((r) => !r.success)?.error;
        alert(
          `Processed ${successCount}/${results.length} URLs. ${failureCount} failed.` +
            (firstError ? ` First error: ${firstError}` : "")
        );
      }
    } catch (error) {
      console.error("Error processing URLs:", error);
      alert("Error processing URLs. Check console for details.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="url-input-container">
      <form onSubmit={handleSubmit} className="url-input-form">
        <div className="url-input-row">
          <input
            type="text"
            value={urlText}
            onChange={(e) => setUrlText(e.target.value)}
            placeholder="Paste URLs (space or comma separated)"
            disabled={isProcessing}
            className="url-input-inline"
          />
          <button type="submit" disabled={isProcessing || !urlText.trim()}>
            {isProcessing ? "..." : "+"}
          </button>
        </div>
        <input
          type="text"
          value={sourceNote}
          onChange={(e) => setSourceNote(e.target.value)}
          placeholder="Note (optional) e.g. AI Research, Mac Tools"
          disabled={isProcessing}
          className="url-input-note"
        />
      </form>
    </div>
  );
}
