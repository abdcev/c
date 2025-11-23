import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function fetchText(url, allowRedirects = true) {
  const res = await fetch(url, {
    redirect: allowRedirects ? "follow" : "manual",
    headers: {
      "User-Agent": UA,
      "Accept-Language": "en-US,en;q=0.9"
    }
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }

  return await res.text();
}

// -------------------------------------------------------------
// 1) Kanal ID’den canlı video ID çıkar
// -------------------------------------------------------------
async function resolveLiveVideoId(channelId) {
  const liveUrl = `https://www.youtube.com/channel/${channelId}/live`;

  const res1 = await fetch(liveUrl, {
    redirect: "manual",
    headers: { "User-Agent": UA }
  });

  // Redirect → canlı video linki
  const loc = res1.headers.get("location");
  if (loc && loc.includes("watch?v=")) {
    const m = loc.match(/v=([^&]+)/);
    if (m) return m[1];
  }

  // Redirect yoksa sayfadan videoId ara
  const html = await res1.text();
  const m2 = html.match(/"videoId":"([A-Za-z0-9_-]{11})"/);
  if (m2) return m2[1];

  throw new Error("No live video found");
}

// -------------------------------------------------------------
// 2) ytInitialPlayerResponse JSON’unu güçlü şekilde çıkar
// -------------------------------------------------------------
function extractPlayerJson(html) {
  const patterns = [
    /ytInitialPlayerResponse\s*=\s*({.+?});/s,
    /var\s+ytInitialPlayerResponse\s*=\s*({.+?});/s,
    /"ytInitialPlayerResponse":\s*({.+?})\s*,\s*"responseContext"/s
  ];

  for (const p of patterns) {
    const m = html.match(p);
    if (m) {
      try {
        return JSON.parse(m[1]);
      } catch (e) {
        continue;
      }
    }
  }
  return null;
}

// -------------------------------------------------------------
// 3) Video ID → HLS manifest getir
// -------------------------------------------------------------
async function getM3u8FromVideo(videoId) {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}&hl=en&bpctr=9999999999`;

  const html = await fetchText(watchUrl);

  const data = extractPlayerJson(html);

  if (!data || !data.streamingData || !data.streamingData.hlsManifestUrl) {
    throw new Error("hlsManifestUrl not found");
  }

  let hls = data.streamingData.hlsManifestUrl;

  // escape edilmişse düzelt
  try {
    hls = JSON.parse(`"${hls}"`);
  } catch {}

  const manifest = await fetchText(hls);
  return manifest;
}

// -------------------------------------------------------------
// 4) API: /yt.php
// -------------------------------------------------------------
app.get("/yt.php", async (req, res) => {
  try {
    let videoId = req.query.v;
    const channelId = req.query.c;

    if (!videoId && !channelId) {
      return res.status(400).send("Missing v= or c=");
    }

    if (!videoId && channelId) {
      videoId = await resolveLiveVideoId(channelId);
    }

    const m3u8 = await getM3u8FromVideo(videoId);

    res
      .status(200)
      .type("application/vnd.apple.mpegurl; charset=utf-8")
      .send(m3u8);
  } catch (e) {
    console.log("[ERROR]", e.message);
    res.status(404).type("text/plain").send("No live stream found.");
  }
});

app.get("/", (req, res) => {
  res.send("YouTube worker OK");
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
