#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT
javac -encoding UTF-8 -d "$OUT" \
  "$ROOT/app/src/main/java/com/lukkaja/companion/CompanionParser.java" \
  "$ROOT/app/src/main/java/com/lukkaja/companion/CompanionLineRecovery.java" \
  "$ROOT/app/src/main/java/com/lukkaja/companion/CompanionGroupBuffer.java" \
  "$ROOT/parser-tests/CompanionParserSelfTest.java" \
  "$ROOT/app/src/main/java/com/lukkaja/companion/CompanionUiVisibility.java" \
  "$ROOT/parser-tests/CompanionUiVisibilitySelfTest.java"
java -cp "$OUT" com.lukkaja.companion.CompanionParserSelfTest
java -cp "$OUT" com.lukkaja.companion.CompanionUiVisibilitySelfTest
