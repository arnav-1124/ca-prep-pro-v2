import fs from "fs";
import path from "path";

async function downloadHeader(url: string, dest: string) {
  console.log(`Downloading: ${url} to ${dest}...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const buf = await res.arrayBuffer();
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, Buffer.from(buf));
  console.log(`Saved ${buf.byteLength} bytes to ${dest}`);
}

async function main() {
  await downloadHeader("https://resource.cdn.icai.org/90933bos-aps4118-p1.pdf", "ingestion/intermediate/booklets/p1_csb.pdf");
  await downloadHeader("https://resource.cdn.icai.org/90934bos-aps4118-p2.pdf", "ingestion/intermediate/booklets/p2_csb.pdf");
}

main().catch(console.error);
