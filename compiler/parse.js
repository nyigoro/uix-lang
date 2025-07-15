import fs from "fs";
import chalk from "chalk";
import * as parser from "./parser.js";

const code = fs.readFileSync("uix/example.uix", "utf-8");

try {
  const ast = parser.parse(code);
  console.log(chalk.green("✅ Parsed UIX AST:\n"));
  console.dir(ast, { depth: null });
} catch (err) {
  console.error(chalk.red("❌ Parse Error:\n"), err.message);
}
