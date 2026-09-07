import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const P1_FILES = [
  // Module 1
  { code: "FND_P1_CH1_T1", file: "ch1u1.pdf", url: "https://resource.cdn.icai.org/88093bos-aps2240-ch1u1.pdf" },
  { code: "FND_P1_CH1_T2", file: "ch1u2.pdf", url: "https://resource.cdn.icai.org/88094bos-aps2240-ch1u2.pdf" },
  { code: "FND_P1_CH1_T3", file: "ch1u3.pdf", url: "https://resource.cdn.icai.org/88095bos-aps2240-ch1u3.pdf" },
  { code: "FND_P1_CH1_T4", file: "ch1u4.pdf", url: "https://resource.cdn.icai.org/88096bos-aps2240-ch1u4.pdf" },
  { code: "FND_P1_CH1_T5", file: "ch1u5.pdf", url: "https://resource.cdn.icai.org/88097bos-aps2240-ch1u5.pdf" },
  { code: "FND_P1_CH1_T5", file: "ch1u6.pdf", url: "https://resource.cdn.icai.org/88098bos-aps2240-ch1u6.pdf" },
  { code: "FND_P1_CH1_T6", file: "ch1u7.pdf", url: "https://resource.cdn.icai.org/88099bos-aps2240-ch1u7.pdf" },
  { code: "FND_P1_CH2_T1", file: "ch2u1.pdf", url: "https://resource.cdn.icai.org/88100bos-aps2240-ch2u1.pdf" },
  { code: "FND_P1_CH2_T2", file: "ch2u2.pdf", url: "https://resource.cdn.icai.org/88101bos-aps2240-ch2u2.pdf" },
  { code: "FND_P1_CH2_T2", file: "ch2u3.pdf", url: "https://resource.cdn.icai.org/88102bos-aps2240-ch2u3.pdf" },
  { code: "FND_P1_CH2_T1", file: "ch2u4.pdf", url: "https://resource.cdn.icai.org/88103bos-aps2240-ch2u4.pdf" },
  { code: "FND_P1_CH2_T3", file: "ch2u5.pdf", url: "https://resource.cdn.icai.org/88104bos-aps2240-ch2u5.pdf" },
  { code: "FND_P1_CH2_T4", file: "ch2u6.pdf", url: "https://resource.cdn.icai.org/88105bos-aps2240-ch2u6.pdf" },
  { code: "FND_P1_CH3", file: "ch3.pdf", url: "https://resource.cdn.icai.org/88106bos-aps2240-ch3.pdf" },
  { code: "FND_P1_CH4", file: "ch4.pdf", url: "https://resource.cdn.icai.org/88107bos-aps2240-ch4.pdf" },
  { code: "FND_P1_CH5", file: "ch5.pdf", url: "https://resource.cdn.icai.org/88108bos-aps2240-ch5.pdf" },
  { code: "FND_P1_CH6", file: "ch6.pdf", url: "https://resource.cdn.icai.org/88109bos-aps2240-ch6.pdf" },
  { code: "FND_P1_CH7_T1", file: "ch7u1.pdf", url: "https://resource.cdn.icai.org/88110bos-aps2240-ch7u1.pdf" },
  { code: "FND_P1_CH7_T2", file: "ch7u2.pdf", url: "https://resource.cdn.icai.org/88111bos-aps2240-ch7u2.pdf" },
  // Module 2
  { code: "FND_P1_CH8", file: "ch8.pdf", url: "https://resource.cdn.icai.org/88115bos-aps2240-ch8.pdf" },
  { code: "FND_P1_CH9", file: "ch9.pdf", url: "https://resource.cdn.icai.org/88116bos-aps2240-ch9.pdf" },
  { code: "FND_P1_CH10_T1", file: "ch10u1.pdf", url: "https://resource.cdn.icai.org/88117bos-aps2240-ch10u1.pdf" },
  { code: "FND_P1_CH10_T1", file: "ch10u2.pdf", url: "https://resource.cdn.icai.org/88118bos-aps2240-ch10u2.pdf" },
  { code: "FND_P1_CH10_T2", file: "ch10u3.pdf", url: "https://resource.cdn.icai.org/88119bos-aps2240-ch10u3.pdf" },
  { code: "FND_P1_CH10_T2", file: "ch10u4.pdf", url: "https://resource.cdn.icai.org/88120bos-aps2240-ch10u4.pdf" },
  { code: "FND_P1_CH10_T2", file: "ch10u5.pdf", url: "https://resource.cdn.icai.org/88121bos-aps2240-ch10u5.pdf" },
  { code: "FND_P1_CH10_T3", file: "ch10u6.pdf", url: "https://resource.cdn.icai.org/88122bos-aps2240-ch10u6.pdf" },
  { code: "FND_P1_CH11_T1", file: "ch11u1.pdf", url: "https://resource.cdn.icai.org/88134bos-aps2240-ch11u1.pdf" },
  { code: "FND_P1_CH11_T1", file: "ch11u2.pdf", url: "https://resource.cdn.icai.org/88135bos-aps2240-ch11u2.pdf" },
  { code: "FND_P1_CH11_T2", file: "ch11u3.pdf", url: "https://resource.cdn.icai.org/88136bos-aps2240-ch11u3.pdf" },
  { code: "FND_P1_CH11_T2", file: "ch11u4.pdf", url: "https://resource.cdn.icai.org/88137bos-aps2240-ch11u4.pdf" },
  { code: "FND_P1_CH11_T3", file: "ch11u5.pdf", url: "https://resource.cdn.icai.org/88138bos-aps2240-ch11u5.pdf" },
  { code: "FND_P1_CH11_T3", file: "ch11u6.pdf", url: "https://resource.cdn.icai.org/88139bos-aps2240-ch11u6.pdf" },
];

const targetDir = path.join(__dirname, "../ingestion/foundation/paper_1_accounting");
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
  console.log("=== DOWNLOADING AND EXTRACTING PAPER 1 (ACCOUNTING) ===");

  for (const item of P1_FILES) {
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

  console.log("All Paper 1 files downloaded and extracted!");
}

main().catch(console.error);
