import { spawnSync } from "node:child_process";

function runPrisma(args) {
  const result = spawnSync("prisma", args, {
    encoding: "utf8",
    stdio: "pipe",
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  return result;
}

const migrate = runPrisma(["migrate", "deploy"]);
if (migrate.status === 0) {
  process.exit(0);
}

const migrateOutput = `${migrate.stdout || ""}\n${migrate.stderr || ""}`;
const isBaselineError = migrateOutput.includes("P3005");

if (!isBaselineError) {
  process.exit(typeof migrate.status === "number" ? migrate.status : 1);
}

process.stdout.write(
  "\n[prisma-deploy-safe] Detectado P3005 (baseline). Se aplica `prisma db push` para sincronizar esquema.\n"
);

const push = runPrisma(["db", "push"]);
process.exit(typeof push.status === "number" ? push.status : 1);
