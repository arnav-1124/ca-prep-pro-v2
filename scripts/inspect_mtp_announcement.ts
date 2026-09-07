process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function main() {
  const url = "https://boslive.icai.org/mock_test_paper_announcement.php?course=foundation";
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
  });
  
  const html = await res.text();
  console.log(`Fetched page length: ${html.length}`);
  
  // Extract all links on this page
  const regex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  const mtpLinks: { href: string; text: string }[] = [];
  while ((m = regex.exec(html)) !== null) {
    const href = m[1];
    const text = m[2].replace(/<[^>]+>/g, "").trim();
    if (href.includes("mock_test_paper") || href.includes(".pdf") || href.includes("mtp")) {
      mtpLinks.push({ href, text });
    }
  }
  
  console.log(`Found ${mtpLinks.length} MTP links:`);
  for (const l of mtpLinks) {
    console.log(`  [${l.text}] -> ${l.href}`);
  }
  
  // Also dump table or text context
  const textContent = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
  // Find dates or series mentioned (e.g. 2024, 2025, 2026, Series I, Series II)
  const seriesMatches = textContent.match(/(?:Series\s+[I|V|X]+|January\s+2025|May\s+2025|June\s+2025|Sept\s+2024|Nov\s+2024|Dec\s+2024)[\s\S]{1,200}/gi);
  if (seriesMatches) {
    console.log("\nKey sections found:");
    for (const sm of seriesMatches.slice(0, 10)) {
      console.log("---", sm.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    }
  }
}

main().catch(console.error);
