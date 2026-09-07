process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function main() {
  const url = "https://boslive.icai.org/mock_test_paper.php?course=foundation";
  const res = await fetch(url);
  const html = await res.text();
  
  // Find all <script> blocks
  const scriptRegex = /<script[\s\S]*?<\/script>/gi;
  let m;
  console.log("Scripts in mock_test_paper.php:");
  while ((m = scriptRegex.exec(html)) !== null) {
    const s = m[0];
    if (s.includes("ajax") || s.includes("fetch") || s.includes(".php") || s.includes("course")) {
      console.log("-----------------------------------------");
      console.log(s.slice(0, 500));
    }
  }
}

main().catch(console.error);
