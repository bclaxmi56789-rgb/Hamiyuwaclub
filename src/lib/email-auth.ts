export function signupOutcome(hasSession: boolean): "signed-in" | "confirm-email" {
  return hasSession ? "signed-in" : "confirm-email";
}