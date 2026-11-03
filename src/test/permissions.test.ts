import { describe, it, expect } from "vitest";
import {
  getPageAccessLevel,
  canViewPage,
  canEditPage,
  APP_NAV_PAGES,
  type EmployeePermission,
} from "@/lib/permissions";

describe("Employee Page Permissions (Access Control)", () => {
  const samplePermissions: EmployeePermission[] = [
    {
      employee_id: "emp-1",
      page_path: "/masters",
      access_level: "full_access",
    },
    {
      employee_id: "emp-1",
      page_path: "/expenses",
      access_level: "read_only",
    },
    {
      employee_id: "emp-1",
      page_path: "/settings",
      access_level: "no_access",
    },
    {
      employee_id: "emp-2",
      page_path: "/expenses",
      access_level: "no_access",
    },
  ];

  it("gives full access when no employeeId is set (Admin / Owner mode)", () => {
    expect(getPageAccessLevel(samplePermissions, null, "/masters")).toBe("full_access");
    expect(canViewPage(samplePermissions, null, "/settings")).toBe(true);
    expect(canEditPage(samplePermissions, null, "/settings")).toBe(true);
  });

  it("correctly identifies full_access (Edit/Create permitted)", () => {
    expect(getPageAccessLevel(samplePermissions, "emp-1", "/masters")).toBe("full_access");
    expect(canViewPage(samplePermissions, "emp-1", "/masters")).toBe(true);
    expect(canEditPage(samplePermissions, "emp-1", "/masters")).toBe(true);
  });

  it("correctly identifies read_only (View only, No Edit/Create)", () => {
    expect(getPageAccessLevel(samplePermissions, "emp-1", "/expenses")).toBe("read_only");
    expect(canViewPage(samplePermissions, "emp-1", "/expenses")).toBe(true);
    expect(canEditPage(samplePermissions, "emp-1", "/expenses")).toBe(false);
  });

  it("correctly identifies no_access (Blocked from view)", () => {
    expect(getPageAccessLevel(samplePermissions, "emp-1", "/settings")).toBe("no_access");
    expect(canViewPage(samplePermissions, "emp-1", "/settings")).toBe(false);
    expect(canEditPage(samplePermissions, "emp-1", "/settings")).toBe(false);
  });

  it("defaults unconfigured pages to full_access", () => {
    expect(getPageAccessLevel(samplePermissions, "emp-1", "/dashboard")).toBe("full_access");
    expect(canViewPage(samplePermissions, "emp-1", "/dashboard")).toBe(true);
    expect(canEditPage(samplePermissions, "emp-1", "/dashboard")).toBe(true);
  });

  it("has a comprehensive list of app nav pages with Nepali labels", () => {
    expect(APP_NAV_PAGES.length).toBeGreaterThanOrEqual(15);
    const masters = APP_NAV_PAGES.find((p) => p.path === "/masters");
    expect(masters).toBeDefined();
    expect(masters?.nepaliLabel).toContain("ग्राहक");
  });
});

