// src/pages/api/downloadVideo.ts
import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ request, url }) => {
  try {
    const videoUrl = url.searchParams.get("videoUrl");

    if (!videoUrl) {
      console.error("No videoUrl provided in query parameters.");
      return new Response(JSON.stringify({ error: "videoUrl query parameter is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Validate that videoUrl is a valid Instagram video URL
    const instagramVideoRegex = /^https:\/\/instagram\.(fna|.+?)\/o1\/v\/t16\/f2\/m69\/.*\.mp4\?.*$/i;

    if (!instagramVideoRegex.test(videoUrl)) {
      console.error(`Invalid videoUrl provided: ${videoUrl}`);
      return new Response(JSON.stringify({ error: "Invalid videoUrl" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`Downloading video from URL: ${videoUrl}`);

    const res = await fetch(videoUrl, {
      headers: {
        // Optionally, set necessary headers like User-Agent if required
      },
    });

    if (!res.ok) {
      console.error(`Failed to fetch video content: ${videoUrl} - ${res.statusText}`);
      return new Response(JSON.stringify({ error: "Failed to fetch video content" }), {
        status: res.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const contentType = res.headers.get("content-type") || "video/mp4";

    console.log(`Streaming video back to client with content-type: ${contentType}`);

    return new Response(res.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="instagram_video_${Date.now()}.mp4"`,
      },
    });
  } catch (e) {
    console.error("Error in /api/downloadVideo:", e instanceof Error ? e.stack : e);
    return new Response(JSON.stringify({ error: "An error has occurred" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
