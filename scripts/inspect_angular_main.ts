process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function main() {
  const url = "https://bosactivities.icai.org/main.5549917f45ff49a5.js";
  const res = await fetch(url);
  const text = await res.text();
  console.log(`Main JS length: ${text.length}`);
  
  // Search for API base URLs or mock test routes
  const apiMatches = [...text.matchAll(/https?:\/\/[a-zA-Z0-9\.\-\_\/]+(?:api|mock|mtp|student|download)[a-zA-Z0-9\.\-\_\/]*/gi)]
    .map(m => m[0]);
  console.log("API URL matches:", [...new Set(apiMatches)].slice(0, 30));
  
  // Search for endpoints mentioning mtp or mock
  const mtpMatches = [...text.matchAll(/["']([^"']*(?:mtp|mock)[^"']*)["']/gi)].map(m => m[1]);
  console.log("MTP/Mock string matches:", [...new Set(mtpMatches)].slice(0, 30));
}

main().catch(console.error);
