// render.js
const express = require("express");
const axios = require("axios");

const app = express();

app.get("/", (req, res) => {
  res.send("YouTube HLS Worker is running");
});

/*
  /yt.php?c=CHANNEL_ID
  /yt.php?v=VIDEO_ID
*/
app.get("/yt.php", async (req, res) => {
  try {
    const videoId = req.query.v;
    const channelId = req.query.c;

    if (!videoId && !channelId) {
      return res.status(400).send("Missing parameters");
    }

    // YouTube URL oluştur
    let url = "";
    if (videoId) {
      url = `https://www.youtube.com/watch?v=${videoId}`;
    } else {
      url = `https://www.youtube.com/channel/${channelId}/live`;
    }

    console.log("Fetching:", url);

    // HTML indir
    const html = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Accept-Language": "en-US,en;q=0.9"
      }
    });

    // HLS manifest URL ayıklama
    const hlsRegex = /"hlsManifestUrl":"(https:[^"]+?\.m3u8[^"]*)"/;
    const match = html.data.match(hlsRegex);

    if (!match) {
      console.log("No live stream found.");
      return res.status(404).send("NoLiveStream");
    }

    const manifestUrl = match[1].replace(/\\u0026/g, "&");
    console.log("Manifest URL:", manifestUrl);

    // m3u8 indir
    const m3u8 = await axios.get(manifestUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    // m3u8 döndür
    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    return res.send(m3u8.data);

  } catch (err) {
    console.error("ERROR:", err.message);
    return res.status(500).send("ServerError");
  }
});

// Render için port
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
