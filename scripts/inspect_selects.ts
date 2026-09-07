process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function main() {
  const url = "https://boslive.icai.org/mock_test_paper.php?course=foundation";
  const res = await fetch(url);
  const html = await res.text();
  
  // Find all select elements with name and options
  const selectRegex = /<select[^>]*name=["']([^"']+)["'][^>]*>([\s\S]*?)<\/select>/gi;
  let m;
  while ((m = selectRegex.exec(html)) !== null) {
    const name = m[1];
    const options = m[2];
    const optMatches = [...options.matchAll(/<option[^>]*value=["']([^"']*)["'][^>]*>([\s\S]*?)<\/option>/gi)]
      .map(o => ({ value: o[1], text: o[2].trim() }));
    console.log(`\nSelect: "${name}" (${optMatches.length} options):`);
    for (const opt of optMatches.slice(0, 15)) {
      console.log(`  [${opt.value}] -> ${opt.text}`);
    }
  }
}

main().catch(console.error);
