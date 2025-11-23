// server.js
// Simple YouTube HLS worker compatible with main.py
//   GET /yt.php?v=VIDEO_ID   -> returns HLS (.m3u8) of that video (live)
//   GET /yt.php?c=CHANNEL_ID -> returns HLS of channel live stream (if any)

const express = require("express");
const app = express();

const PORT = process.env.PORT || 3000;

// Sabit User-Agent (masaüstü Chrome)
const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": DEFAULT_UA,
      "Accept-Language": "en-US,en;q=0.9"
    }
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} while fetching ${url}`);
  }

  return await res.text();
}

/**
 * YouTube HTML içinden hlsManifestUrl çek
 * (ytInitialPlayerResponse içindeki alan)
 */
function extractHlsUrlFromHtml(html) {
  // "hlsManifestUrl":"...m3u8..."
  const match = html.match(/"hlsManifestUrl":"(.*?)"/);
  if (!match) return null;

  // JSON kaçışlarını çözmek için:
  const raw = match[1];
  let decoded;
  try {
    decoded = JSON.parse(`"${raw}"`); // \u0026 vs çözülür
  } catch {
    decoded = raw.replace(/\\u0026/g, "&");
  }
  return decoded;
}

/**
 * Verilen video ya da kanal URL'sinden m3u8 manifestini al
 */
async function getM3u8FromYoutubePage(pageUrl) {
  const html = await fetchText(pageUrl);

  const hlsUrl = extractHlsUrlFromHtml(html);
  if (!hlsUrl) {
    throw new Error("hlsManifestUrl not found (no live? or page changed)");
  }

  const manifest = await fetchText(hlsUrl);
  return manifest;
}

// Ana endpoint: /yt.php
app.get("/yt.php", async (req, res) => {
  const videoId = req.query.v;
  const channelId = req.query.c;

  if (!videoId && !channelId) {
    return res.status(400).type("text/plain").send("Missing v or c parameter");
  }

  let pageUrl;

  if (videoId) {
    // Belirli video
    pageUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
  } else {
    // Kanal canlı yayını
    // Klasik kanal ID: UCxxxx...
    // /live sayfası canlı yayına redirect ediyor veya live sayfasını veriyor
    pageUrl = `https://www.youtube.com/channel/${encodeURIComponent(
      channelId
    )}/live`;
  }

  console.log(`[yt.php] Fetching page: ${pageUrl}`);

  try {
    const manifest = await getM3u8FromYoutubePage(pageUrl);

    // main.py m3u8 içeriğini direkt bekliyor
    res
      .status(200)
      .type("application/vnd.apple.mpegurl; charset=utf-8")
      .send(manifest);
  } catch (err) {
    console.error("[yt.php] Error:", err.message);

    // Eğer canlı yoksa 404 dönelim
    res
      .status(404)
      .type("text/plain; charset=utf-8")
      .send("No live HLS manifest found or YouTube page changed.");
  }
});

// Basit sağlılık testi
app.get("/", (req, res) => {
  res.type("text/plain").send("YouTube HLS worker is running. Use /yt.php?v=... or /yt.php?c=...");
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
