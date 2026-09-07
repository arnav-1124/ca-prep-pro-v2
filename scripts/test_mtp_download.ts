import fs from "fs";
import { execSync } from "child_process";

async function main() {
  const url = "https://boslive.icai.org/mock_test_paper/MTP_48_54_QUESTIONS_1746181640.pdf";
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  const res = await fetch(url);
  console.log(`Status: ${res.status}`);
  if (res.ok) {
    const buf = await res.arrayBuffer();
    fs.writeFileSync("mtp_sample_test.pdf", Buffer.from(buf));
    console.log(`Downloaded ${buf.byteLength} bytes.`);
    try {
      execSync("pdftotext -layout mtp_sample_test.pdf mtp_sample_test.txt");
      const txt = fs.readFileSync("mtp_sample_test.txt", "utf-8");
      console.log("First 800 chars:\n", txt.slice(0, 800));
    } catch (e: any) {
      console.error(e.message);
    }
  }
}

main().catch(console.error);
