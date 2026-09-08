import fs from "fs";
import path from "path";
import { execSync } from "child_process";

interface DownloadItem {
  paper: string;
  code: string;
  name: string;
  url: string;
  filename: string;
}

const ITEMS: DownloadItem[] = [
  // =================== PAPER 2: CORPORATE AND OTHER LAWS ===================
  { paper: "P2", code: "INT_P2_MOD1_CH1", name: "Preliminary", url: "https://resource.cdn.icai.org/87769bos-aps2160-ch1.pdf", filename: "p2_ch1.pdf" },
  { paper: "P2", code: "INT_P2_MOD1_CH2", name: "Incorporation of Company", url: "https://resource.cdn.icai.org/87770bos-aps2160-ch2.pdf", filename: "p2_ch2.pdf" },
  { paper: "P2", code: "INT_P2_MOD1_CH3", name: "Prospectus and Allotment", url: "https://resource.cdn.icai.org/87771bos-aps2160-ch3.pdf", filename: "p2_ch3.pdf" },
  { paper: "P2", code: "INT_P2_MOD1_CH4", name: "Share Capital and Debentures", url: "https://resource.cdn.icai.org/87772bos-aps2160-ch4.pdf", filename: "p2_ch4.pdf" },
  { paper: "P2", code: "INT_P2_MOD1_CH5", name: "Acceptance of Deposits", url: "https://resource.cdn.icai.org/87773bos-aps2160-ch5.pdf", filename: "p2_ch5.pdf" },
  { paper: "P2", code: "INT_P2_MOD1_CH6", name: "Registration of Charges", url: "https://resource.cdn.icai.org/87774bos-aps2160-ch6.pdf", filename: "p2_ch6.pdf" },
  { paper: "P2", code: "INT_P2_MOD1_CH7", name: "Management and Administration", url: "https://resource.cdn.icai.org/87776bos-aps2160-ch7.pdf", filename: "p2_ch7.pdf" },
  { paper: "P2", code: "INT_P2_MOD1_CH8", name: "Declaration and Payment of Dividend", url: "https://resource.cdn.icai.org/87777bos-aps2160-ch8.pdf", filename: "p2_ch8.pdf" },
  { paper: "P2", code: "INT_P2_MOD1_CH9", name: "Accounts of Companies", url: "https://resource.cdn.icai.org/87778bos-aps2160-ch9.pdf", filename: "p2_ch9.pdf" },
  { paper: "P2", code: "INT_P2_MOD1_CH10", name: "Audit and Auditors", url: "https://resource.cdn.icai.org/87779bos-aps2160-ch10.pdf", filename: "p2_ch10.pdf" },
  { paper: "P2", code: "INT_P2_MOD1_CH11", name: "Companies Incorporated Outside India", url: "https://resource.cdn.icai.org/87780bos-aps2160-ch11.pdf", filename: "p2_ch11.pdf" },
  { paper: "P2", code: "INT_P2_MOD1_CH12", name: "LLP Act 2008", url: "https://resource.cdn.icai.org/87782bos-aps2160-ch12.pdf", filename: "p2_ch12.pdf" },
  { paper: "P2", code: "INT_P2_MOD2_CH1", name: "General Clauses Act 1897", url: "https://resource.cdn.icai.org/87784bos-aps2160-p2-ch1.pdf", filename: "p2_other_ch1.pdf" },
  { paper: "P2", code: "INT_P2_MOD2_CH2", name: "Interpretation of Statutes", url: "https://resource.cdn.icai.org/87785bos-aps2160-p2-ch2.pdf", filename: "p2_other_ch2.pdf" },
  { paper: "P2", code: "INT_P2_MOD2_CH3", name: "Foreign Exchange Management Act 1999", url: "https://resource.cdn.icai.org/87786bos-aps2160-p2-ch3.pdf", filename: "p2_other_ch3.pdf" },

  // =================== PAPER 3A: TAXATION (INCOME TAX) ===================
  { paper: "P3A", code: "INT_P3_SECA_CH1", name: "Basic Concepts", url: "https://resource.cdn.icai.org/87168bos-aps1794-ch1.pdf", filename: "p3a_ch1.pdf" },
  { paper: "P3A", code: "INT_P3_SECA_CH2", name: "Residence and Scope of Total Income", url: "https://resource.cdn.icai.org/87169bos-aps1794-ch2.pdf", filename: "p3a_ch2.pdf" },
  { paper: "P3A", code: "INT_P3_SECA_CH3_T1", name: "Salaries", url: "https://resource.cdn.icai.org/87170bos-aps1794-ch3u1.pdf", filename: "p3a_ch3u1.pdf" },
  { paper: "P3A", code: "INT_P3_SECA_CH3_T2", name: "House Property", url: "https://resource.cdn.icai.org/87170bos-aps1794-ch3u2.pdf", filename: "p3a_ch3u2.pdf" },
  { paper: "P3A", code: "INT_P3_SECA_CH3_T3", name: "PGBP", url: "https://resource.cdn.icai.org/87170bos-aps1794-ch3u3.pdf", filename: "p3a_ch3u3.pdf" },
  { paper: "P3A", code: "INT_P3_SECA_CH3_T4", name: "Capital Gains", url: "https://resource.cdn.icai.org/87170bos-aps1794-ch3u4.pdf", filename: "p3a_ch3u4.pdf" },
  { paper: "P3A", code: "INT_P3_SECA_CH3_T5", name: "Other Sources", url: "https://resource.cdn.icai.org/87170bos-aps1794-ch3u5.pdf", filename: "p3a_ch3u5.pdf" },
  { paper: "P3A", code: "INT_P3_SECA_CH4", name: "Clubbing of Income", url: "https://resource.cdn.icai.org/87171bos-aps1794-ch4.pdf", filename: "p3a_ch4.pdf" },
  { paper: "P3A", code: "INT_P3_SECA_CH5", name: "Set off and Carry Forward of Losses", url: "https://resource.cdn.icai.org/87172bos-aps1794-ch5.pdf", filename: "p3a_ch5.pdf" },
  { paper: "P3A", code: "INT_P3_SECA_CH6", name: "Deductions from Gross Total Income", url: "https://resource.cdn.icai.org/87173bos-aps1794-ch6.pdf", filename: "p3a_ch6.pdf" },
  { paper: "P3A", code: "INT_P3_SECA_CH7", name: "Advance Tax, TDS and TCS", url: "https://resource.cdn.icai.org/87174bos-aps1794-ch7.pdf", filename: "p3a_ch7.pdf" },
  { paper: "P3A", code: "INT_P3_SECA_CH8", name: "Return of Income", url: "https://resource.cdn.icai.org/87175bos-aps1794-ch8.pdf", filename: "p3a_ch8.pdf" },
  { paper: "P3A", code: "INT_P3_SECA_CH9", name: "Computation of Total Income", url: "https://resource.cdn.icai.org/87176bos-aps1794-ch9.pdf", filename: "p3a_ch9.pdf" },

  // =================== PAPER 3: CASE SCENARIO BOOKLETS ===================
  { paper: "P3A", code: "INT_P3_SECA_CH1", name: "Income-tax Case Scenarios Booklet", url: "https://resource.cdn.icai.org/90935bos-aps4118-p3a.pdf", filename: "p3a_csb.pdf" },
  { paper: "P3B", code: "INT_P3_SECB_CH1", name: "GST Case Scenarios Booklet", url: "https://resource.cdn.icai.org/90936bos-aps4118-p3b.pdf", filename: "p3b_csb.pdf" },
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
  console.log("=== DOWNLOADING CA INTERMEDIATE GROUP 1 MATERIAL ===");

  const baseDir = path.join(__dirname, "../ingestion/intermediate");
  fs.mkdirSync(baseDir, { recursive: true });

  for (const item of ITEMS) {
    const subFolder = item.paper === "P2" ? "paper_2_law" : "paper_3_taxation";
    const dir = path.join(baseDir, subFolder);
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

  console.log("\nAll Group 1 files downloaded and extracted!");
}

main().catch(console.error);
