async function main() {
  const queries = [
    "\"Mock Test Paper\" \"Foundation\" \"May 2025\" filetype:pdf",
    "\"Mock Test Paper\" \"Foundation\" \"September 2025\" filetype:pdf",
    "\"Mock Test Paper\" \"Foundation\" \"January 2025\" filetype:pdf",
    "\"Mock Test Paper\" \"Foundation\" \"Quantitative Aptitude\" \"Series\" 2025",
    "\"Mock Test Paper\" \"Foundation\" \"Business Economics\" \"Series\" 2025"
  ];

  for (const q of queries) {
    console.log(`\n=== Search: ${q} ===`);
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
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
      const snippet = m[2].replace(/<[^>]+>/g, "").trim();
      console.log(`  - ${rawUrl} | ${snippet}`);
      count++;
      if (count >= 5) break;
    }
  }
}

main().catch(console.error);
