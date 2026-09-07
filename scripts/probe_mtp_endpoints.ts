process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function main() {
  const endpoints = [
    "https://boslive.icai.org/ajax_get_mock_test_paper.php",
    "https://boslive.icai.org/get_mock_test_paper.php",
    "https://boslive.icai.org/mock_test_paper_ajax.php",
    "https://boslive.icai.org/get_paper.php",
    "https://boslive.icai.org/get_series.php",
    "https://boslive.icai.org/api/get_mtp.php",
    "https://boslive.icai.org/student_mock_test.php",
    "https://boslive.icai.org/mock_test_paper_list.php",
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep, { method: "POST" });
      console.log(`[POST] ${ep} -> ${res.status}`);
      if (res.ok) {
        const text = await res.text();
        console.log(`  Length: ${text.length}, sample: ${text.slice(0, 100)}`);
      }
    } catch (e: any) {
      console.log(`[ERR] ${ep}: ${e.message}`);
    }
  }
}

main().catch(console.error);
