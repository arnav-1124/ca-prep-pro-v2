process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function checkPages() {
  const pages = [
    "https://boslive.icai.org/mock_test_paper.php",
    "https://boslive.icai.org/mock_test_paper.php?course=foundation",
    "https://boslive.icai.org/education_content.php?p=Foundation&c=foundation",
    "https://boslive.icai.org/mock_test_paper_series.php",
    "https://boslive.icai.org/mock_test_paper_series.php?course=foundation",
    "https://boslive.icai.org/mtp.php?course=foundation",
    "https://boslive.icai.org/student_mock_test_paper.php",
    "https://boslive.icai.org/student_mock_test_paper.php?course=foundation",
  ];

  for (const p of pages) {
    try {
      const res = await fetch(p);
      console.log(`[${res.status}] ${p} (length: ${res.headers.get("content-length") || "unknown"})`);
      if (res.ok) {
        const text = await res.text();
        if (text.includes("MTP") || text.includes("Mock") || text.includes(".pdf")) {
          console.log(`   -> Contains MTP/Mock content (length: ${text.length})`);
          // find any pdf links
          const pdfs = text.match(/href=["']([^"']+\.pdf)["']/gi);
          if (pdfs) {
            console.log(`   -> Found ${pdfs.length} PDFs:`, pdfs.slice(0, 5));
          }
        }
      }
    } catch (e: any) {
      console.log(`[ERR] ${p}:`, e.message);
    }
  }
}

checkPages().catch(console.error);
