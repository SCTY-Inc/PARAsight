"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import "./globals.css";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convexClient = convexUrl ? new ConvexReactClient(convexUrl) : null;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {convexClient ? (
          <ConvexProvider client={convexClient}>{children}</ConvexProvider>
        ) : (
          <div className="missing-config">
            <div className="missing-config-card">
              <h1 className="missing-config-title">Missing Convex URL</h1>
              <p className="missing-config-text">
                Set <code>NEXT_PUBLIC_CONVEX_URL</code> (usually created by{" "}
                <code>npx convex dev</code> in <code>.env.local</code>).
              </p>
              <pre className="missing-config-code">
                <code>npm run convex{"\n"}npm run dev</code>
              </pre>
            </div>
          </div>
        )}
      </body>
    </html>
  );
}
