process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function main() {
  const url = "https://boslive.icai.org/mock_test_paper.php?course=foundation";
  const res = await fetch(url);
  const html = await res.text();
  
  const fnMatch = html.match(/function\s+validation\s*\([\s\S]*?<\/script>/i);
  if (fnMatch) {
    console.log(fnMatch[0]);
  }
}

main().catch(console.error);
