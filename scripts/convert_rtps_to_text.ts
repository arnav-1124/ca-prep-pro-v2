import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const files = fs.readdirSync("rtp_downloads").filter((f) => f.endsWith(".pdf"));
  console.log(`Found ${files.length} PDFs in rtp_downloads.`);

  for (const f of files) {
    const pdfPath = path.join("rtp_downloads", f);
    const txtPath = path.join("rtp_downloads", f.replace(".pdf", ".txt"));
    console.log(`Converting ${f} -> ${path.basename(txtPath)}...`);
    try {
      execSync(`pdftotext -layout "${pdfPath}" "${txtPath}"`);
      const size = fs.statSync(txtPath).size;
      console.log(`✓ Converted ${f} (${size} bytes)`);
    } catch (e) {
      console.error(`Failed to convert ${f}:`, e);
    }
  }

  console.log("All conversions finished.");
}

main().catch(console.error);
