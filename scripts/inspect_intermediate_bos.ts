async function main() {
  const url = "https://www.icai.org/post/sm-inter-p2-may2026";
  console.log("Fetching:", url);
  const res = await fetch(url);
  const html = await res.text();
  const regex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  console.log("Chapters on Paper 2 May 2026 SM page:");
  while ((m = regex.exec(html)) !== null) {
    const href = m[1];
    const text = m[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (href.includes("resource.cdn.icai.org") || (href.endsWith(".pdf") && !href.includes("amendment"))) {
      console.log(`  [${text}] -> ${href}`);
    }
  }
}

main().catch(console.error);
