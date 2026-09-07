import fs from "fs";
import { execSync } from "child_process";

async function main() {
  const url = "https://resource.cdn.icai.org/86583bos-aps1159-fnd-mtp-series-sep2025.pdf";
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  fs.writeFileSync("mtp_sep2025_schedule.pdf", Buffer.from(buf));
  console.log(`Downloaded ${buf.byteLength} bytes.`);
  
  try {
    execSync("pdftotext -layout mtp_sep2025_schedule.pdf mtp_sep2025_schedule.txt");
    const txt = fs.readFileSync("mtp_sep2025_schedule.txt", "utf-8");
    console.log("Extracted schedule text:\n", txt);
  } catch (e: any) {
    console.error(e.message);
  }
}

main().catch(console.error);
