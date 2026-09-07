async function inspectBosFoundation() {
  const res = await fetch("https://boslive.icai.org/education_content.php?p=Foundation&c=foundation");
  const html = await res.text();
  
  const linkRegex = /href=["']([^"']+)["']/gi;
  let m;
  const links = new Set<string>();
  while ((m = linkRegex.exec(html)) !== null) {
    links.add(m[1]);
  }
  console.log("All Links on Foundation page:");
  for (const l of links) {
    if (l.includes("education_content") || l.includes("subject") || l.includes("pdf") || l.includes("mod")) {
      console.log("  ", l);
    }
  }
}

inspectBosFoundation().then(() => process.exit(0));
