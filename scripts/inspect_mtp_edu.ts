process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function main() {
  const urls = [
    "https://boslive.icai.org/education_content.php?p=Mock%20Test%20Papers",
    "https://www.icai.org/post/19909"
  ];
  
  for (const u of urls) {
    console.log(`\n================ Inspecting ${u} ================`);
    try {
      const res = await fetch(u, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });
      console.log(`Status: ${res.status}`);
      if (res.ok) {
        const html = await res.text();
        console.log(`Length: ${html.length}`);
        // Find links
        const regex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
        let m;
        const links: { href: string; text: string }[] = [];
        while ((m = regex.exec(html)) !== null) {
          const href = m[1];
          const text = m[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
          if (text.toLowerCase().includes("foundation") || text.toLowerCase().includes("series") || href.includes(".pdf") || href.includes("php")) {
            links.push({ href, text });
          }
        }
        console.log(`Found ${links.length} matching links:`);
        for (const l of links.slice(0, 30)) {
          console.log(`  [${l.text}] -> ${l.href}`);
        }
        // Check text
        const textSample = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
        console.log("Snippet:", textSample.slice(0, 500));
      }
    } catch (e: any) {
      console.error(e.message);
    }
  }
}

main().catch(console.error);
