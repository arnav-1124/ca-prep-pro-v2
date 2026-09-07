import fs from "fs";

function main() {
  const html = fs.readFileSync("modelTestPapers_foundation.html", "utf-8");
  const regex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  const links: { href: string; text: string }[] = [];
  while ((m = regex.exec(html)) !== null) {
    const href = m[1];
    const text = m[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    links.push({ href, text });
  }

  console.log(`Total links: ${links.length}`);
  for (const l of links) {
    console.log(`[${l.text}] -> ${l.href}`);
  }

  // Also look for cards, tables, or accordion divs
  const cardBody = html.match(/<div class="card-body">([\s\S]*?)<\/div>/gi);
  if (cardBody) {
    console.log("\nCard bodies:");
    for (const c of cardBody) {
      console.log(c.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300));
    }
  }
}

main();
