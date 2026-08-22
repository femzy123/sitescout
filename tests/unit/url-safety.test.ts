import { describe, expect, it } from "vitest";
import { isPrivateAddress } from "@/server/services/audit/url-safety";

describe("audit network safety", () => {
  it.each([
    "127.0.0.1",
    "10.2.3.4",
    "172.16.0.1",
    "192.168.1.9",
    "169.254.169.254",
    "::1",
    "fd00::1",
  ])("blocks private address %s", (address) => {
    expect(isPrivateAddress(address)).toBe(true);
  });

  it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"])(
    "allows public address %s",
    (address) => {
      expect(isPrivateAddress(address)).toBe(false);
    },
  );
});
