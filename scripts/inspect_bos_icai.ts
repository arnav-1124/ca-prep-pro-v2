process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function main() {
  const urls = [
    "https://bos.icai.org/",
    "https://bos.icai.org/mock-test-papers",
    "https://bos.icai.org/foundation",
    "https://bos.icai.org/course/foundation"
  ];
  
  for (const u of urls) {
    try {
      const res = await fetch(u);
      console.log(`[${res.status}] ${u}`);
      if (res.ok) {
        const html = await res.text();
        console.log(`  Length: ${html.length}`);
      }
    } catch (e: any) {
      console.log(`[ERR] ${u}: ${e.message}`);
    }
  }
}

main().catch(console.error);
