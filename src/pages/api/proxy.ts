import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ request }) => {
  try {
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get("url");
    if (!targetUrl) {
      return new Response(JSON.stringify({ error: "Missing 'url' param" }), {
        status: 400,
      });
    }
    const fetchRes = await fetch(targetUrl);

    if (!fetchRes.ok) {
      return new Response(JSON.stringify({ error: "Failed to fetch image" }), {
        status: 500,
      });
    }

    const contentType = fetchRes.headers.get("content-type") || "application/octet-stream";

    // Return the raw body as a stream
    return new Response(fetchRes.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*", 
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};
