process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
import * as fs from "fs";
import * as path from "path";

const targetDir = path.resolve("rtp_downloads");
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const rtpList = [
  // Jan 2025
  { url: "https://resource.cdn.icai.org/82845bos66922-p1.pdf", name: "rtp_jan2025_p1.pdf" },
  { url: "https://resource.cdn.icai.org/82846bos66922-p2.pdf", name: "rtp_jan2025_p2.pdf" },
  { url: "https://resource.cdn.icai.org/82847bos66922-p3.pdf", name: "rtp_jan2025_p3.pdf" },
  { url: "https://resource.cdn.icai.org/82848bos66922-p4.pdf", name: "rtp_jan2025_p4.pdf" },
  // May 2025
  { url: "https://resource.cdn.icai.org/85933bos-aps655-fnd-acc-p1.pdf", name: "rtp_may2025_p1.pdf" },
  { url: "https://resource.cdn.icai.org/84644bos270225-p2.pdf", name: "rtp_may2025_p2.pdf" },
  { url: "https://resource.cdn.icai.org/84645bos270225-p3.pdf", name: "rtp_may2025_p3.pdf" },
  { url: "https://resource.cdn.icai.org/84646bos270225-p4.pdf", name: "rtp_may2025_p4.pdf" },
  // Sep 2025
  { url: "https://resource.cdn.icai.org/86491bos-aps1065-rtp-fnd-sep2025-acc.pdf", name: "rtp_sep2025_p1.pdf" },
  { url: "https://resource.cdn.icai.org/86492bos-aps1065-rtp-fnd-sep2025-bussiness-law.pdf", name: "rtp_sep2025_p2.pdf" },
  { url: "https://resource.cdn.icai.org/86493bos-aps1065-rtp-fnd-sep2025-quantative-apti.pdf", name: "rtp_sep2025_p3.pdf" },
  { url: "https://resource.cdn.icai.org/86494bos-aps1065-rtp-fnd-sep2025-bussiness-eco.pdf", name: "rtp_sep2025_p4.pdf" },
];

async function main() {
  for (const item of rtpList) {
    const dest = path.join(targetDir, item.name);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 10000) {
      console.log(`Skipping already downloaded ${item.name}`);
      continue;
    }
    console.log(`Downloading ${item.url} -> ${item.name}`);
    try {
      const res = await fetch(item.url);
      if (!res.ok) {
        console.error(`Error fetching ${item.url}: ${res.status}`);
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(dest, buf);
      console.log(`✓ Saved ${item.name} (${buf.length} bytes)`);
    } catch (err) {
      console.error(`Failed to download ${item.name}:`, err);
    }
  }
}

main().catch(console.error);
