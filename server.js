// server.js
const express = require("express");
const fetch = require("node-fetch");

const app = express();
const PORT = process.env.PORT || 3000;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      "Accept-Language": "en-US,en;q=0.9"
    },
    redirect: "follow"
  });

  if (!res.ok) throw new Error("HTTP " + res.status + " while fetching " + url);
  return res.text();
}

function extractHlsManifestUrl(html) {
  const m = html.match(/"hlsManifestUrl":"(.*?)"/s);
  if (!m) return null;

  return m[1]
    .replace(/\\u0026/g, "&")
    .replace(/\\\//g, "/")
    .replace(/\\\\/g, "\\")
    .replace(/\\u003d/gi, "=");
}

// Kanal / live sayfasından m3u8 bulma
async function getM3u8FromYoutube({ videoId, channelId }) {
  let pageUrl;

  if (videoId) {
    pageUrl = `https://www.youtube.com/watch?v=${videoId}&hl=en`;
  } else {
    pageUrl = `https://www.youtube.com/channel/${channelId}/live?hl=en`;
  }

  console.log("[yt] fetching:", pageUrl);

  let html = await fetchText(pageUrl);

  // 1) hlsManifestUrl var mı?
  let manifestUrl = extractHlsManifestUrl(html);

  // 2) Yoksa canonical watch sayfasını bul
  if (!manifestUrl && channelId) {
    const canonicalRe = new RegExp(
      `"canonicalUrl":"https:\\\\/\\\\/www\\.youtube\\.com\\\\/watch\\?v=([^"]+)"`,
      "s"
    );

    const m2 = html.match(canonicalRe);
    if (m2 && m2[1]) {
      const realVid = m2[1].replace(/\\u0026.*/, "");
      const watchUrl = `https://www.youtube.com/watch?v=${realVid}&hl=en`;
      console.log("[yt] retry watch:", watchUrl);

      html = await fetchText(watchUrl);
      manifestUrl = extractHlsManifestUrl(html);
    }
  }

  if (!manifestUrl) throw new Error("NoLiveStream");

  console.log("[yt] manifest:", manifestUrl);

  const m3u8 = await fetch(manifestUrl, {
    headers: {
      "User-Agent": UA,
      Accept: "application/vnd.apple.mpegurl,application/x-mpegURL,*/*"
    }
  });

  if (!m3u8.ok) throw new Error("ManifestHTTP " + m3u8.status);

  return m3u8.text();
}

app.get("/", (req, res) => {
  res.type("text/plain").send("yt-hls-worker OK");
});

app.get("/yt.php", async (req, res) => {
  const videoId = req.query.v;
  const channelId = req.query.c;

  if (!videoId && !channelId)
    return res.status(400).send("Missing v or c parameter");

  try {
    const manifest = await getM3u8FromYoutube({ videoId, channelId });
    res.status(200).type("application/vnd.apple.mpegurl").send(manifest);
  } catch (e) {
    console.error("[ERROR]", e.message);
    if (e.message === "NoLiveStream") {
      return res.status(404).send("No live stream found.");
    }
    return res.status(500).send("Error: " + e.message);
  }
});

app.listen(PORT, () => console.log("Server running on", PORT));
