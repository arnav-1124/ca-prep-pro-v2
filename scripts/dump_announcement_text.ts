process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

async function main() {
  for (const id of [450, 510]) {
    const url = `https://boslive.icai.org/announcement_details.php?id=${id}`;
    const res = await fetch(url);
    const html = await res.text();
    // find main container
    const clean = html.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<script[\s\S]*?<\/script>/gi, "");
    console.log(`\n=== ID ${id} ===`);
    const match = clean.match(/<div class="card-body">([\s\S]*?)<\/div>/i) || clean.match(/<section[^>]*>([\s\S]*?)<\/section>/i);
    if (match) {
      console.log(match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 1000));
    } else {
      console.log(clean.slice(0, 1000));
    }
  }
}

main().catch(console.error);
