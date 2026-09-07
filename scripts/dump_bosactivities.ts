process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function main() {
  const res = await fetch("https://bosactivities.icai.org/");
  const html = await res.text();
  
  // Clean scripts & styles
  const clean = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
  const links = [...clean.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  console.log(`Found ${links.length} links:`);
  for (const l of links) {
    const text = l[2].replace(/<[^>]+>/g, "").trim();
    console.log(`  [${text}] -> ${l[1]}`);
  }
  
  const textSample = clean.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  console.log("\nText Snippet:", textSample.slice(0, 1000));
}

main().catch(console.error);
