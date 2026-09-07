process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function main() {
  const url = "https://bosactivities.icai.org/";
  try {
    const res = await fetch(url);
    console.log(`[${res.status}] ${url}`);
    if (res.ok) {
      const html = await res.text();
      console.log(`Length: ${html.length}`);
      // find all links
      const regex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
      let m;
      while ((m = regex.exec(html)) !== null) {
        const href = m[1];
        const text = m[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
        if (text.length > 0) {
          console.log(`  [${text}] -> ${href}`);
        }
      }
    }
  } catch (e: any) {
    console.log("ERR:", e.message);
  }
}

main().catch(console.error);
