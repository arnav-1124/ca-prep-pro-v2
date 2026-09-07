import fs from "fs";
import path from "path";

interface BatchQuestion {
  canonicalNodeCode?: string;
  questionText: string;
  options: { letter: string; text: string }[];
  correctAnswer: string;
  explanation?: string;
}

interface BatchFile {
  questions: BatchQuestion[];
}

function scanDir(dir: string, fileList: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(full, fileList);
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      fileList.push(full);
    }
  }
  return fileList;
}

async function main() {
  const dirs = [
    path.join(process.cwd(), "ingestion", "batches"),
    path.join(process.cwd(), "rtp_batches"),
  ];

  let totalQuestions = 0;
  const anomalies: { file: string; type: string; details: string }[] = [];

  for (const d of dirs) {
    if (!fs.existsSync(d)) continue;
    const jsonFiles = scanDir(d);

    for (const jf of jsonFiles) {
      try {
        const raw = fs.readFileSync(jf, "utf8");
        const relPath = path.relative(process.cwd(), jf);
        const data = JSON.parse(raw) as BatchFile;
        if (!data.questions || !Array.isArray(data.questions)) continue;

        let dummyOptCount = 0;
        let brokenCharCount = 0;
        let allACount = 0;

        for (let idx = 0; idx < data.questions.length; idx++) {
          const q = data.questions[idx];
          totalQuestions++;

          // Check dummy options
          for (const opt of q.options || []) {
            if (/^Option\s+[A-D]$/i.test(opt.text.trim())) {
              dummyOptCount++;
              anomalies.push({
                file: relPath,
                type: "DUMMY_OPTION",
                details: `Q#${idx + 1} (${q.canonicalNodeCode || "N/A"}): "${q.questionText.slice(0, 40)}..." has option "${opt.text}"`,
              });
            }
          }

          // Check broken characters (e.g. \uFFFD)
          if (q.questionText.includes("\uFFFD") || (q.options || []).some(o => o.text.includes("\uFFFD"))) {
            brokenCharCount++;
          }
        }

        const aRatio = data.questions.filter(q => q.correctAnswer === "A").length / data.questions.length;
        console.log(`${relPath.padEnd(55)}: ${data.questions.length} questions | Dummy Opts: ${dummyOptCount} | Broken Chars: ${brokenCharCount} | 'A' Ratio: ${(aRatio * 100).toFixed(1)}%`);

      } catch (err) {
        console.error(`Failed to parse ${jf}:`, err);
      }
    }
  }

  console.log(`\nTotal questions across all batch JSONs: ${totalQuestions}`);
  console.log(`Total dummy option anomalies found: ${anomalies.length}`);
  if (anomalies.length > 0) {
    console.log("\nSample anomalies:");
    for (const a of anomalies.slice(0, 15)) {
      console.log(`[${a.type}] ${a.file} -> ${a.details}`);
    }
  }
}

main().catch(console.error);
