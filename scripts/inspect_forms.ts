process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function main() {
  const url = "https://boslive.icai.org/mock_test_paper.php?course=foundation";
  const res = await fetch(url);
  const html = await res.text();
  
  const formMatches = [...html.matchAll(/<form[^>]*>([\s\S]*?)<\/form>/gi)];
  for (let i = 0; i < formMatches.length; i++) {
    console.log(`\n=== Form ${i + 1} ===`);
    console.log(formMatches[i][0].slice(0, 400));
  }
}

main().catch(console.error);
