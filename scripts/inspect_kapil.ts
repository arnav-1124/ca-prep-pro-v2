import * as fs from "fs";

async function main() {
  const text = fs.readFileSync("test_84774.txt", "utf8");
  const idx = text.indexOf("Kapil entered in a contract with Rahul");
  console.log("Found at:", idx);
  if (idx !== -1) {
    console.log("--- ORIGINAL RAW TEXT ---");
    console.log(text.slice(idx - 50, idx + 1000));
  }
}

main().catch(console.error);
