import fs from "fs";
import path from "path";
import { execSync } from "child_process";

interface DownloadItem {
  paper: string;
  folder: string;
  url: string;
  filename: string;
}

const ITEMS: DownloadItem[] = [
  // =================== GROUP 2 CASE SCENARIOS BOOKLETS ===================
  { paper: "P4", folder: "booklets", url: "https://resource.cdn.icai.org/90937bos-aps4118-p4.pdf", filename: "p4_csb.pdf" },
  { paper: "P5", folder: "booklets", url: "https://resource.cdn.icai.org/90938bos-aps4118-p5.pdf", filename: "p5_csb.pdf" },
  { paper: "P6A", folder: "booklets", url: "https://resource.cdn.icai.org/90939bos-aps4118-p6a.pdf", filename: "p6a_csb.pdf" },
  { paper: "P6B", folder: "booklets", url: "https://resource.cdn.icai.org/90940bos-aps4118-p6b.pdf", filename: "p6b_csb.pdf" },

  // =================== PAPER 4: COST AND MANAGEMENT ACCOUNTING ===================
  { paper: "P4", folder: "paper_4_costing", url: "https://resource.cdn.icai.org/87789bos-aps2161-ch1.pdf", filename: "p4_ch1.pdf" },
  { paper: "P4", folder: "paper_4_costing", url: "https://resource.cdn.icai.org/87790bos-aps2161-ch2.pdf", filename: "p4_ch2.pdf" },
  { paper: "P4", folder: "paper_4_costing", url: "https://resource.cdn.icai.org/87791bos-aps2161-ch3.pdf", filename: "p4_ch3.pdf" },
  { paper: "P4", folder: "paper_4_costing", url: "https://resource.cdn.icai.org/87792bos-aps2161-ch4.pdf", filename: "p4_ch4.pdf" },
  { paper: "P4", folder: "paper_4_costing", url: "https://resource.cdn.icai.org/87793bos-aps2161-ch5.pdf", filename: "p4_ch5.pdf" },
  { paper: "P4", folder: "paper_4_costing", url: "https://resource.cdn.icai.org/87794bos-aps2161-ch6.pdf", filename: "p4_ch6.pdf" },
  { paper: "P4", folder: "paper_4_costing", url: "https://resource.cdn.icai.org/87795bos-aps2161-ch7.pdf", filename: "p4_ch7.pdf" },
  { paper: "P4", folder: "paper_4_costing", url: "https://resource.cdn.icai.org/87797bos-aps2161-ch8.pdf", filename: "p4_ch8.pdf" },
  { paper: "P4", folder: "paper_4_costing", url: "https://resource.cdn.icai.org/87798bos-aps2161-ch9.pdf", filename: "p4_ch9.pdf" },
  { paper: "P4", folder: "paper_4_costing", url: "https://resource.cdn.icai.org/87799bos-aps2161-ch10.pdf", filename: "p4_ch10.pdf" },
  { paper: "P4", folder: "paper_4_costing", url: "https://resource.cdn.icai.org/87800bos-aps2161-ch11.pdf", filename: "p4_ch11.pdf" },
  { paper: "P4", folder: "paper_4_costing", url: "https://resource.cdn.icai.org/87801bos-aps2161-ch12.pdf", filename: "p4_ch12.pdf" },
  { paper: "P4", folder: "paper_4_costing", url: "https://resource.cdn.icai.org/87802bos-aps2161-ch13.pdf", filename: "p4_ch13.pdf" },
  { paper: "P4", folder: "paper_4_costing", url: "https://resource.cdn.icai.org/87803bos-aps2161-ch14.pdf", filename: "p4_ch14.pdf" },
  { paper: "P4", folder: "paper_4_costing", url: "https://resource.cdn.icai.org/87804bos-aps2161-ch15.pdf", filename: "p4_ch15.pdf" },

  // =================== PAPER 5: AUDITING AND ETHICS ===================
  { paper: "P5", folder: "paper_5_auditing", url: "https://resource.cdn.icai.org/87756bos280825-ch1a.pdf", filename: "p5_ch1.pdf" },
  { paper: "P5", folder: "paper_5_auditing", url: "https://resource.cdn.icai.org/87757bos280825-ch2a.pdf", filename: "p5_ch2.pdf" },
  { paper: "P5", folder: "paper_5_auditing", url: "https://resource.cdn.icai.org/87758bos280825-ch3a.pdf", filename: "p5_ch3.pdf" },
  { paper: "P5", folder: "paper_5_auditing", url: "https://resource.cdn.icai.org/87759bos280825-ch4a.pdf", filename: "p5_ch4.pdf" },
  { paper: "P5", folder: "paper_5_auditing", url: "https://resource.cdn.icai.org/87760bos280825-ch5a.pdf", filename: "p5_ch5.pdf" },
  { paper: "P5", folder: "paper_5_auditing", url: "https://resource.cdn.icai.org/87762bos280825-ch6a.pdf", filename: "p5_ch6.pdf" },
  { paper: "P5", folder: "paper_5_auditing", url: "https://resource.cdn.icai.org/87763bos280825-ch7a.pdf", filename: "p5_ch7.pdf" },
  { paper: "P5", folder: "paper_5_auditing", url: "https://resource.cdn.icai.org/87764bos280825-ch8a.pdf", filename: "p5_ch8.pdf" },
  { paper: "P5", folder: "paper_5_auditing", url: "https://resource.cdn.icai.org/87765bos280825-ch9a.pdf", filename: "p5_ch9.pdf" },
  { paper: "P5", folder: "paper_5_auditing", url: "https://resource.cdn.icai.org/87766bos280825-ch10a.pdf", filename: "p5_ch10.pdf" },
  { paper: "P5", folder: "paper_5_auditing", url: "https://resource.cdn.icai.org/87767bos280825-ch11a.pdf", filename: "p5_ch11.pdf" },

  // =================== PAPER 6: FM & SM ===================
  { paper: "P6A", folder: "paper_6_fmsm", url: "https://resource.cdn.icai.org/87737bos280825-ch1.pdf", filename: "p6a_ch1.pdf" },
  { paper: "P6A", folder: "paper_6_fmsm", url: "https://resource.cdn.icai.org/87738bos280825-ch2.pdf", filename: "p6a_ch2.pdf" },
  { paper: "P6A", folder: "paper_6_fmsm", url: "https://resource.cdn.icai.org/87739bos280825-ch3.pdf", filename: "p6a_ch3.pdf" },
  { paper: "P6A", folder: "paper_6_fmsm", url: "https://resource.cdn.icai.org/87740bos-280825-ch4.pdf", filename: "p6a_ch4.pdf" },
  { paper: "P6A", folder: "paper_6_fmsm", url: "https://resource.cdn.icai.org/87741bos-280825-ch5.pdf", filename: "p6a_ch5.pdf" },
  { paper: "P6A", folder: "paper_6_fmsm", url: "https://resource.cdn.icai.org/87742bos-28082025-ch6.pdf", filename: "p6a_ch6.pdf" },
  { paper: "P6A", folder: "paper_6_fmsm", url: "https://resource.cdn.icai.org/87745bos280825-ch7.pdf", filename: "p6a_ch7.pdf" },
  { paper: "P6A", folder: "paper_6_fmsm", url: "https://resource.cdn.icai.org/87746bos280825-ch8.pdf", filename: "p6a_ch8.pdf" },
  { paper: "P6B", folder: "paper_6_fmsm", url: "https://resource.cdn.icai.org/87995bos-aps2213-ch1.pdf", filename: "p6b_ch1.pdf" },
  { paper: "P6B", folder: "paper_6_fmsm", url: "https://resource.cdn.icai.org/87996bos-aps2213-ch2.pdf", filename: "p6b_ch2.pdf" },
  { paper: "P6B", folder: "paper_6_fmsm", url: "https://resource.cdn.icai.org/87997bos-aps2213-ch3.pdf", filename: "p6b_ch3.pdf" },
  { paper: "P6B", folder: "paper_6_fmsm", url: "https://resource.cdn.icai.org/87998bos-aps2213-ch4.pdf", filename: "p6b_ch4.pdf" },
  { paper: "P6B", folder: "paper_6_fmsm", url: "https://resource.cdn.icai.org/87999bos-aps2213-ch5.pdf", filename: "p6b_ch5.pdf" },
];

async function downloadFile(url: string, dest: string) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) {
    console.log(`  [CACHED] ${path.basename(dest)}`);
    return;
  }
  console.log(`  Downloading ${url} -> ${path.basename(dest)}...`);
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`    Failed ${url}: HTTP ${res.status}`);
      return;
    }
    const buf = await res.arrayBuffer();
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, Buffer.from(buf));
    console.log(`    ✓ Saved ${buf.byteLength} bytes`);
  } catch (err: any) {
    console.warn(`    Error downloading ${url}: ${err.message}`);
  }
}

async function main() {
  console.log("=== DOWNLOADING CA INTERMEDIATE GROUP 2 MATERIAL ===");

  const baseDir = path.join(__dirname, "../ingestion/intermediate");

  for (const item of ITEMS) {
    const dir = path.join(baseDir, item.folder);
    const pdfPath = path.join(dir, item.filename);
    const txtPath = path.join(dir, item.filename.replace(".pdf", "_layout.txt"));

    await downloadFile(item.url, pdfPath);

    if (fs.existsSync(pdfPath) && (!fs.existsSync(txtPath) || fs.statSync(txtPath).size === 0)) {
      try {
        console.log(`  Extracting layout text: ${item.filename}...`);
        execSync(`pdftotext -layout "${pdfPath}" "${txtPath}"`);
      } catch (err: any) {
        console.warn(`  Warning running pdftotext on ${item.filename}: ${err.message}`);
      }
    }
  }

  console.log("\nAll Group 2 files downloaded and extracted!");
}

main().catch(console.error);
