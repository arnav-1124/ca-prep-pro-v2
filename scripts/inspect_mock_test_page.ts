import fs from "fs";

function main() {
  const html = fs.readFileSync("mock_test_paper_page.html", "utf-8");
  
  const matches = [...html.matchAll(/(?:mock_test_paper\/|MTP_)[^\s"\'<>]+/gi)];
  console.log(`Direct MTP matches: ${matches.length}`);
  for (const m of matches) {
    console.log(` -> ${m[0]}`);
  }

  const pdfs = [...html.matchAll(/https?:\/\/[^\s"']+\.pdf/gi)];
  console.log(`Total PDF URLs in page: ${pdfs.length}`);
  for (const p of pdfs) {
    console.log(` -> ${p[0]}`);
  }

  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
  console.log(`Script tags count: ${scripts.length}`);
  for (const s of scripts) {
    if (s[1].includes("validation") || s[1].includes("submit") || s[1].includes("ajax") || s[1].includes("post") || s[1].includes("form")) {
      console.log("=== Script ===");
      console.log(s[1].slice(0, 800));
    }
  }
}

main();
