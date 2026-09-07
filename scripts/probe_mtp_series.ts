process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function main() {
  console.log("Probing MTP series and paper numbers on boslive.icai.org/mock_test_paper/...");

  // We know MTP_48_54_QUESTIONS_1746181640.pdf is Paper 1 Accounting (May 2025 Series II).
  // Let's test if we can find answers for 48_54 or questions for 48_55, 48_56, 48_57 (Papers 2, 3, 4)
  // or other series IDs like 45, 46, 47, 49, 50...
  
  // Also let's check if the directory allows listing or if head requests work
  const testUrls = [
    "https://boslive.icai.org/mock_test_paper/MTP_48_54_QUESTIONS_1746181640.pdf",
    "https://boslive.icai.org/mock_test_paper/MTP_48_54_ANSWERS_1746181640.pdf",
  ];

  for (const u of testUrls) {
    const res = await fetch(u, { method: "HEAD" });
    console.log(`[${res.status}] ${u}`);
  }
}

main().catch(console.error);
