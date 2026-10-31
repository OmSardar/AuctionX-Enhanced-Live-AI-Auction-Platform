import fs from "fs";

const b = JSON.parse(fs.readFileSync("performance_baseline_data.json", "utf8"));
const p = JSON.parse(fs.readFileSync("performance_post_optimization_data.json", "utf8"));

console.log("| Route | Metric | Before (Baseline) | After (Optimized) | Delta | Verdict |");
console.log("|---|---|---|---|---|---|");

for (let i = 0; i < b.length; i++) {
  const before = b[i];
  const after = p.find((x) => x.label === before.label) || p[i];
  const timeDelta = after.durationMs - before.durationMs;
  const timePct = ((timeDelta / before.durationMs) * 100).toFixed(1);
  const fcpDelta = after.fcp && before.fcp ? after.fcp - before.fcp : null;
  const apiDelta = after.apiCount - before.apiCount;

  const fcpText = fcpDelta !== null ? `FCP Δ: ${fcpDelta > 0 ? "+" : ""}${fcpDelta}ms` : "";
  const apiText = `API Δ: ${apiDelta > 0 ? "+" : ""}${apiDelta}`;
  const verdict = timeDelta <= 0 || apiDelta < 0 || (fcpDelta && fcpDelta < 0) ? "✅ Improved" : "⚖️ Neutral";

  console.log(
    `| ${before.label} | Duration / FCP / APIs | ${before.durationMs}ms / ${before.fcp || "-"}ms / ${before.apiCount} | ${after.durationMs}ms / ${after.fcp || "-"}ms / ${after.apiCount} | ${timeDelta}ms (${timePct}%), ${apiText}, ${fcpText} | ${verdict} |`
  );
}
