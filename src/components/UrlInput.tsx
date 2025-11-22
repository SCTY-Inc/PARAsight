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

      console.log(`Found ${urls.length} URLs to process`);

      // Process URLs in batches
      await processBatch({
        urls,
        sourceNote: sourceNote || undefined,
      });

      // Clear input after success
      setUrlText("");
      setSourceNote("");
      alert(`Successfully processed ${urls.length} URLs!`);
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
      </form>
    </div>
  );
}
