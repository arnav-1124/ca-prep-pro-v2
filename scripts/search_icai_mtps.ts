async function main() {
  const query = "site:icai.org inurl:mtp \"Foundation\" 2025";
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
  });
  
  const html = await res.text();
  const linkRegex = /<a class="result__url"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  console.log("Results for query:", query);
  while ((m = linkRegex.exec(html)) !== null) {
    let rawUrl = m[1];
    if (rawUrl.includes("uddg=")) {
      const u = new URL("https://duckduckgo.com" + rawUrl);
      rawUrl = decodeURIComponent(u.searchParams.get("uddg") || rawUrl);
    }
    const snippet = m[2].replace(/<[^>]+>/g, "").trim();
    console.log(`- ${rawUrl} | ${snippet}`);
  }
}

main().catch(console.error);
