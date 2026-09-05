import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const P3_PDFS = [
  // Business Math
  { code: "FND_P3_CH1", name: "Chapter 1", url: "https://resource.cdn.icai.org/88037bos-aps2232-ch1.pdf", localFile: "ch1.pdf" },
  { code: "FND_P3_CH2", name: "Chapter 2", url: "https://resource.cdn.icai.org/88038bos-aps2232-ch2.pdf", localFile: "ch2.pdf" },
  { code: "FND_P3_CH3", name: "Chapter 3", url: "https://resource.cdn.icai.org/88039bos-aps2232-ch3.pdf", localFile: "ch3.pdf" },
  { code: "FND_P3_CH4", name: "Chapter 4", url: "https://resource.cdn.icai.org/88040bos-aps2232-ch4.pdf", localFile: "ch4.pdf" },
  { code: "FND_P3_CH5", name: "Chapter 5", url: "https://resource.cdn.icai.org/88041bos-aps2232-ch5.pdf", localFile: "ch5.pdf" },
  { code: "FND_P3_CH6", name: "Chapter 6", url: "https://resource.cdn.icai.org/88042bos-aps2232-ch6.pdf", localFile: "ch6.pdf" },
  { code: "FND_P3_CH7", name: "Chapter 7", url: "https://resource.cdn.icai.org/88043bos-aps2232-ch7.pdf", localFile: "ch7.pdf" },
  { code: "FND_P3_CH8", name: "Chapter 8 Unit 1", url: "https://resource.cdn.icai.org/88044bos-aps2232-ch8u1.pdf", localFile: "ch8u1.pdf" },
  { code: "FND_P3_CH8", name: "Chapter 8 Unit 2", url: "https://resource.cdn.icai.org/88045bos-aps2232-ch8u2.pdf", localFile: "ch8u2.pdf" },
  // Logical Reasoning
  { code: "FND_P3_CH9", name: "Chapter 9", url: "https://resource.cdn.icai.org/88046bos-aps2232-ch9.pdf", localFile: "ch9.pdf" },
  { code: "FND_P3_CH10", name: "Chapter 10", url: "https://resource.cdn.icai.org/88047bos-aps2232-ch10.pdf", localFile: "ch10.pdf" },
  { code: "FND_P3_CH11", name: "Chapter 11", url: "https://resource.cdn.icai.org/88048bos-aps2232-ch11.pdf", localFile: "ch11.pdf" },
  { code: "FND_P3_CH12", name: "Chapter 12", url: "https://resource.cdn.icai.org/88049bos-aps2232-ch12.pdf", localFile: "ch12.pdf" },
  // Statistics
  { code: "FND_P3_CH13", name: "Chapter 13 Unit 1", url: "https://resource.cdn.icai.org/88050bos-aps2232-ch13u1.pdf", localFile: "ch13u1.pdf" },
  { code: "FND_P3_CH13", name: "Chapter 13 Unit 2", url: "https://resource.cdn.icai.org/88051bos-aps2232-ch13u2.pdf", localFile: "ch13u2.pdf" },
  { code: "FND_P3_CH14", name: "Chapter 14 Unit 1", url: "https://resource.cdn.icai.org/88052bos-aps2232-ch14u1.pdf", localFile: "ch14u1.pdf" },
  { code: "FND_P3_CH14", name: "Chapter 14 Unit 2", url: "https://resource.cdn.icai.org/88057bos-aps2232-ch14u2.pdf", localFile: "ch14u2.pdf" },
  { code: "FND_P3_CH15", name: "Chapter 15", url: "https://resource.cdn.icai.org/88053bos-aps2232-ch15.pdf", localFile: "ch15.pdf" },
  { code: "FND_P3_CH16", name: "Chapter 16", url: "https://resource.cdn.icai.org/88054bos-aps2232-ch16.pdf", localFile: "ch16.pdf" },
  { code: "FND_P3_CH17", name: "Chapter 17", url: "https://resource.cdn.icai.org/88055bos-aps2232-ch17.pdf", localFile: "ch17.pdf" },
  { code: "FND_P3_CH18", name: "Chapter 18", url: "https://resource.cdn.icai.org/88056bos-aps2232-ch18.pdf", localFile: "ch18.pdf" },
];

const targetDir = path.join(__dirname, "../ingestion/foundation/paper_3_quant");
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

async function downloadFile(url: string, destPath: string) {
  if (fs.existsSync(destPath) && fs.statSync(destPath).size > 1000) {
    return;
  }
  console.log(`Downloading ${url}...`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download ${url}: ${res.status} ${res.statusText}`);
  }
  const buffer = await res.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(buffer));
  console.log(`Saved to ${destPath} (${buffer.byteLength} bytes)`);
}

async function main() {
  console.log("=== DOWNLOADING AND INSPECTING PAPER 3 QUANTITATIVE APTITUDE PDFS ===");

  for (const item of P3_PDFS) {
    const pdfPath = path.join(targetDir, item.localFile);
    const txtLayoutPath = path.join(targetDir, item.localFile.replace(".pdf", "_layout.txt"));

    try {
      await downloadFile(item.url, pdfPath);

      if (!fs.existsSync(txtLayoutPath) || fs.statSync(txtLayoutPath).size === 0) {
        console.log(`Extracting layout text for ${item.localFile}...`);
        execSync(`pdftotext -layout "${pdfPath}" "${txtLayoutPath}"`);
      }

      const text = fs.readFileSync(txtLayoutPath, "utf-8");
      const idx = text.lastIndexOf("ANSWERS");
      let answerCount = 0;
      if (idx !== -1) {
        const ansText = text.substring(idx);
        const ansRegex = /(\d+)\s*[\.\)]?\s*\(?([a-d])\)?/gi;
        while (ansRegex.exec(ansText) !== null) {
          answerCount++;
        }
      }

      console.log(`[${item.code}] ${item.name} (${item.localFile}) -> Answers found: ${answerCount}`);
    } catch (err) {
      console.error(`Error processing ${item.name}:`, (err as Error).message);
    }
  }
}

main();
