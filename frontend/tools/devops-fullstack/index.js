#!/usr/bin/env node

import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const cwd = process.cwd();
const viteBin = path.join(cwd, "node_modules", "vite", "bin", "vite.js");

if (!existsSync(viteBin)) {
  console.error("vite is not installed in node_modules.");
  process.exit(1);
}

const result = spawnSync(process.execPath, [viteBin, "build", "--base=./"], {
  cwd,
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
