const INSTAGRAM_DOCUMENT_ID = "8845758582119845";

export async function scrapePost(urlOrShortcode: string){
  let shortcode: string = "";

  if(urlOrShortcode.includes("http") || urlOrShortcode.includes("/p/"))
    shortcode = urlOrShortcode.split("/p/")[1].split("/")[0];
  else 
    shortcode = urlOrShortcode;

  console.log(`scraping from ${urlOrShortcode}`)

  const variables = {
    shortcode: shortcode,
    fetch_tagged_user_count: null,
    hoisted_comment_id: null,
    hoisted_reply_id: null
  };

  const jsonVariables = JSON.stringify(variables);
  const encodedVariables = encodeURIComponent(jsonVariables);

  const requestBody = `variables=${encodedVariables}&doc_id=${INSTAGRAM_DOCUMENT_ID}`;

  const response = await fetch("https://www.instagram.com/graphql/query/", {
    method: "POST",
    headers:{
       "Content-Type": "application/x-www-form-urlencoded"
    },
    body: requestBody
  });
  
  const jsonData = await response.json();
  const postData = jsonData?.data?.xdt_shortcode_media;

  return postData;
}