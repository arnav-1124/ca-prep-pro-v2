process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function main() {
  const urls = [
    "https://boslive.icai.org/robots.txt",
    "https://boslive.icai.org/sitemap.xml",
    "https://boslive.icai.org/sitemap.txt",
  ];
  
  for (const u of urls) {
    try {
      const res = await fetch(u);
      console.log(`[${res.status}] ${u}`);
      if (res.ok) {
        const text = await res.text();
        console.log(`  Length: ${text.length}`);
        console.log(text.slice(0, 500));
      }
    } catch (e: any) {
      console.log(`[ERR] ${u}: ${e.message}`);
    }
  }
}

main().catch(console.error);
