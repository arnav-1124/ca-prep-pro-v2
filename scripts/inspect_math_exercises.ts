import fs from "fs";
import path from "path";

const p = path.join(__dirname, "../ingestion/foundation/paper_3_quant/ch5_layout.txt");
const text = fs.readFileSync(p, "utf-8");

console.log(text.substring(78000, 79200));
