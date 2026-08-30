#!/usr/bin/env node
/**
 * Extrae los 4 datasets grandes que hoy viven embebidos dentro del <script> del
 * index.html original (DEFAULT_BALANZA, DEFAULT_HECTAREAS, DEFAULT_TAREO,
 * DEFAULT_CALIBRES) y los escribe, tal cual, en js/data-seed.js — como parte de la
 * migración a la estructura modular. No transforma los datos, solo los mueve de
 * archivo, así que es seguro correrlo directo contra tu index.html de producción.
 *
 * Uso:
 *   node scripts/extract-data-defaults.js [ruta-al-index-original.html]
 *
 * Por defecto busca ../index-original.html junto a este script (renombra tu
 * index.html actual a ese nombre antes de correrlo, o pasa la ruta como argumento).
 */
const fs = require('fs');
const path = require('path');

const SOURCE = process.argv[2] || path.join(__dirname, '..', 'index-original.html');
const OUTPUT = path.join(__dirname, '..', 'js', 'data-seed.js');

const VARS = ['DEFAULT_BALANZA', 'DEFAULT_HECTAREAS', 'DEFAULT_TAREO', 'DEFAULT_CALIBRES'];

function extractArrayLiteral(source, varName) {
  const marker = `const ${varName} = `;
  const start = source.indexOf(marker);
  if (start === -1) {
    throw new Error(`No encontré "${marker}" en ${SOURCE}. ¿Es el archivo correcto?`);
  }
  let i = start + marker.length;
  if (source[i] !== '[') {
    throw new Error(`Después de "${marker}" esperaba un "[" y encontré "${source[i]}".`);
  }
  let depth = 0;
  let inString = null; // '"' o "'" mientras estamos dentro de un string
  let escaped = false;
  const arrStart = i;
  for (; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (escaped) { escaped = false; }
      else if (ch === '\\') { escaped = true; }
      else if (ch === inString) { inString = null; }
      continue;
    }
    if (ch === '"' || ch === "'") { inString = ch; continue; }
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) { i++; break; }
    }
  }
  const literal = source.slice(arrStart, i);
  return literal;
}

function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error(`No encuentro el archivo fuente: ${SOURCE}`);
    console.error('Pásalo como argumento: node scripts/extract-data-defaults.js /ruta/a/tu-index.html');
    process.exit(1);
  }
  const source = fs.readFileSync(SOURCE, 'utf8');
  const parts = [
    '/* ============ DATASETS GRANDES (generado automáticamente) ============ */',
    '/* Este archivo se genera con scripts/extract-data-defaults.js — no lo edites a mano.',
    '   Para refrescarlo (ej. después de "Restablecer datos base" en producción), vuelve a',
    '   correr el script contra el index.html vigente en ese momento. */',
    '',
  ];
  for (const varName of VARS) {
    const literal = extractArrayLiteral(source, varName);
    parts.push(`const ${varName} = ${literal};`);
  }
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, parts.join('\n') + '\n', 'utf8');
  console.log(`Listo. Escribí ${VARS.length} datasets en ${path.relative(process.cwd(), OUTPUT)}`);
}

main();
