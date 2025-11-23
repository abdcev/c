// server.js
// Render üzerinde çalışan basit YouTube HLS worker
// ?v=VIDEO_ID  → ilgili videonun HLS (.m3u8) manifesti
// ?c=CHANNEL_ID → kanaldaki canlı yayının HLS manifesti

const express = require("express");
const fetch = require("node-fetch");

const app = express();
const PORT = process.env.PORT || 3000;

// YouTube'a normal bir tarayıcı gibi görünelim
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

  if (!res.ok) {
    throw new Error("HTTP " + res.status + " while fetching " + url);
  }
  return res.text();
}

// HTML içinden hlsManifestUrl çek
function extractHlsManifestUrl(html) {
  // JSON içindeki "hlsManifestUrl":"...." kısmını ara
  const re = /"hlsManifestUrl":"(.*?)"/s;
  const m = html.match(re);
  if (!m) return null;

  let url = m[1];
  // JSON kaçışlarını düzelt
  url = url
    .replace(/\\u0026/g, "&")
    .replace(/\\\//g, "/")
    .replace(/\\\\/g, "\\")
    .replace(/\\u003d/gi, "=");

  return url;
}

// Kanal / video sayfasından m3u8 içeriğini al
async function getM3u8FromYoutube({ videoId, channelId }) {
  let pageUrl;

  if (videoId) {
    pageUrl =
      "https://www.youtube.com/watch?v=" +
      encodeURIComponent(videoId) +
      "&hl=en";
  } else if (channelId) {
    pageUrl =
      "https://www.youtube.com/channel/" +
      encodeURIComponent(channelId) +
      "/live?hl=en";
  } else {
    throw new Error("NoId");
  }

  console.log("[yt] fetching page:", pageUrl);
  let html = await fetchText(pageUrl);

  let manifestUrl = extractHlsManifestUrl(html);

  // /channel/.../live sayfasında bulamazsak, canonical watch linkini deneyelim
  if (!manifestUrl && channelId) {
    const watchMatch = html.match(
      /"canonicalUrl":"https:\\/\\/www\.youtube\.com\\/watch\?v=([^"]+)"/
    );
    if (watchMatch) {
      const realVideoId = watchMatch[1].replace(/\\u0026.*/, "");
      const watchUrl =
        "https://www.youtube.com/watch?v=" +
        realVideoId +
        "&hl=en";
      console.log("[yt] retry with watch URL:", watchUrl);
      html = await fetchText(watchUrl);
      manifestUrl = extractHlsManifestUrl(html);
    }
  }

  if (!manifestUrl) {
    throw new Error("NoLiveStream");
  }

  console.log("[yt] manifest url:", manifestUrl);

  const res = await fetch(manifestUrl, {
    headers: {
      "User-Agent": UA,
      Accept:
        "application/x-mpegURL, application/vnd.apple.mpegurl, */*;q=0.8"
    }
  });

  if (!res.ok) {
    throw new Error("ManifestHTTP " + res.status);
  }

  return res.text();
}

// Sağlık kontrolü
app.get("/", (req, res) => {
  res.type("text/plain").send("yt-hls-worker is running");
});

// Eski PHP ile uyumlu endpoint
app.get("/yt.php", async (req, res) => {
  const videoId = req.query.v;
  const channelId = req.query.c;

  if (!videoId && !channelId) {
    res.status(400).type("text/plain").send("Missing v or c parameter");
    return;
  }

  console.log(
    `[yt.php] request: v=${videoId || "-"} c=${channelId || "-"}`
  );

  try {
    const m3u8 = await getM3u8FromYoutube({ videoId, channelId });
    res
      .status(200)
      .type("application/vnd.apple.mpegurl")
      .send(m3u8);
  } catch (err) {
    console.error("[yt.php] error:", err.message);

    if (err.message === "NoLiveStream") {
      res.status(404).type("text/plain").send("No live stream found.");
    } else if (err.message === "NoId") {
      res.status(400).type("text/plain").send("Missing id");
    } else {
      res
        .status(500)
        .type("text/plain")
        .send("Internal error: " + err.message);
    }
  }
});

// Render için server başlat
app.listen(PORT, () => {
  console.log("Server listening on port", PORT);
});
