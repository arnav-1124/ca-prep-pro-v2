process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function main() {
  const res = await fetch("https://bos.icai.org/");
  const html = await res.text();
  const linkMatches = [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  console.log(`Found ${linkMatches.length} links on bos.icai.org:`);
  for (const m of linkMatches) {
    const href = m[1];
    const text = m[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    console.log(`  [${text}] -> ${href}`);
  }
}

main().catch(console.error);
