import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const SEED = 42;
const TRAIN_RATIO = 0.9;

// Simple seeded PRNG (mulberry32)
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const dir = import.meta.dirname;
const inputPath = resolve(dir, "..", "data", "sft-synthesis-train.jsonl");
const lines = readFileSync(inputPath, "utf-8").trim().split("\n");

const rand = mulberry32(SEED);
const shuffled = shuffle(lines, rand);

const splitIdx = Math.round(shuffled.length * TRAIN_RATIO);
const train = shuffled.slice(0, splitIdx);
const eval_ = shuffled.slice(splitIdx);

const trainPath = resolve(dir, "..", "data", "synthesis-train.jsonl");
const evalPath = resolve(dir, "..", "data", "synthesis-eval.jsonl");

writeFileSync(trainPath, train.join("\n") + "\n");
writeFileSync(evalPath, eval_.join("\n") + "\n");

console.log(`Total examples: ${shuffled.length}`);
console.log(`Train: ${train.length} → ${trainPath}`);
console.log(`Eval:  ${eval_.length} → ${evalPath}`);
