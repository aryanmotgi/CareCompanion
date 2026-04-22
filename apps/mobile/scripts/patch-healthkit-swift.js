#!/usr/bin/env node
/**
 * Patches @kingstinct/react-native-healthkit Swift files to remove trailing
 * commas in function call argument lists.
 *
 * Background: healthkit v13.x uses Swift trailing commas (SE-0430) which
 * require Swift 5.10 / Xcode 15.3+. EAS build images with older Xcode fail
 * with "unexpected ',' separator". This script strips the trailing commas so
 * the code compiles on any Xcode version.
 *
 * Runs as a bun postinstall step so the files are patched before CocoaPods
 * copies/references them during `pod install`.
 */

const fs = require('fs');
const path = require('path');

let pkgDir;
try {
  // Resolve the real path — handles both symlinks and direct installs
  const pkgMain = require.resolve('@kingstinct/react-native-healthkit/package.json');
  pkgDir = path.dirname(pkgMain);
} catch {
  console.log('[patch-healthkit] Package not found — skipping patch');
  process.exit(0);
}

const iosDir = path.join(pkgDir, 'ios');
if (!fs.existsSync(iosDir)) {
  console.log('[patch-healthkit] No ios/ directory found — skipping patch');
  process.exit(0);
}

let patchCount = 0;

for (const file of fs.readdirSync(iosDir)) {
  if (!file.endsWith('.swift')) continue;
  const filePath = path.join(iosDir, file);

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    // Symlink might not be writable — skip
    continue;
  }

  const original = content;

  // Remove trailing commas that appear as the last argument before a closing
  // paren on the next line.  Pattern: line ends with ",\n" and next non-blank
  // token is ")" (optionally followed by " {" for trailing closure syntax).
  //
  // We match:   <label>: <value>,\n  [whitespace])
  // and replace with:   <label>: <value>\n  [whitespace])
  //
  // Using a line-by-line approach to avoid false positives.
  const lines = content.split('\n');
  for (let i = 0; i < lines.length - 1; i++) {
    if (!lines[i].trimEnd().endsWith(',')) continue;
    // Find the next non-blank line
    let nextIdx = i + 1;
    while (nextIdx < lines.length && lines[nextIdx].trim() === '') nextIdx++;
    if (nextIdx >= lines.length) continue;
    const nextTrimmed = lines[nextIdx].trim();
    // Only patch when next line is a bare closing paren (possibly with trailing closure)
    if (/^\)(\s*\{.*)?$/.test(nextTrimmed)) {
      lines[i] = lines[i].trimEnd().slice(0, -1); // remove trailing comma
      patchCount++;
    }
  }

  content = lines.join('\n');

  if (content !== original) {
    try {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`[patch-healthkit] Patched ${file} (${patchCount} trailing comma(s) removed so far)`);
    } catch (err) {
      // File may be read-only in bun cache — try making it writable first
      try {
        fs.chmodSync(filePath, 0o644);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`[patch-healthkit] Patched ${file} (chmod+write)`);
      } catch (err2) {
        console.warn(`[patch-healthkit] Could not write ${file}: ${err2.message}`);
      }
    }
  }
}

if (patchCount === 0) {
  console.log('[patch-healthkit] No trailing commas found — already clean or different version');
} else {
  console.log(`[patch-healthkit] Done — removed ${patchCount} trailing comma(s) from healthkit Swift files`);
}
