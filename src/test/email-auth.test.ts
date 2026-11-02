import { expect, it } from "vitest";
import { signupOutcome } from "@/lib/email-auth";

it("requires email confirmation before treating a signup without a session as signed in", () => {
  expect(signupOutcome(false)).toBe("confirm-email");
});
it("only treats signup as signed in when an authenticated session exists", () => {
  expect(signupOutcome(true)).toBe("signed-in");
});