async function main() {
  const url = "https://www.icai.org/category/foundation-course";
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
  });
  
  console.log(`Status: ${res.status}`);
  if (res.ok) {
    const html = await res.text();
    console.log(`Length: ${html.length}`);
    const regex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    const links: { href: string; text: string }[] = [];
    while ((m = regex.exec(html)) !== null) {
      const href = m[1];
      const text = m[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      if (text.toLowerCase().includes("mock") || text.toLowerCase().includes("mtp") || text.toLowerCase().includes("question") || href.includes("post/")) {
        links.push({ href, text });
      }
    }
    console.log(`Found ${links.length} matching links:`);
    for (const l of links) {
      console.log(`  [${l.text}] -> ${l.href}`);
    }
  }
}

main().catch(console.error);
