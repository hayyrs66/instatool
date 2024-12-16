import type { APIRoute } from "astro";
import { parse } from "node-html-parser";
import axios from "axios";

export const OPTIONS: APIRoute = () => {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();
    const link = formData.get("instagram_link") as string;

    if (!link) {
      return new Response(
        JSON.stringify({ error: "Instagram link is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const embedLink = link.endsWith("/")
      ? link + "embed/captioned"
      : link + "/embed/captioned";

    // Fetch the Instagram embed page
    const res = await axios.get(embedLink, {
      headers: { "User-Agent": "Mozilla/5.0" }, // Mimic a browser
    });
    const html = parse(res.data);

    // Extract the image URL
    const imgContainer = html.querySelector(".EmbeddedMediaImage");
    const imageUrl = imgContainer?.getAttribute("src");

    // Extract the username
    const username = html
      .querySelector(".CaptionUsername")
      ?.textContent?.trim();

    // Extract the caption
    let caption = html.querySelector(".Caption")?.textContent;

    if (caption) {
      const lines = caption.split("\n");
      // Remove the first line
      lines.shift();
      // Join the remaining lines back into a single string
      caption = lines.join(" ").trim();
      // Remove "View all ..." and similar patterns
      caption = caption.replace(/View all.*$/i, "");
      // Normalize whitespace
      caption = caption.replace(/\s+/g, " ").trim();

      if (caption.length > 25)caption = caption.substring(0, 25).trim() + "...";
    }

    if (!imageUrl) {
      return new Response(JSON.stringify({ error: "Image not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Fetch the image from Instagram
    const imageResponse = await axios.get(imageUrl, {
      responseType: "arraybuffer", // Handle the response as binary data
      headers: { "User-Agent": "Mozilla/5.0" }, // Add a user agent
    });

    // Base64 encode the image data
    const base64Image = Buffer.from(imageResponse.data).toString("base64");
    const contentType = imageResponse.headers["content-type"];

    return new Response(
      JSON.stringify({
        username,
        caption,
        image: `data:${contentType};base64,${base64Image}`,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    return new Response(JSON.stringify({ error: "An error has occurred" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
