import * as fs from "fs";

async function main() {
  const text = fs.readFileSync("test_84774.txt", "utf8");
  const p1AnsText = text.slice(832937, 1216685);

  const idx = p1AnsText.indexOf("28,54,000");
  console.log("Found 28,54,000 at:", idx);
  if (idx !== -1) {
    console.log(p1AnsText.slice(idx - 100, idx + 800));
  }
}

main().catch(console.error);
