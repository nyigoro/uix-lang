import fs from "fs";
import peggy from "peggy";

const grammar = fs.readFileSync("compiler/uix.pegjs", "utf-8");

const parserCode = peggy.generate(grammar, {
  output: "source",
  format: "es" // ✅ Peggy supports this!
});

fs.writeFileSync("compiler/parser.js", parserCode);
console.log("✅ Parser built as ESM: compiler/parser.js");
