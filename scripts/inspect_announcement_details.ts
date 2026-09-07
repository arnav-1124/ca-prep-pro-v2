process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function inspect(id: number) {
  const url = `https://boslive.icai.org/announcement_details.php?id=${id}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
  });
  
  const html = await res.text();
  console.log(`\n================ Announcement ID: ${id} (Length: ${html.length}) ================`);
  
  const regex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = regex.exec(html)) !== null) {
    const href = m[1];
    const text = m[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (href.includes(".pdf") || href.includes("mock") || href.includes("mtp") || href.includes("download") || href.includes("icai.org")) {
      console.log(`  [${text}] -> ${href}`);
    }
  }

  // Look for any table rows or text about papers (Accounting, Laws, Quant, Economics)
  const rows = html.match(/<tr[\s\S]*?<\/tr>/gi);
  if (rows) {
    console.log(`\nFound ${rows.length} table rows:`);
    for (const r of rows.slice(0, 20)) {
      const cleanRow = r.replace(/<[^>]+>/g, " | ").replace(/\s+/g, " ").trim();
      if (cleanRow.length > 5) {
        console.log("  TR:", cleanRow);
      }
    }
  }
}

async function main() {
  await inspect(450);
  await inspect(510);
}

main().catch(console.error);
