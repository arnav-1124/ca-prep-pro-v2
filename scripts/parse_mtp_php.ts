process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function main() {
  const url = "https://boslive.icai.org/mock_test_paper.php?course=foundation";
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
  });
  
  const html = await res.text();
  console.log(`Page length: ${html.length}`);
  
  // Find all links containing .pdf, mtp, or mock
  const regex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  const pdfs: { href: string; text: string }[] = [];
  while ((m = regex.exec(html)) !== null) {
    const href = m[1];
    const text = m[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (href.includes(".pdf") || href.includes("mock") || href.includes("download")) {
      pdfs.push({ href, text });
    }
  }
  
  console.log(`Found ${pdfs.length} relevant links:`);
  for (const p of pdfs) {
    console.log(`  [${p.text}] -> ${p.href}`);
  }
  
  // Check form actions or table dropdowns
  const forms = html.match(/<form[\s\S]*?<\/form>/gi);
  if (forms) {
    console.log(`\nFound ${forms.length} forms:`);
    for (const f of forms) {
      console.log(f.replace(/\s+/g, " ").slice(0, 300));
    }
  }
  
  // Check select options (e.g. series dropdown, subject dropdown)
  const selects = html.match(/<select[\s\S]*?<\/select>/gi);
  if (selects) {
    console.log(`\nFound ${selects.length} selects:`);
    for (const s of selects) {
      console.log(s.replace(/<option/gi, "\n  <option").replace(/<\/option>/gi, ""));
    }
  }
}

main().catch(console.error);
