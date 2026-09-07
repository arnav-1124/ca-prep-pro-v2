process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function main() {
  const url = "https://boslive.icai.org/education_content.php?p=Foundation&c=foundation";
  const res = await fetch(url);
  const html = await res.text();
  console.log("HTML length:", html.length);
  // Find all links
  const matches = [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  for (const m of matches) {
    const href = m[1];
    const text = m[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    console.log(`[${text}] -> ${href}`);
  }
}

main().catch(console.error);
