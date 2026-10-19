import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { accountEmail, accountName, deleteAccountBlock, disableSignInBlock, roleChangeBlock } from "./user-directory";

describe("user directory guards", () => {
  it("refuses an admin demoting themselves", () => {
    assert.equal(
      roleChangeBlock({
        actorId: "joe",
        targetId: "joe",
        targetRole: "admin",
        nextRole: "author",
        enabledAdminIds: ["joe", "sarah"],
      }),
      "self",
    );
  });

  it("refuses demoting the last admin who can still sign in", () => {
    assert.equal(
      roleChangeBlock({
        actorId: "joe",
        targetId: "sarah",
        targetRole: "admin",
        nextRole: "reviewer",
        enabledAdminIds: ["sarah"],
      }),
      "last",
    );
  });

  it("allows demoting an admin when another admin can still sign in", () => {
    assert.equal(
      roleChangeBlock({
        actorId: "joe",
        targetId: "sarah",
        targetRole: "admin",
        nextRole: "author",
        enabledAdminIds: ["joe", "sarah"],
      }),
      null,
    );
  });

  it("refuses turning off your own sign-in or the last admin", () => {
    assert.equal(
      disableSignInBlock({
        actorId: "joe",
        targetId: "joe",
        targetRole: "admin",
        enabledAdminIds: ["joe"],
      }),
      "self",
    );
    assert.equal(
      disableSignInBlock({
        actorId: "joe",
        targetId: "sarah",
        targetRole: "admin",
        enabledAdminIds: ["sarah"],
      }),
      "last",
    );
  });

  it("refuses deleting yourself or the last admin", () => {
    assert.equal(
      deleteAccountBlock({
        actorId: "joe",
        targetId: "joe",
        targetRole: "admin",
        enabledAdminIds: ["joe", "sarah"],
      }),
      "self",
    );
    assert.equal(
      deleteAccountBlock({
        actorId: "joe",
        targetId: "sarah",
        targetRole: "admin",
        enabledAdminIds: ["sarah"],
      }),
      "last",
    );
  });

  it("accepts a display name and a normal email", () => {
    assert.equal(accountName("  Ada   Lovelace "), "Ada Lovelace");
    assert.equal(accountName("A"), null);
    assert.equal(accountEmail("Ada@Contoso.com"), "ada@contoso.com");
    assert.equal(accountEmail("not-an-email"), null);
  });
});
