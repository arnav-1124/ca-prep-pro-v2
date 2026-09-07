import fs from "fs";

async function fetchDDGPage(query: string, start: number): Promise<{ url: string; title: string }[]> {
  const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&s=${start}`;
  const res = await fetch(ddgUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
  });
  const html = await res.text();
  const linkRegex = /<a class="result__url"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  const results: { url: string; title: string }[] = [];
  while ((m = linkRegex.exec(html)) !== null) {
    let rawUrl = m[1];
    if (rawUrl.includes("uddg=")) {
      const u = new URL("https://duckduckgo.com" + rawUrl);
      rawUrl = decodeURIComponent(u.searchParams.get("uddg") || rawUrl);
    }
    const title = m[2].replace(/<[^>]+>/g, "").trim();
    results.push({ url: rawUrl, title });
  }
  return results;
}

async function main() {
  const seen = new Set<string>();
  const allResults: { url: string; title: string }[] = [];
  
  for (let s = 0; s < 100; s += 25) {
    console.log(`Fetching page with offset ${s}...`);
    const results = await fetchDDGPage("site:boslive.icai.org/mock_test_paper/", s);
    if (results.length === 0) break;
    for (const r of results) {
      if (!seen.has(r.url)) {
        seen.add(r.url);
        allResults.push(r);
        console.log(`  Found: ${r.url}`);
      }
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\nTotal unique files found: ${allResults.length}`);
  fs.writeFileSync("indexed_mtp_links.json", JSON.stringify(allResults, null, 2));
}

main().catch(console.error);
