// Guards the readable runtime version (native-1, native-2, ...).
// The name in app.json is only safe if the native layer still matches the
// fingerprint recorded for it. Otherwise an OTA update could reach a build
// that lacks the native code it needs, and crash on her phone.
//
// Usage: node scripts/check-runtime.mjs            -> check, exit 1 on mismatch
//        node scripts/check-runtime.mjs --print    -> print name and fingerprint only
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const app = JSON.parse(readFileSync('app.json', 'utf8')).expo;
const registry = JSON.parse(readFileSync('runtime-versions.json', 'utf8')).versions;
const name = app.runtimeVersion;

if (typeof name !== 'string' || !/^native-\d+$/.test(name)) {
  console.error(`app.json runtimeVersion must look like "native-N", got ${JSON.stringify(name)}`);
  process.exit(1);
}

const out = execFileSync('npx', ['--no-install', 'expo-updates', 'fingerprint:generate', '--platform', 'ios'], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'ignore'],
});
const hash = JSON.parse(out).hash;

console.log(`Runtime version: ${name}`);
console.log(`Fingerprint:     ${hash}`);
if (process.argv.includes('--print')) process.exit(0);

const entry = registry[name];
if (!entry) {
  console.error(`\n✗ ${name} is not in runtime-versions.json. Add it with fingerprint ${hash}.`);
  process.exit(1);
}
if (entry.fingerprint !== hash) {
  const next = `native-${Number(name.split('-')[1]) + 1}`;
  console.error(
    `\n✗ The native layer changed since ${name} (recorded ${entry.fingerprint.slice(0, 8)}, now ${hash.slice(0, 8)}).` +
      `\n  Builds already installed will NOT run this code safely.` +
      `\n  Either undo the native change, or: set runtimeVersion to "${next}" in app.json,` +
      `\n  add "${next}" to runtime-versions.json (run with --print for its fingerprint),` +
      `\n  and build both phones (preview + production) before sending updates.`,
  );
  process.exit(1);
}
console.log(`✓ ${name} matches. OTA updates from this code are safe for ${name} builds.`);
