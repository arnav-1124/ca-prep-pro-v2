async function main() {
  const queries = [
    "site:icai.org \"Mock Test Papers\" \"Foundation\" 2025",
    "site:icai.org \"Series I\" \"Series II\" Foundation \"2025\" \"Questions\" \"Answers\"",
    "site:resource.cdn.icai.org \"Mock Test Paper\" \"Foundation\" 2025",
    "site:icai.org \"BoS\" \"Mock Test\" \"Foundation\" \"Accounting\" 2025",
    "\"MTP\" \"CA Foundation\" \"May 2025\" \"Question Paper\" site:icai.org"
  ];
  
  for (const q of queries) {
    console.log(`\n=== Query: ${q} ===`);
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });
      const html = await res.text();
      const linkRegex = /<a class="result__url"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
      let m;
      let count = 0;
      while ((m = linkRegex.exec(html)) !== null) {
        let rawUrl = m[1];
        if (rawUrl.includes("uddg=")) {
          const u = new URL("https://duckduckgo.com" + rawUrl);
          rawUrl = decodeURIComponent(u.searchParams.get("uddg") || rawUrl);
        }
        const title = m[2].replace(/<[^>]+>/g, "").trim();
        console.log(`  - ${rawUrl} | ${title}`);
        count++;
        if (count >= 5) break;
      }
    } catch (e: any) {
      console.error(e.message);
    }
  }
}

main().catch(console.error);
