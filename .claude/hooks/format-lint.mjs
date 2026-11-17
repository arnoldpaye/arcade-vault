// Hook PostToolUse (Write|Edit): deja conciso el archivo que Claude acaba de crear o editar.
// 1. Prettier formatea el archivo (respeta .prettierrc.json y .prettierignore).
// 2. Se eliminan todas las líneas en blanco:
//    - JS/TS: ESLint --fix con `no-multiple-empty-lines` en max 0 (no toca template literals).
//    - CSS/JSON: se eliminan con una expresión regular.
//    - Markdown y demás formatos no se tocan: ahí las líneas en blanco tienen significado.
// 3. ESLint aplica sus correcciones automáticas (reglas de eslint.config.mjs).
// Exit 2 si quedan errores de ESLint, para que Claude los reciba y corrija.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ESLint } from "eslint";
import * as prettier from "prettier";
const LINTABLE = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".mts", ".cts"]);
const STRIP_BLANK_LINES = new Set([".css", ".scss", ".json"]);
function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
  });
}
const input = JSON.parse((await readStdin()) || "{}");
const filePath = input?.tool_input?.file_path;
const projectDir = path.resolve(process.env.CLAUDE_PROJECT_DIR || input?.cwd || process.cwd());
if (!filePath) process.exit(0);
const abs = path.resolve(projectDir, filePath);
const rel = path.relative(projectDir, abs);
// Solo archivos existentes dentro del proyecto.
if (!existsSync(abs) || rel.startsWith("..") || path.isAbsolute(rel)) process.exit(0);
const ext = path.extname(abs).toLowerCase();
const original = readFileSync(abs, "utf8");
let text = original;
// 1. Prettier.
try {
  const info = await prettier.getFileInfo(abs, {
    ignorePath: path.join(projectDir, ".prettierignore"),
  });
  if (info.ignored) process.exit(0);
  if (info.inferredParser) {
    const options = (await prettier.resolveConfig(abs)) ?? {};
    text = await prettier.format(text, { ...options, filepath: abs });
  }
} catch (error) {
  process.stderr.write(`[format-lint] Prettier falló en ${rel}:\n${error.message}\n`);
}
// 2. Líneas en blanco en CSS/JSON.
if (STRIP_BLANK_LINES.has(ext)) text = text.replace(/\n[ \t]*(?=\n)/g, "");
// 3. ESLint (+ eliminación de líneas en blanco en JS/TS).
let lintErrors = "";
if (LINTABLE.has(ext)) {
  const eslint = new ESLint({
    cwd: projectDir,
    fix: true,
    overrideConfig: {
      rules: { "no-multiple-empty-lines": ["error", { max: 0, maxBOF: 0, maxEOF: 0 }] },
    },
  });
  const [result] = await eslint.lintText(text, { filePath: abs, warnIgnored: false });
  if (result) {
    if (result.output !== undefined) text = result.output;
    if (result.errorCount > 0) {
      const formatter = await eslint.loadFormatter("stylish");
      lintErrors = await formatter.format([result]);
    }
  }
}
if (text !== original) writeFileSync(abs, text, "utf8");
if (lintErrors) {
  process.stderr.write(`[format-lint] ESLint encontró errores en ${rel}:\n${lintErrors}\n`);
  process.exit(2);
}
process.exit(0);
