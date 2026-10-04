const express = require("express");
const { chromium } = require("playwright");
const crypto = require("crypto");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json({ limit: "64kb" }));
app.use(express.static(__dirname, { extensions: ["html"] }));

let browserPromise = null;

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu"
      ]
    }).catch(err => {
      browserPromise = null;
      throw err;
    });
  }
  return browserPromise;
}

function normalizeUrl(raw) {
  if (typeof raw !== "string" || !raw.trim()) throw new Error("URL is required.");
  let value = raw.trim();
  if (!/^https?:\/\//i.test(value)) value = "https://" + value;
  const u = new URL(value);
  if (!["http:", "https:"].includes(u.protocol)) throw new Error("Only HTTP(S) URLs are supported.");
  return u.href;
}

function classify(url, contentType = "") {
  const p = url.toLowerCase().split("?")[0];
  const ct = contentType.toLowerCase();

  if (
    p.endsWith(".m3u8") ||
    p.includes(".m3u8/") ||
    ct.includes("application/vnd.apple.mpegurl") ||
    ct.includes("application/x-mpegurl") ||
    ct.includes("audio/mpegurl") ||
    ct.includes("mpegurl")
  ) return "HLS";

  if (
    p.endsWith(".mpd") ||
    p.includes(".mpd/") ||
    ct.includes("application/dash+xml") ||
    ct.includes("dash+xml")
  ) return "DASH";

  return null;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "stream-detector", timestamp: new Date().toISOString() });
});

app.post("/api/scan", async (req, res) => {
  let target;
  try {
    target = normalizeUrl(req.body?.url);
  } catch (e) {
    return res.status(400).json({ ok: false, error: e.message });
  }

  let context = null;

  try {
    const browser = await getBrowser();

    context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      serviceWorkers: "block",
      ignoreHTTPSErrors: true
    });

    const page = await context.newPage();
    const seen = new Map();

    const capture = response => {
      try {
        const url = response.url();
        const headers = response.headers();
        const type = classify(url, headers["content-type"] || "");
        if (!type) return;

        const key = `${type}|${url}`;
        if (seen.has(key)) return;

        seen.set(key, {
          id: crypto.createHash("sha1").update(key).digest("hex").slice(0, 12),
          type,
          url,
          status: response.status(),
          contentType: headers["content-type"] || "",
          resourceType: response.request().resourceType(),
          detectedAt: new Date().toISOString()
        });
      } catch (_) {}
    };

    page.on("response", capture);

    await page.goto(target, {
      waitUntil: "domcontentloaded",
      timeout: 25000
    }).catch(() => {});

    // Allow client-side video players to initialize and request manifests.
    await page.waitForTimeout(8000);

    const results = [...seen.values()];

    return res.json({
      ok: true,
      target,
      count: results.length,
      results
    });
  } catch (e) {
    console.error("SCAN_ERROR:", e);
    return res.status(500).json({
      ok: false,
      error: e?.message || "Browser scan failed"
    });
  } finally {
    if (context) await context.close().catch(() => {});
  }
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Stream Detector listening on port ${PORT}`);
});

process.on("SIGTERM", async () => {
  try {
    if (browserPromise) {
      const browser = await browserPromise.catch(() => null);
      if (browser) await browser.close();
    }
  } finally {
    process.exit(0);
  }
});
