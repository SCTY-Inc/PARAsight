import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

// POST /api/share - Accept URLs from iOS Shortcut
http.route({
  path: "/share",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();
      const { url, note } = body as { url?: string; note?: string };

      if (!url) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing 'url' in request body" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Validate URL format
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);
      } catch {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid URL format" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        return new Response(
          JSON.stringify({ success: false, error: "URL must start with http:// or https://" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      console.log(`[HTTP] Processing shared URL: ${url}`);

      // Process the URL using existing action
      const result = await ctx.runAction(internal.urlActions.processSingleUrl, {
        url,
        sourceNote: note || "Shared from iPhone",
      });

      if (result.success) {
        const message = result.extractedUrls
          ? `Saved ${result.extractedUrls.length} link(s) from tweet`
          : "Link saved successfully";

        return new Response(
          JSON.stringify({
            success: true,
            message,
            linkId: result.linkId,
            extractedUrls: result.extractedUrls,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      } else {
        return new Response(
          JSON.stringify({ success: false, error: result.error }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    } catch (error: any) {
      console.error("[HTTP] Error processing share:", error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

// GET /api/share - Simple health check / info
http.route({
  path: "/share",
  method: "GET",
  handler: httpAction(async () => {
    return new Response(
      JSON.stringify({
        service: "Parasight Share API",
        usage: "POST { url: string, note?: string }",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }),
});

export default http;
