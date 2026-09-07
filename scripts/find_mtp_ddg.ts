process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function main() {
  console.log("Searching for MTP links or files on boslive.icai.org...");
  
  // Let's check Google/Bing/Yahoo/DDG specifically for "boslive.icai.org/mock_test_paper/MTP_"
  const query = "inurl:boslive.icai.org/mock_test_paper/MTP_";
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
  });
  
  const html = await res.text();
  const linkRegex = /<a class="result__url"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  const found = new Set<string>();
  while ((m = linkRegex.exec(html)) !== null) {
    let rawUrl = m[1];
    if (rawUrl.includes("uddg=")) {
      const u = new URL("https://duckduckgo.com" + rawUrl);
      rawUrl = decodeURIComponent(u.searchParams.get("uddg") || rawUrl);
    }
    if (rawUrl.includes("MTP_")) {
      found.add(rawUrl);
    }
  }
  
  console.log(`Found ${found.size} direct MTP links on DDG:`);
  for (const f of found) {
    console.log("  ", f);
  }
}

main().catch(console.error);
