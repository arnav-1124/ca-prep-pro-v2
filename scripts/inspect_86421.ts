import fs from "fs";
import { execSync } from "child_process";

async function main() {
  const url = "https://resource.cdn.icai.org/86421bos-aps1013-mtp-series-I-II-sep2025-exam.pdf";
  const res = await fetch(url);
  console.log(`Status: ${res.status}`);
  if (res.ok) {
    const buf = await res.arrayBuffer();
    fs.writeFileSync("mtp_86421.pdf", Buffer.from(buf));
    console.log(`Downloaded ${buf.byteLength} bytes.`);
    try {
      execSync("pdftotext -layout mtp_86421.pdf mtp_86421.txt");
      const txt = fs.readFileSync("mtp_86421.txt", "utf-8");
      console.log("Snippet:\n", txt.slice(0, 1000));
    } catch (e: any) {
      console.error(e.message);
    }
  }
}

main().catch(console.error);
