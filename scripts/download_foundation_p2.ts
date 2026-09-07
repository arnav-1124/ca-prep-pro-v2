import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const P2_FILES = [
  { code: "FND_P2_CH1", file: "ch1.pdf", url: "https://resource.cdn.icai.org/88015bos-aps2231-ch1.pdf" },
  { code: "FND_P2_CH2_T1", file: "ch2u1.pdf", url: "https://resource.cdn.icai.org/88017bos-aps2231-ch2u1.pdf" },
  { code: "FND_P2_CH2_T2", file: "ch2u2.pdf", url: "https://resource.cdn.icai.org/88018bos-aps2231-ch2u2.pdf" },
  { code: "FND_P2_CH2_T2", file: "ch2u3.pdf", url: "https://resource.cdn.icai.org/88019bos-aps2231-ch2u3.pdf" },
  { code: "FND_P2_CH2_T3", file: "ch2u4.pdf", url: "https://resource.cdn.icai.org/88020bos-aps2231-ch2u4.pdf" },
  { code: "FND_P2_CH2_T4", file: "ch2u5.pdf", url: "https://resource.cdn.icai.org/88021bos-aps2231-ch2u5.pdf" },
  { code: "FND_P2_CH2_T5", file: "ch2u6.pdf", url: "https://resource.cdn.icai.org/88022bos-aps2231-ch2u6.pdf" },
  { code: "FND_P2_CH2", file: "ch2u7.pdf", url: "https://resource.cdn.icai.org/88023bos-aps2231-ch2u7.pdf" },
  { code: "FND_P2_CH2", file: "ch2u8.pdf", url: "https://resource.cdn.icai.org/88024bos-aps2231-ch2u8.pdf" },
  { code: "FND_P2_CH2", file: "ch2u9.pdf", url: "https://resource.cdn.icai.org/88025bos-aps2231-ch2u9.pdf" },
  { code: "FND_P2_CH3_T1", file: "ch3u1.pdf", url: "https://resource.cdn.icai.org/88026bos-aps2231-ch3u1.pdf" },
  { code: "FND_P2_CH3_T2", file: "ch3u2.pdf", url: "https://resource.cdn.icai.org/88027bos-aps2231-ch3u2.pdf" },
  { code: "FND_P2_CH3_T3", file: "ch3u3.pdf", url: "https://resource.cdn.icai.org/88028bos-aps2231-ch3u3.pdf" },
  { code: "FND_P2_CH3_T4", file: "ch3u4.pdf", url: "https://resource.cdn.icai.org/88029bos-aps2231-ch3u4.pdf" },
  { code: "FND_P2_CH4_T1", file: "ch4u1.pdf", url: "https://resource.cdn.icai.org/88030bos-aps2231-ch4u1.pdf" },
  { code: "FND_P2_CH4_T2", file: "ch4u2.pdf", url: "https://resource.cdn.icai.org/88031bos-aps2231-ch4u2.pdf" },
  { code: "FND_P2_CH4_T3", file: "ch4u3.pdf", url: "https://resource.cdn.icai.org/88032bos-aps2231-ch4u3.pdf" },
  { code: "FND_P2_CH5", file: "ch5.pdf", url: "https://resource.cdn.icai.org/88033bos-aps2231-ch5.pdf" },
  { code: "FND_P2_CH6", file: "ch6.pdf", url: "https://resource.cdn.icai.org/88034bos-aps2231-ch6.pdf" },
  { code: "FND_P2_CH7", file: "ch7.pdf", url: "https://resource.cdn.icai.org/88035bos-aps2231-ch7.pdf" },
];

const targetDir = path.join(__dirname, "../ingestion/foundation/paper_2_laws");
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

async function downloadFile(url: string, dest: string) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) {
    return;
  }
  console.log(`Downloading ${url}...`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download ${url}: ${res.status} ${res.statusText}`);
  }
  const buf = await res.arrayBuffer();
  fs.writeFileSync(dest, Buffer.from(buf));
  console.log(`Saved ${dest} (${buf.byteLength} bytes)`);
}

async function main() {
  console.log("=== DOWNLOADING AND EXTRACTING PAPER 2 (BUSINESS LAWS) ===");

  for (const item of P2_FILES) {
    const pdfPath = path.join(targetDir, item.file);
    const txtPath = path.join(targetDir, item.file.replace(".pdf", "_layout.txt"));

    await downloadFile(item.url, pdfPath);

    if (!fs.existsSync(txtPath) || fs.statSync(txtPath).size === 0) {
      console.log(`Extracting layout text for ${item.file}...`);
      try {
        execSync(`pdftotext -layout "${pdfPath}" "${txtPath}"`);
      } catch (err: unknown) {
        console.error(`Error running pdftotext on ${item.file}:`, (err as Error).message);
      }
    }
  }

  console.log("All Paper 2 files downloaded and extracted!");
}

main().catch(console.error);
