import fs from "fs";
import path from "path";
import { execSync } from "child_process";

interface ChapterPdf {
  code: string;
  name: string;
  url: string;
  localFile: string;
}

const P4_PDFS: ChapterPdf[] = [
  { code: "FND_P4_CH1", name: "Chapter 1 Unit 1", url: "https://resource.cdn.icai.org/88059bos-aps2233-ch1u1.pdf", localFile: "ch1u1.pdf" },
  { code: "FND_P4_CH1", name: "Chapter 1 Unit 2", url: "https://resource.cdn.icai.org/88060bos-aps2233-ch1u2.pdf", localFile: "ch1u2.pdf" },
  { code: "FND_P4_CH2", name: "Chapter 2 Unit 1", url: "https://resource.cdn.icai.org/88061bos-aps2233-ch2u1.pdf", localFile: "ch2u1.pdf" },
  { code: "FND_P4_CH2", name: "Chapter 2 Unit 2", url: "https://resource.cdn.icai.org/88062bos-aps2233-ch2u2.pdf", localFile: "ch2u2.pdf" },
  { code: "FND_P4_CH2", name: "Chapter 2 Unit 3", url: "https://resource.cdn.icai.org/88063bos-aps2233-ch2u3.pdf", localFile: "ch2u3.pdf" },
  { code: "FND_P4_CH3", name: "Chapter 3 Unit 1", url: "https://resource.cdn.icai.org/88064bos-aps2233-ch3u1.pdf", localFile: "ch3u1.pdf" },
  { code: "FND_P4_CH3", name: "Chapter 3 Unit 2", url: "https://resource.cdn.icai.org/88065bos-aps2233-ch3u2.pdf", localFile: "ch3u2.pdf" },
  { code: "FND_P4_CH4", name: "Chapter 4 Unit 1", url: "https://resource.cdn.icai.org/88066bos-aps2233-ch4u1.pdf", localFile: "ch4u1.pdf" },
  { code: "FND_P4_CH4", name: "Chapter 4 Unit 2", url: "https://resource.cdn.icai.org/88067bos-aps2233-ch4u2.pdf", localFile: "ch4u2.pdf" },
  { code: "FND_P4_CH4", name: "Chapter 4 Unit 3", url: "https://resource.cdn.icai.org/88068bos-aps2233-ch4u3.pdf", localFile: "ch4u3.pdf" },
  { code: "FND_P4_CH5", name: "Chapter 5", url: "https://resource.cdn.icai.org/88069bos-aps2233-ch5.pdf", localFile: "ch5.pdf" },
  { code: "FND_P4_CH6", name: "Chapter 6 Unit 1", url: "https://resource.cdn.icai.org/88070bos-aps2233-ch6u1.pdf", localFile: "ch6u1.pdf" },
  { code: "FND_P4_CH6", name: "Chapter 6 Unit 2", url: "https://resource.cdn.icai.org/88071bos-aps2233-ch6u2.pdf", localFile: "ch6u2.pdf" },
  { code: "FND_P4_CH7", name: "Chapter 7 Unit 1", url: "https://resource.cdn.icai.org/88072bos-aps2233-ch7u1.pdf", localFile: "ch7u1.pdf" },
  { code: "FND_P4_CH7", name: "Chapter 7 Unit 2", url: "https://resource.cdn.icai.org/88073bos-aps2233-ch7u2.pdf", localFile: "ch7u2.pdf" },
  { code: "FND_P4_CH7", name: "Chapter 7 Unit 3", url: "https://resource.cdn.icai.org/88074bos-aps2233-ch7u3.pdf", localFile: "ch7u3.pdf" },
  { code: "FND_P4_CH7", name: "Chapter 7 Unit 4", url: "https://resource.cdn.icai.org/88075bos-aps2233-ch7u4.pdf", localFile: "ch7u4.pdf" },
  { code: "FND_P4_CH8", name: "Chapter 8 Unit 1", url: "https://resource.cdn.icai.org/88076bos-aps2233-ch8u1.pdf", localFile: "ch8u1.pdf" },
  { code: "FND_P4_CH8", name: "Chapter 8 Unit 2", url: "https://resource.cdn.icai.org/88077bos-aps2233-ch8u2.pdf", localFile: "ch8u2.pdf" },
  { code: "FND_P4_CH8", name: "Chapter 8 Unit 3", url: "https://resource.cdn.icai.org/88078bos-aps2233-ch8u3.pdf", localFile: "ch8u3.pdf" },
  { code: "FND_P4_CH9", name: "Chapter 9 Unit 1", url: "https://resource.cdn.icai.org/88079bos-aps2233-ch9u1.pdf", localFile: "ch9u1.pdf" },
  { code: "FND_P4_CH9", name: "Chapter 9 Unit 2", url: "https://resource.cdn.icai.org/88080bos-aps2233-ch9u2.pdf", localFile: "ch9u2.pdf" },
  { code: "FND_P4_CH9", name: "Chapter 9 Unit 3", url: "https://resource.cdn.icai.org/88081bos-aps2233-ch9u3.pdf", localFile: "ch9u3.pdf" },
  { code: "FND_P4_CH9", name: "Chapter 9 Unit 4", url: "https://resource.cdn.icai.org/88082bos-aps2233-ch9u4.pdf", localFile: "ch9u4.pdf" },
  { code: "FND_P4_CH9", name: "Chapter 9 Unit 5", url: "https://resource.cdn.icai.org/88083bos-aps2233-ch9u5.pdf", localFile: "ch9u5.pdf" },
  { code: "FND_P4_CH9", name: "Chapter 10", url: "https://resource.cdn.icai.org/88084bos-aps2233-ch10.pdf", localFile: "ch10.pdf" },
];

const targetDir = path.join(__dirname, "../ingestion/foundation/paper_4_economics");
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
  console.log("=== DOWNLOADING AND INSPECTING PAPER 4 ECONOMICS PDFS ===");

  for (const item of P4_PDFS) {
    const pdfPath = path.join(targetDir, item.localFile);
    const txtLayoutPath = path.join(targetDir, item.localFile.replace(".pdf", "_layout.txt"));

    try {
      await downloadFile(item.url, pdfPath);

      if (!fs.existsSync(txtLayoutPath) || fs.statSync(txtLayoutPath).size === 0) {
        console.log(`Extracting layout text for ${item.localFile}...`);
        execSync(`pdftotext -layout "${pdfPath}" "${txtLayoutPath}"`);
      }

      const text = fs.readFileSync(txtLayoutPath, "utf-8");
      // Check for answers
      const answersMatch = text.match(/ANSWERS\s*([\s\S]+?)(?:\f|Chapter|\n\n\n|$)/i);
      let answerCount = 0;
      if (answersMatch) {
        const ansRegex = /(\d+)\s*[\.\)]?\s*\(?([a-d])\)?/gi;
        while (ansRegex.exec(answersMatch[1]) !== null) {
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
