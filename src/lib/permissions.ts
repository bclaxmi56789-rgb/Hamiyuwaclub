/**
 * Employee Page Permissions and Access Control Module
 * Types and helper rules for fine-grained per-page access (no_access | read_only | full_access).
 */

export type AccessLevel = "no_access" | "read_only" | "full_access";

export type EmployeePermission = {
  id?: string;
  employee_id: string;
  employee_name?: string;
  page_path: string;
  access_level: AccessLevel;
  updated_at?: string;
};

export type AppNavPage = {
  path: string;
  label: string;
  nepaliLabel: string;
  category: string;
  description: string;
};

export const APP_NAV_PAGES: AppNavPage[] = [
  // MASTER SETUP
  { path: "/masters", label: "People Master", nepaliLabel: "ग्राहक तथा व्यक्ति दर्ता", category: "MASTER SETUP", description: "ग्राहक विवरण, कार्ड, टोल, र पान नम्बर" },
  { path: "/members", label: "Members & Staff", nepaliLabel: "सदस्य तथा कर्मचारी", category: "MASTER SETUP", description: "क्लब सदस्य, कर्मचारी र मासिक तलब सिट" },
  { path: "/plans", label: "Plan Master", nepaliLabel: "योजना तथा दर रेट", category: "MASTER SETUP", description: "शुल्क योजना, UOM र मासिक दरहरू" },
  { path: "/vendors", label: "Vendor Master", nepaliLabel: "सप्लायर्स तथा भेन्डर", category: "MASTER SETUP", description: "सामान तथा सेवा आपूर्तिकर्ताको विवरण" },
  { path: "/items", label: "Items & Assets", nepaliLabel: "जिन्सी तथा सम्पत्ति", category: "MASTER SETUP", description: "क्लबका जिन्सी सामान तथा स्थिर सम्पत्ति" },

  // DASHBOARD
  { path: "/dashboard", label: "Dashboard", nepaliLabel: "ड्यासबोर्ड", category: "DASHBOARD", description: "संकलन र खर्चको मुख्य तथ्याङ्क सारांश" },

  // COLLECTION & OPERATIONS
  { path: "/", label: "New Receipt", nepaliLabel: "नयाँ रसिद काट्ने", category: "COLLECTION & OPERATIONS", description: "ग्राहकको मासिक शुल्क रसिद काट्ने र प्रिन्ट" },
  { path: "/collection-map", label: "Collection Map", nepaliLabel: "संकलन नक्सा (GPS)", category: "COLLECTION & OPERATIONS", description: "नक्सामा ग्राहक लोकेसन र संकलन ट्रयाकिङ" },
  { path: "/trip-driver", label: "Trips & Driver", nepaliLabel: "ट्रिप तथा चालक", category: "COLLECTION & OPERATIONS", description: "ट्र्याक्टर/सवारी ट्रिप र चालक लग" },
  { path: "/receipts", label: "Receipt History", nepaliLabel: "रसिद इतिहास", category: "COLLECTION & OPERATIONS", description: "काटिएका पुराना रसिदहरूको खोज र पुनः प्रिन्ट" },

  // FINANCE & ACCOUNTING
  { path: "/receipts-payments", label: "Receipts & Payments", nepaliLabel: "रसिद तथा भुक्तानी", category: "FINANCE & ACCOUNTING", description: "नगद र बैंक खाताको आम्दानी तथा खर्च प्रविष्टि" },
  { path: "/expenses", label: "Expenses", nepaliLabel: "खर्च प्रविष्टि तथा बिल", category: "FINANCE & ACCOUNTING", description: "दैनिक खर्च, बिल भौचर र भुक्तानी" },
  { path: "/assets", label: "Theli Stock & Ledger", nepaliLabel: "थेली स्टक तथा लेजर", category: "FINANCE & ACCOUNTING", description: "थेली निष्कासन, दैनिक रिपोर्टिङ र बक्यौता हिसाब" },

  // EVENTS & GOVERNANCE
  { path: "/events", label: "Events & Programmes", nepaliLabel: "कार्यक्रम तथा उत्सव", category: "EVENTS & GOVERNANCE", description: "क्लबका औपचारिक कार्यक्रम र सहभागिता" },
  { path: "/minutes", label: "Meeting Minutes", nepaliLabel: "बैठक निर्णय (माइन्युट)", category: "EVENTS & GOVERNANCE", description: "कार्यसमिति बैठकका निर्णय तथा हस्ताक्षर" },

  // ADMINISTRATION & AI
  { path: "/ai-assistant", label: "AI Assistant", nepaliLabel: "एआई सहायक", category: "ADMINISTRATION & AI", description: "स्मार्ट सहायता र कागजात विश्लेषण" },
  { path: "/settings", label: "Settings & Permissions", nepaliLabel: "सेटिङ तथा अनुमति", category: "ADMINISTRATION & AI", description: "संस्थाको विवरण, AI कुञ्जी र अनुमति व्यवस्थापन" },
  { path: "/reports", label: "Reports & Analytics", nepaliLabel: "रिपोर्ट तथा विश्लेषण", category: "ADMINISTRATION & AI", description: "वार्षिक तथा मासिक वित्तीय प्रतिवेदनहरू" },
];

/**
 * Returns access level for a given employee and path.
 * If employee has no permission record for this path, defaults to 'full_access'.
 */
export function getPageAccessLevel(
  permissions: EmployeePermission[] | undefined,
  employeeId: string | null | undefined,
  path: string,
): AccessLevel {
  if (!employeeId) return "full_access"; // Admin/owner without employee constraint
  const perm = permissions?.find(
    (p) => p.employee_id === employeeId && (p.page_path === path || (path === "" && p.page_path === "/")),
  );
  return perm ? perm.access_level : "full_access";
}

/**
 * Checks if employee can view the page at path.
 */
export function canViewPage(
  permissions: EmployeePermission[] | undefined,
  employeeId: string | null | undefined,
  path: string,
): boolean {
  const level = getPageAccessLevel(permissions, employeeId, path);
  return level === "full_access" || level === "read_only";
}

/**
 * Checks if employee can create, edit or delete on the page at path.
 */
export function canEditPage(
  permissions: EmployeePermission[] | undefined,
  employeeId: string | null | undefined,
  path: string,
): boolean {
  const level = getPageAccessLevel(permissions, employeeId, path);
  return level === "full_access";
}
