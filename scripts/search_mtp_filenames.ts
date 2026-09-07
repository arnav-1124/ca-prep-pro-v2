async function searchDDG(q: string) {
  const url = 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(q);
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  const html = await res.text();
  const linkRegex = /<a class="result__url"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  const results: string[] = [];
  while ((m = linkRegex.exec(html)) !== null) {
    let raw = m[1];
    if (raw.includes('uddg=')) {
      const u = new URL('https://duckduckgo.com' + raw);
      raw = decodeURIComponent(u.searchParams.get('uddg') || raw);
    }
    results.push(raw);
  }
  return results;
}

async function main() {
  const queries = [
    'site:boslive.icai.org/mock_test_paper/ MTP_48_',
    'site:boslive.icai.org/mock_test_paper/ MTP_50_',
    'site:boslive.icai.org/mock_test_paper/ MTP_47_',
    'site:boslive.icai.org/mock_test_paper/ MTP_49_',
    'site:boslive.icai.org/mock_test_paper/ MTP_53_',
    'site:boslive.icai.org/mock_test_paper/ MTP_54_',
    'site:boslive.icai.org/mock_test_paper/ MTP_55_',
    'site:boslive.icai.org/mock_test_paper/ 56',
    'site:boslive.icai.org/mock_test_paper/ 57',
    'site:boslive.icai.org/mock_test_paper/ "QUESTIONS"',
    'site:boslive.icai.org/mock_test_paper/ "ANSWERS"'
  ];
  for (const q of queries) {
    console.log('\nQ:', q);
    const res = await searchDDG(q);
    res.forEach(r => console.log('  ->', r));
    await new Promise(r => setTimeout(r, 500));
  }
}
main().catch(console.error);
