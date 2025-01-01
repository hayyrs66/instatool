import type { APIRoute } from "astro";
import { scrapePost } from "../../lib/scrape_post";

export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();
    const instagramLink = formData.get("instagram_link");

    if (!instagramLink) {
      return new Response(
        JSON.stringify({ error: "Missing instagram_link in form data." }),
        { status: 400 }
      );
    }
    const data = await scrapePost(instagramLink.toString());
    const username = data?.owner?.username || "unknown_user";

    const caption =
      data?.edge_media_to_caption?.edges?.[0]?.node?.text || "No caption";

    let media: Array<{
      type: "image" | "video";
      dataUrl: string;
      downloadUrl: string;
    }> = [];

    if (data.__typename === "XDTGraphSidecar") {
      const sidecarEdges = data.edge_sidecar_to_children?.edges || [];
      media = sidecarEdges.map((edge) => {
        const node = edge.node;
        const isVideo = node.__typename === "XDTGraphVideo" || node.is_video;

        if (isVideo) {
          return {
            type: "video",
            dataUrl: node.thumbnail_src || node.display_url || "",
            downloadUrl: node.video_url || node.display_url || "",
          };
        } else {
          return {
            type: "image",
            dataUrl: node.display_url || "",
            downloadUrl: node.display_url || "",
          };
        }
      });
    } else {
      const isVideo = data.__typename === "XDTGraphVideo" || data.is_video;
      if (isVideo) {
        media = [
          {
            type: "video",
            dataUrl: data.thumbnail_src || data.display_url || "",
            downloadUrl: data.video_url || data.display_url || "",
          },
        ];
      } else {
        media = [
          {
            type: "image",
            dataUrl: data.display_url || "",
            downloadUrl: data.display_url || "",
          },
        ];
      }
    }

    return new Response(
      JSON.stringify({
        username,
        caption,
        media,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
};
