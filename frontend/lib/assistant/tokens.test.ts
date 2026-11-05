import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractExactTokens } from "./tokens";

describe("extractExactTokens", () => {
  it("finds a hex error code", () => {
    assert.deepEqual(extractExactTokens("Autopilot fails with 0x80180014 on enrol"), ["0x80180014"]);
  });

  it("finds TechBase and Windows KB ids", () => {
    assert.deepEqual(extractExactTokens("see KB-IT-1042 and KB5034441"), ["KB-IT-1042", "KB5034441"]);
  });

  it("finds Oracle-style and event id codes", () => {
    assert.deepEqual(extractExactTokens("ORA-12541 after Event ID 4625"), ["ORA-12541", "Event ID 4625"]);
  });

  it("finds a PowerShell cmdlet", () => {
    assert.deepEqual(extractExactTokens("run Get-WindowsAutopilotInfo now"), ["Get-WindowsAutopilotInfo"]);
  });

  it("dedupes case-insensitively, keeping first casing and order", () => {
    assert.deepEqual(extractExactTokens("0x80180014 again 0X80180014"), ["0x80180014"]);
  });

  it("returns nothing for ordinary prose", () => {
    assert.deepEqual(extractExactTokens("why can't I sign in after a password change"), []);
  });
});
