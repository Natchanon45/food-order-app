import { spawnSync } from "node:child_process";

const result = spawnSync("java", ["-version"], { encoding: "utf8", timeout: 10000 });
const output = String(result.stderr || "") + "\n" + String(result.stdout || "");
const match = output.match(/\bversion\s+"(\d+)(?:\.(\d+))?/);
const major = match
  ? (Number(match[1]) === 1 ? Number(match[2]) : Number(match[1]))
  : null;
if (result.error || result.status !== 0 || !Number.isInteger(major) || major < 21) {
  console.error([
    "Firebase Emulator requires JDK 21 or newer (java detected: " +
      (major === null ? "unavailable/unknown" : major) + ").",
    "On macOS with Homebrew:",
    "  brew install openjdk@21",
    '  export JAVA_HOME="$(brew --prefix openjdk@21)/libexec/openjdk.jdk/Contents/Home"',
    '  export PATH="$JAVA_HOME/bin:$PATH"',
    "  java -version",
    "",
    "JDK 17 can remain installed. This Terminal session must use JDK 21+.",
    "Firebase and Firestore production have NOT been accessed by this check.",
  ].join("\n"));
  process.exit(1);
}
console.log("Firebase Emulator JDK preflight: Java " + major + " OK.");
