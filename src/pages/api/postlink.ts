// src/pages/api/postlink.ts
import type { APIRoute } from "astro";
import puppeteer, { Page } from "puppeteer";

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
      console.error("No Instagram link provided in the form data.");
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

    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
      const page = await browser.newPage();
      await page.goto(embedLink, { waitUntil: "networkidle2", timeout: 60000 });

      // Extract username
      const username = await page
        .$eval(".UsernameText", (el) => el.textContent?.trim())
        .catch((err) => {
          console.warn("Username not found. Defaulting to 'Instagram'.", err);
          return "Instagram";
        });

      // Extract caption
      let caption =
        (await page
          .$eval(".Caption", (el) => el.textContent)
          .catch((err) => {
            console.warn("Caption not found. Defaulting to 'No caption'.", err);
            return "No caption";
          })) || "No caption";

      if (caption) {
        const lines = caption.split("\n");
        lines.shift(); // Remove the first line if it's not needed
        caption = lines.join(" ").trim();
        caption = caption.replace(/View all.*$/i, "");
        caption = caption.replace(/\s+/g, " ").trim();
        if (caption.length > 25) {
          caption = caption.substring(0, 25).trim() + "...";
        }
      }

      async function extractAllCarouselMedia(page: Page) {
        const mediaEntries: { type: string; src: string; poster?: string }[] =
          [];
        const seenMedia = new Set<string>();

        async function extractVisibleMedia() {
          const elements = await page.$$(
            "div._aagu img, div._aand video"
          );
        
          for (const el of elements) {
            const tagName = await el.evaluate((node) => node.tagName.toLowerCase());
        
            let src: string | null = null;
            let poster: string | null = null;
        
            if (tagName === "img") {
              src = await el.evaluate((node) => node.getAttribute("src"));
              if (src && !seenMedia.has(src)) {
                mediaEntries.push({ type: "image", src });
                seenMedia.add(src);
              }
            } else if (tagName === "video") {
              // Simulate clicking the play button
              const playButton = await page.$('span[aria-label="Play"]');
              if (playButton) {
                await playButton.click();
                // Wait for the video src to be available
                await page.waitForFunction(
                  (node) => node.getAttribute("src"),
                  {},
                  el
                );
              }
        
              const attrs = await el.evaluate((node) => ({
                src: node.getAttribute("src"),
                poster: node.getAttribute("poster"),
              }));
        
              src = attrs.src;
              poster = attrs.poster;
        
              if ((src || poster) && !seenMedia.has(src || poster || "")) {
                mediaEntries.push({
                  type: "video",
                  src: src || poster || "",
                  ...(poster && { poster }),
                });
                seenMedia.add(src || poster || "");
              }
            }
          }
        }

        // Extract initial media
        await extractVisibleMedia();

        // Try to navigate through carousel by clicking Next
        let hasNext = true;
        let clickCount = 0; // To prevent infinite loops

        while (hasNext && clickCount < 10) {
          // Limit to 10 clicks max
          const nextButton = await page.$('button[aria-label="Next"]');
          if (!nextButton) {
            hasNext = false;
          } else {
            await nextButton.click();
            clickCount += 1;

            // Wait for the next slide to load by waiting for new media elements
            await page
              .waitForSelector("li._adxi img, li._adxi video", {
                timeout: 5000,
              })
              .catch(() =>
                console.warn(
                  "Timeout waiting for new media elements after clicking 'Next'."
                )
              );

            // Extract media from the newly visible slide
            await extractVisibleMedia();
          }
        }

        if (clickCount >= 10) {
          console.warn("Reached the maximum number of carousel navigations.");
        }

        return mediaEntries;
      }

      const allMedia = await extractAllCarouselMedia(page);

      if (allMedia.length === 0) {
        console.error("No media found after extracting from the carousel.");
        return new Response(JSON.stringify({ error: "No media found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Convert each media to base64 data URLs
      // For images: convert src directly
      // For videos: use the poster for display, not the video src
      const encodedMedia = [];
      for (const entry of allMedia) {
        let urlToFetch =
          entry.type === "video" && entry.poster ? entry.poster : entry.src;

        try {
          const res = await fetch(urlToFetch);
          if (!res.ok) {
            console.warn(
              `Failed to fetch media: ${urlToFetch} - ${res.statusText}`
            );
            continue;
          }
          const arrayBuffer = await res.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString("base64");
          const contentType = res.headers.get("content-type") || "image/jpeg";
          const dataUrl = `data:${contentType};base64,${base64}`;

          if (entry.type === "video") {
            const downloadUrl = `/api/downloadVideo?videoUrl=${entry.src}`;
            encodedMedia.push({
              type: entry.type,
              dataUrl,
              downloadUrl,
            });
          } else {
            // It's an image
            encodedMedia.push({
              type: entry.type,
              dataUrl,
            });
          }
        } catch (err) {
          console.warn(`Error fetching or encoding media: ${urlToFetch}`, err);
          continue;
        }
      }

      if (encodedMedia.length === 0) {
        console.error("No media could be converted to base64.");
        return new Response(
          JSON.stringify({ error: "No media could be converted" }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({
          username: username || "Instagram",
          caption: caption || "No caption",
          media: encodedMedia,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    } finally {
      await browser.close();
    }
  } catch (e) {
    console.error(
      "An unexpected error occurred:",
      e instanceof Error ? e.stack : e
    );
    return new Response(JSON.stringify({ error: "An error has occurred" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};