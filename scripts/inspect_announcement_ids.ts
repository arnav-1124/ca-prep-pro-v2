process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function main() {
  const ids = [377, 378, 411, 208];
  for (const id of ids) {
    const url = `https://boslive.icai.org/announcement_details.php?id=${id}`;
    const res = await fetch(url);
    const html = await res.text();
    console.log(`\n=== ID ${id} ===`);
    const linkMatches = [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
    for (const m of linkMatches) {
      const href = m[1];
      const text = m[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      if (href.includes(".pdf") || href.includes("resource") || text.includes("Click")) {
        console.log(`  [${text}] -> ${href}`);
      }
    }
  }
}

main().catch(console.error);
