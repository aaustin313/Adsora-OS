const fs = require('fs');
const path = require('path');

const VISA_DIR = path.resolve(__dirname, '../output/visa-evidence');
const files = fs.readdirSync(VISA_DIR).filter(f => f.endsWith('.html'));

const SOLID_PURPLE = '#818cf8';
const SOLID_CYAN = '#06b6d4';
const SOLID_AMBER = '#f59e0b';

let totalChanges = 0;

for (const file of files) {
  const filePath = path.join(VISA_DIR, file);
  let html = fs.readFileSync(filePath, 'utf8');
  const original = html;

  // Replace .gradient-text CSS class definitions (various formats)
  // Format 1: single-line with just background + clip + fill
  html = html.replace(
    /\.gradient-text\s*\{[^}]*background:\s*linear-gradient\(135deg,\s*#6366f1,\s*#a855f7\)[^}]*\}/g,
    `.gradient-text { color: ${SOLID_PURPLE}; }`
  );

  // Replace .gradient-text-cyan CSS class definitions
  html = html.replace(
    /\.gradient-text-cyan\s*\{[^}]*background:\s*linear-gradient\(135deg,\s*#06b6d4,\s*#10b981\)[^}]*\}/g,
    `.gradient-text-cyan { color: ${SOLID_CYAN}; }`
  );

  // Replace .gradient-text-amber CSS class definitions
  html = html.replace(
    /\.gradient-text-amber\s*\{[^}]*background:\s*linear-gradient\(135deg,\s*#f59e0b,\s*#ef4444\)[^}]*\}/g,
    `.gradient-text-amber { color: ${SOLID_AMBER}; }`
  );

  // Replace .logo classes that use gradient text (keep other logo properties)
  html = html.replace(
    /\.logo\s*\{([^}]*?)background:\s*linear-gradient\(135deg,\s*#6366f1,\s*#a855f7\);\s*-webkit-background-clip:\s*text;\s*-webkit-text-fill-color:\s*transparent;/g,
    `.logo {$1color: ${SOLID_PURPLE};`
  );

  // Also handle .slide-footer .logo variant
  html = html.replace(
    /\.slide-footer\s+\.logo\s*\{([^}]*?)background:\s*linear-gradient\(135deg,\s*#6366f1,\s*#a855f7\);\s*-webkit-background-clip:\s*text;\s*(?:background-clip:\s*text;\s*)?-webkit-text-fill-color:\s*transparent;(?:\s*color:\s*transparent;)?/g,
    `.slide-footer .logo {$1color: ${SOLID_PURPLE};`
  );

  // Replace inline gradient styles on specific elements
  html = html.replace(
    /background:\s*linear-gradient\(135deg,\s*#6366f1,\s*#a855f7\);\s*-webkit-background-clip:\s*text;\s*(?:background-clip:\s*text;\s*)?-webkit-text-fill-color:\s*transparent;(?:\s*color:\s*transparent;)?/g,
    `color: ${SOLID_PURPLE};`
  );

  html = html.replace(
    /background:\s*linear-gradient\(135deg,\s*#06b6d4,\s*#10b981\);\s*-webkit-background-clip:\s*text;\s*(?:background-clip:\s*text;\s*)?-webkit-text-fill-color:\s*transparent;(?:\s*color:\s*transparent;)?/g,
    `color: ${SOLID_CYAN};`
  );

  html = html.replace(
    /background:\s*linear-gradient\(135deg,\s*#f59e0b,\s*#ef4444\);\s*-webkit-background-clip:\s*text;\s*(?:background-clip:\s*text;\s*)?-webkit-text-fill-color:\s*transparent;(?:\s*color:\s*transparent;)?/g,
    `color: ${SOLID_AMBER};`
  );

  // Handle the multi-line CSS in files 01 and 05 (the .stat-value and similar classes)
  // These have background/clip on separate lines
  html = html.replace(
    /background:\s*linear-gradient\(135deg,\s*#6366f1,\s*#a855f7\);\s*\n\s*-webkit-background-clip:\s*text;\s*\n\s*-webkit-text-fill-color:\s*transparent;\s*\n\s*background-clip:\s*text;\s*\n\s*color:\s*transparent;/g,
    `color: ${SOLID_PURPLE};`
  );

  html = html.replace(
    /background:\s*linear-gradient\(135deg,\s*#06b6d4,\s*#10b981\);\s*\n\s*-webkit-background-clip:\s*text;\s*\n\s*-webkit-text-fill-color:\s*transparent;\s*\n\s*background-clip:\s*text;\s*\n\s*color:\s*transparent;/g,
    `color: ${SOLID_CYAN};`
  );

  // Also handle inline style with background:linear-gradient on the +19% span in file 02
  html = html.replace(
    /style="background:linear-gradient\(135deg,#10b981,#06b6d4\);\s*-webkit-background-clip:text;\s*background-clip:text;"/g,
    `style="color: ${SOLID_CYAN};"`
  );

  if (html !== original) {
    fs.writeFileSync(filePath, html);
    totalChanges++;
    console.log(`Fixed: ${file}`);
  } else {
    console.log(`No changes: ${file}`);
  }
}

console.log(`\nDone — ${totalChanges} files updated.`);
