process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function main() {
  const res = await fetch("https://bosactivities.icai.org/");
  const html = await res.text();
  const scripts = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map(m => m[1]);
  console.log("Scripts loaded by bosactivities.icai.org:", scripts);
}

main().catch(console.error);
