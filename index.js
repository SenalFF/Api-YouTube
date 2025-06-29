import express from "express";
import ytdl from "ytdl-core";
import ytSearch from "yt-search";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3000;
ffmpeg.setFfmpegPath(ffmpegPath);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, "public")));

app.get("/search", async (req, res) => {
  const query = req.query.query;
  if (!query) return res.status(400).json({ error: "Missing query" });

  try {
    const result = await ytSearch(query);
    const videos = result.videos.slice(0, 5).map((video) => ({
      title: video.title,
      description: video.description,
      duration: video.timestamp,
      views: video.views,
      uploaded: video.ago,
      author: video.author.name,
      thumbnail: video.thumbnail,
      video_url: video.url,
      download_video: \`\${req.protocol}://\${req.get("host")}/download/video?url=\${encodeURIComponent(video.url)}\`,
      download_audio: \`\${req.protocol}://\${req.get("host")}/download/audio?url=\${encodeURIComponent(video.url)}\`
    }));

    res.json({ results: videos });
  } catch {
    res.status(500).json({ error: "Search failed" });
  }
});

app.get("/download/video", async (req, res) => {
  const url = req.query.url;
  if (!ytdl.validateURL(url)) return res.status(400).send("Invalid URL");

  const info = await ytdl.getInfo(url);
  const title = info.videoDetails.title.replace(/[^\w\s]/gi, "");
  res.header("Content-Disposition", \`attachment; filename="\${title}.mp4"\`);

  ytdl(url, { format: "mp4" }).pipe(res);
});

app.get("/download/audio", async (req, res) => {
  const url = req.query.url;
  if (!ytdl.validateURL(url)) return res.status(400).send("Invalid URL");

  const info = await ytdl.getInfo(url);
  const title = info.videoDetails.title.replace(/[^\w\s]/gi, "");
  res.header("Content-Disposition", \`attachment; filename="\${title}.mp3"\`);
  res.contentType("audio/mpeg");

  const stream = ytdl(url, { quality: "highestaudio" });

  ffmpeg(stream)
    .audioBitrate(128)
    .format("mp3")
    .on("error", () => res.sendStatus(500))
    .pipe(res, { end: true });
});

app.listen(PORT, () => {
  console.log(\`✅ Server running on http://localhost:\${PORT}\`);
});
