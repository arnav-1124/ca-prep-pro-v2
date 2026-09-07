async function main() {
  const url = "https://www.icai.org/category/foundation-course";
  const res = await fetch(url);
  const html = await res.text();
  
  // Find all links on this page
  const regex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  console.log("All main links on foundation-course category:");
  while ((m = regex.exec(html)) !== null) {
    const href = m[1];
    const text = m[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (text.length > 2 && !href.startsWith("#") && !href.includes("javascript")) {
      console.log(`  [${text}] -> ${href}`);
    }
  }
}

main().catch(console.error);
