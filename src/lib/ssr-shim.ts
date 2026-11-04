// Shim minimal browser window/document globals for SSR in Node.js / Cloudflare / Vercel
// so that libraries like Leaflet (which touch `window.requestAnimationFrame` on module load)
// do not throw "ReferenceError: window is not defined" when server-side rendering routes.

if (typeof window === "undefined" && typeof globalThis !== "undefined") {
  const g = globalThis as unknown as Record<string, unknown>;
  g.window = g;
  g.document = {
    documentElement: { style: {} },
    getElementsByTagName: () => [],
    createElement: () => ({ style: {}, setAttribute: () => {} }),
    createElementNS: () => ({ style: {} }),
  };
  g.navigator = { userAgent: "node" };
  g.screen = {};
}
