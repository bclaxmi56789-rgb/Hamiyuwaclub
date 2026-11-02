import { describe, expect, it } from "vitest";
import {
  receiptReference,
  remainingDuesForPerson,
  theliSerialNumber,
  theliRangeCount,
  theliRasidsOut,
  theliRemainingRange,
  theliFinalRasids,
  theliTotals,
  theliOpeningBalance,
  theliOutsideRanges,
  bsCalendarMonth,
  parseBS,
  fiscalYear,
  fiscalYearRange,
  dateInFiscalYear,
  validateDateInFiscalYear,
  FISCAL_MONTHS,
  monthYear,
  matchingPeople,
  nextReceiptNumber,
  validateReceipt,
  DEFAULT_PLANS,
  matchPlan,
  getCustomerTotalRate,
  buildEmployeeLedger,
  employeeAdvanceTransactions,
  employeeOutstandingDr,
  type Receipt,
  type PayrollRecord,
  type EmployeeLedgerTxn,
} from "@/lib/receipt-rules";
const person = {
  name: "Samikshya Khanal",
  card: "C1",
  ward: "10",
  tole: "New Tole",
  phone: "9800000000",
};
const receipt: Receipt = {
  ...person,
  no: 7,
  date: "2083/04/01",
  year: "2083",
  mode: "eSewa",
  months: [{ m: 3, amt: 500 }],
  total: 500,
};
describe("Receipt business rules", () => {
  it("gives every receipt a stable reference using ward, fiscal year and receipt number", () => {
    expect(receiptReference(receipt)).toBe("W10-2083-000007");
    expect(receiptReference({ ...receipt, ward: "11" })).not.toBe(receiptReference(receipt));
    expect(receiptReference({ ...receipt, year: "2084" })).not.toBe(receiptReference(receipt));
    expect(receiptReference({ ...receipt, no: 8 })).not.toBe(receiptReference(receipt));
  });
  it("starts a fiscal year on Shrawan 1", () => expect(fiscalYear("2083/04/01")).toBe(2083));
  it("keeps Ashadh in the previous fiscal year", () => expect(fiscalYear("2083/03/01")).toBe(2082));
  it("does not reset at Baisakh", () => expect(fiscalYear("2084/01/01")).toBe(2083));
  it("orders months Shrawan through Ashadh", () =>
    expect(FISCAL_MONTHS).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2]));
  it("labels Ashadh with the ending calendar year", () => expect(monthYear(2083, 2)).toBe(2084));
  it("starts another ward at 1", () => expect(nextReceiptNumber([receipt], "11", "2083")).toBe(1));
  it("starts a new fiscal year at 1", () =>
    expect(nextReceiptNumber([receipt], "10", "2084")).toBe(1));
  it("continues the same ward and fiscal year", () =>
    expect(nextReceiptNumber([receipt], "10", "2083")).toBe(8));
  it("offers saved master details by card", () =>
    expect(matchingPeople([person], "10", "", "C1")).toEqual([person]));
  it("offers saved master details by name", () =>
    expect(matchingPeople([person], "10", "sam", "")).toEqual([person]));
  it("offers saved master details by phone", () =>
    expect(matchingPeople([person], "10", "", "", "9800000000")).toEqual([person]));
  it("does not suggest another ward's customer", () =>
    expect(matchingPeople([person], "11", "sam", "")).toEqual([]));
  it("requires payment mode", () =>
    expect(validateReceipt(person, receipt.date, "", receipt.months)).toBe(
      "Select a payment mode.",
    ));
  it("allows a blank contact number", () =>
    expect(
      validateReceipt({ ...person, phone: "" }, receipt.date, receipt.mode, receipt.months),
    ).toBe(""));
  it("rejects a wrong contact number", () =>
    expect(
      validateReceipt({ ...person, phone: "12345" }, receipt.date, receipt.mode, receipt.months),
    ).not.toBe(""));
  it("rejects a blank card because customer must be created in People Master first", () =>
    expect(
      validateReceipt({ ...person, card: "" }, receipt.date, receipt.mode, receipt.months),
    ).toBe(
      "Card number is required. Please select or register the customer in People Master first.",
    ));
  it("validates that customer card is registered in People Master", () =>
    expect(
      validateReceipt(person, receipt.date, receipt.mode, receipt.months, new Set(["C2"])),
    ).toContain("not registered in People Master"));
  it("accepts the Shrawan date when saving", () =>
    expect(
      validateReceipt(person, "2083/04/01", receipt.mode, receipt.months, new Set(["C1"])),
    ).toBe(""));
  it("accepts Nepali date numerals", () => expect(fiscalYear("२०८३/०४/०१")).toBe(2083));
  it("rejects a nonexistent day", () => expect(fiscalYear("2083/04/33")).toBeNull());
  it("calendar only offers valid BS days", () => {
    for (let month = 0; month < 12; month++) {
      const grid = bsCalendarMonth(2083, month);
      expect(grid).not.toBeNull();
      expect(parseBS(`2083/${String(month + 1).padStart(2, "0")}/${grid?.days}`)).not.toBeNull();
      expect(
        parseBS(`2083/${String(month + 1).padStart(2, "0")}/${(grid?.days ?? 0) + 1}`),
      ).toBeNull();
    }
  });
});
import { validateReference } from "@/lib/receipt-rules";
describe("manual reference number", () => {
  it("is required", () => expect(validateReference("  ")).not.toBe(""));
  it("accepts a typed value", () => expect(validateReference("HYC-101")).toBe(""));
  it("is printed as typed", () =>
    expect(receiptReference({ ward: "1", year: "2082", no: 3, ref: "HYC-101" })).toBe("HYC-101"));
});

import { FISCAL_YEARS } from "@/lib/receipt-rules";
describe("fiscal years", () => {
  it("run 2079 to 2099", () => {
    expect(FISCAL_YEARS[0]).toBe(2079);
    expect(FISCAL_YEARS.at(-1)).toBe(2099);
  });
});

describe("BS financial-year range and date validation", () => {
  it("runs Shrawan 1 to the last day of Asar", () => {
    expect(fiscalYearRange(2082)).toEqual({ start: "2082/04/01", end: "2083/03/32" });
    expect(dateInFiscalYear("2082/04/01", 2082)).toBe(true);
    expect(dateInFiscalYear("2083/03/31", 2082)).toBe(true);
    expect(dateInFiscalYear("2082/12/30", 2082)).toBe(true);
    expect(dateInFiscalYear("2083/04/01", 2082)).toBe(false);
    expect(dateInFiscalYear("2083/03/30", 2083)).toBe(false);
    expect(dateInFiscalYear("garbage", 2082)).toBe(false);
  });
  it("rejects dates outside the active fiscal year with a Nepali message", () => {
    expect(validateDateInFiscalYear("2082/05/05", 2082, "रसिद मिति")).toBe("");
    expect(validateDateInFiscalYear("2081/03/30", 2082, "थेली मिति")).toContain(
      "आर्थिक वर्ष 2082/2083",
    );
    expect(validateDateInFiscalYear("2085/01/01", 2082)).toContain("भित्र हुनुपर्छ");
    expect(validateDateInFiscalYear("not-a-date", 2082)).toContain("BS मिति");
  });
});

import { rpReference, rpRefSeq } from "@/lib/receipt-rules";
describe("cash book reference", () => {
  it("formats receipt references", () => expect(rpReference("receipt", 1)).toBe("R-0001"));
  it("formats payment references", () => expect(rpReference("payment", 12)).toBe("P-0012"));
  it("formats transfer references", () => expect(rpReference("transfer", 104)).toBe("T-0104"));
  it("never goes below one", () => expect(rpReference("receipt", 0)).toBe("R-0001"));
  it("reads the sequence back", () => {
    expect(rpRefSeq("T-0104")).toBe(104);
    expect(rpRefSeq("junk")).toBe(0);
  });
});

import { collectionBy, collectionByMonth, inBSRange } from "@/lib/receipt-rules";
describe("dashboard totals", () => {
  const a = {
    ...person,
    tole: "A",
    no: 1,
    date: "2082/04/05",
    year: "2082",
    mode: "eSewa",
    months: [
      { m: 3, amt: 500 },
      { m: 4, amt: 300 },
    ],
    total: 800,
  };
  const b = {
    ...a,
    tole: "B",
    ward: "2",
    date: "2082/06/01",
    months: [{ m: 3, amt: 200 }],
    total: 200,
  };
  it("sums by tole", () =>
    expect(collectionBy([a, b, a], (r) => r.tole)[0]).toEqual({
      key: "A",
      amount: 1600,
      count: 2,
    }));
  it("sums by month", () =>
    expect(collectionByMonth([a, b]).find((x) => x.m === 3)?.amount).toBe(700));
  it("filters by Nepali date range", () =>
    expect([a, b].filter((r) => inBSRange(r.date, "2082/05/01", "2082/12/30"))).toEqual([b]));
});

describe("multi-fiscal year month payments", () => {
  it("accepts months across multiple fiscal years in one receipt", () => {
    const multiYearMonths = [
      { m: 11, amt: 500, year: 2080 },
      { m: 0, amt: 500, year: 2080 },
      { m: 3, amt: 500, year: 2081 },
      { m: 4, amt: 500, year: 2081 },
    ];
    expect(validateReceipt(person, "2081/04/10", "नगद (Cash)", multiYearMonths)).toBe("");
  });

  it("rejects invalid fiscal years in month items", () => {
    const invalidYearMonths = [{ m: 3, amt: 500, year: 2050 }];
    expect(validateReceipt(person, "2081/04/10", "नगद (Cash)", invalidYearMonths)).not.toBe("");
  });

  it("sums by month filtering by target fiscal year", () => {
    const rMulti: Receipt = {
      ...person,
      no: 10,
      date: "2081/04/15",
      year: "2081",
      mode: "नगद (Cash)",
      months: [
        { m: 3, amt: 500, year: 2080 },
        { m: 3, amt: 500, year: 2081 },
      ],
      total: 1000,
    };
    expect(collectionByMonth([rMulti], 2080).find((x) => x.m === 3)?.amount).toBe(500);
    expect(collectionByMonth([rMulti], 2081).find((x) => x.m === 3)?.amount).toBe(500);
    expect(collectionByMonth([rMulti]).find((x) => x.m === 3)?.amount).toBe(1000);
  });
});

describe("People Master with PAN, address and GPS", () => {
  const pWithDetails = {
    ...person,
    district: "Surkhet",
    municipality: "Birendranagar",
    plan: "घरायसी (Household) - रु ५००",
    joining_date: "2083/07/13",
    email: "samikshya@example.com",
    pan: "601234567",
    full_address: "Birendranagar-4, Khorke Line",
    latitude: 28.60194,
    longitude: 81.61667,
    gps_accuracy: 5,
  };

  it("retains district, municipality, plan, joining_date, email, PAN, address and GPS in customer record", () => {
    expect(pWithDetails.district).toBe("Surkhet");
    expect(pWithDetails.municipality).toBe("Birendranagar");
    expect(pWithDetails.plan).toBe("घरायसी (Household) - रु ५००");
    expect(pWithDetails.joining_date).toBe("2083/07/13");
    expect(pWithDetails.email).toBe("samikshya@example.com");
    expect(pWithDetails.pan).toBe("601234567");
    expect(pWithDetails.full_address).toBe("Birendranagar-4, Khorke Line");
    expect(pWithDetails.latitude).toBeCloseTo(28.60194);
    expect(pWithDetails.longitude).toBeCloseTo(81.61667);
  });

  it("matches customer by PAN in matchingPeople", () => {
    expect(matchingPeople([pWithDetails], "10", "", "601234567")).toEqual([pWithDetails]);
  });

  it("matches customer by email in matchingPeople", () => {
    expect(matchingPeople([pWithDetails], "10", "samikshya@example.com")).toEqual([pWithDetails]);
    expect(matchingPeople([pWithDetails], "10", "", "samikshya@example.com")).toEqual([
      pWithDetails,
    ]);
  });
});

describe("Plan Master", () => {
  it("provides standard default plans with valid chargeable amounts", () => {
    expect(DEFAULT_PLANS.length).toBeGreaterThan(0);
    for (const plan of DEFAULT_PLANS) {
      expect(plan.chargeable_amount).toBe(plan.amount - plan.incentive);
      expect(plan.chargeable_amount).toBeGreaterThan(0);
    }
  });

  it("calculates chargeable amount correctly with incentives", () => {
    const commercialPlan = DEFAULT_PLANS.find((p) => p.id === "plan-commercial");
    expect(commercialPlan).toBeDefined();
    expect(commercialPlan?.amount).toBe(1200);
    expect(commercialPlan?.incentive).toBe(200);
    expect(commercialPlan?.chargeable_amount).toBe(1000);
  });

  it("supports UOM (मापन इकाई) and rates on plans", () => {
    const household = DEFAULT_PLANS.find((p) => p.id === "plan-household");
    expect(household?.uom).toBe("महिना (Month)");
    expect(household?.rate).toBe(500);

    const trip = DEFAULT_PLANS.find((p) => p.id === "plan-per-trip");
    expect(trip?.uom).toBe("ट्रिप (Trip)");
    expect(trip?.rate).toBe(1500);
  });

  it("calculates customer total billing rate with single and multiple plan subscriptions", () => {
    // 1. Single plan (default)
    const singlePlanCustomer = {
      ...person,
      plan_id: "plan-household",
      plan: "घरायसी (Household)",
    };
    expect(getCustomerTotalRate(singlePlanCustomer, DEFAULT_PLANS)).toBe(500);

    // 2. Multiple plans: Household + Commercial
    const multiPlanCustomer = {
      ...person,
      plans: [
        {
          plan_id: "plan-household",
          name: "घरायसी (Household)",
          amount: 350,
          incentive: 50,
          chargeable_amount: 300,
          uom: "महिना (Month)",
          quantity: 1,
        },
        {
          plan_id: "plan-commercial",
          name: "पसल / व्यवसाय (Commercial)",
          amount: 1200,
          incentive: 200,
          chargeable_amount: 1000,
          uom: "महिना (Month)",
          quantity: 1,
        },
      ],
    };
    expect(getCustomerTotalRate(multiPlanCustomer, DEFAULT_PLANS)).toBe(1300);

    // 3. Multi-unit quantity (e.g. 3 flats/rooms)
    const multiUnitCustomer = {
      ...person,
      plans: [
        {
          plan_id: "plan-flat",
          name: "कोठा / फ्ल्याट",
          amount: 200,
          incentive: 0,
          chargeable_amount: 200,
          uom: "कोठा/फ्ल्याट (Room/Flat)",
          quantity: 3,
        },
      ],
    };
    expect(getCustomerTotalRate(multiUnitCustomer, DEFAULT_PLANS)).toBe(600);
  });
});

describe("remainingDuesForPerson", () => {
  it("removes receipt-paid months and receipt-paid opening dues", () => {
    const receipts = [
      {
        ward: "1",
        card: "GT-1",
        year: 2083,
        months: [
          { m: 4, amt: 800 },
          { m: 3, year: 2082, amt: 500 },
        ],
      },
    ];
    const res = remainingDuesForPerson(
      "2083/04/25",
      [{ fy: 2082, month: 3, amount: 500 }],
      receipts,
      "1",
      "GT-1",
      800,
      "2083/07/14",
    );
    // Shrawan + Bhadra + Ashwin of FY 2083 auto dues; Bhadra paid.
    // Opening Baishakh-due row of FY 2082 (month 3 used as index 3=Shrawan here) paid via m.year override.
    expect(res.months).toEqual([
      { fy: 2083, month: 3, isOverdue: true },
      { fy: 2083, month: 5, isOverdue: true },
    ]);
    expect(res.total).toBe(1600);
  });

  it("returns nothing when every month is covered (case-insensitive card match)", () => {
    const receipts = [
      {
        ward: "2",
        card: "gt-2",
        year: 2083,
        months: [
          { m: 3, amt: 500 },
          { m: 4, amt: 500 },
          { m: 5, amt: 500 },
        ],
      },
    ];
    expect(
      remainingDuesForPerson("2083/04/25", undefined, receipts, "2", "GT-2", 800, "2083/07/14"),
    ).toEqual({ months: [], total: 0 });
  });
});

describe("theliTotals", () => {
  it("sums out/in range counts, outside theli and carried cash balance", () => {
    const t = theliTotals({
      opening_balance: 1200,
      amount: 3500,
      cleared_amount: 2000,
      out_entries: [
        { from: "GT-001", to: "GT-050", count: 5 },
        { from: "GT-101", to: "GT-120", count: 3 },
      ],
      in_entries: [{ from: "GT-001", to: "GT-040", count: 4 }],
    });
    expect(t.outCount).toBe(8);
    expect(t.inCount).toBe(4);
    expect(t.outsideCount).toBe(4);
    expect(t.balance).toBe(1200 + 3500 - 2000);
  });

  it("never reports negative outside theli and treats missing entries as zero", () => {
    expect(
      theliTotals({
        opening_balance: 0,
        amount: 0,
        cleared_amount: 500,
        out_entries: [{ from: "GT-001", to: "GT-010", count: 2 }],
        in_entries: [{ from: "GT-001", to: "GT-010", count: 5 }],
      }),
    ).toMatchObject({ outsideCount: 0, inCount: 5, balance: -500 });
  });
});

describe("theliOpeningBalance", () => {
  it("carries the previous day's closing balance forward", () => {
    const logs = [
      {
        log_date: "2083/07/14",
        opening_balance: 0,
        amount: 3000,
        cleared_amount: 500,
        out_entries: [{ from: "GT-001", to: "GT-050", count: 6 }],
        in_entries: [{ from: "GT-001", to: "GT-050", count: 6 }],
      },
      {
        log_date: "2083/07/13",
        opening_balance: 100,
        amount: 2000,
        cleared_amount: 2000,
        out_entries: [{ from: "GT-001", to: "GT-030", count: 4 }],
        in_entries: [{ from: "GT-001", to: "GT-030", count: 4 }],
      },
    ];
    expect(theliOpeningBalance(logs, "2083/07/15")).toBe(2500);
    // same-day pickup or first day starts at zero
    expect(theliOpeningBalance(logs, "2083/07/14")).toBe(100);
    expect(theliOpeningBalance(logs, "2083/07/13")).toBe(0);
  });

  it("carries the अन्तर per collector (employee) when employeeId is given", () => {
    const logs = [
      {
        employee_id: "emp-a",
        log_date: "2083/07/14",
        opening_balance: 0,
        amount: 4000,
        cleared_amount: 0,
        out_entries: [{ from: "GT-001", to: "GT-050", count: 6 }],
        in_entries: [],
      },
      {
        employee_id: "emp-b",
        log_date: "2083/07/14",
        opening_balance: 0,
        amount: 1000,
        cleared_amount: 1000,
        out_entries: [{ from: "GT-001", to: "GT-050", count: 6 }],
        in_entries: [],
      },
    ];
    // emp-a's unsettled रु. 4000 carries; emp-b is settled so theirs carries 0
    expect(theliOpeningBalance(logs, "2083/07/15", "emp-a")).toBe(4000);
    expect(theliOpeningBalance(logs, "2083/07/15", "emp-b")).toBe(0);
  });
});

describe("theli serial flow (S.No + खारेज सिरियल)", () => {
  it("parses serials like GT-001 or plain numbers", () => {
    expect(theliSerialNumber("GT-001")).toBe(1);
    expect(theliSerialNumber("gt-030 ")).toBe(30);
    expect(theliSerialNumber("2294")).toBe(2294);
    expect(theliSerialNumber("")).toBeNaN();
    expect(theliSerialNumber(undefined)).toBeNaN();
  });

  it("counts rasids from the देखि–सम्म difference (inclusive), falling back to manual count", () => {
    expect(theliRangeCount({ from: "GT-001", to: "GT-050", count: 0 })).toBe(50);
    expect(theliRangeCount({ from: "GT-021", to: "GT-050", count: 0 })).toBe(30);
    expect(theliRangeCount({ from: "abc", to: "GT-050", count: 7 })).toBe(7);
    expect(theliRangeCount({ from: "GT-050", to: "GT-001", count: 9 })).toBe(9);
    expect(theliRangeCount({ from: "", to: "", count: 0 })).toBe(0);
  });

  it("auto-calculates rasids out from the given (देखि) and closing (खारेज) serial", () => {
    const out = [{ from: "GT-001", to: "GT-050", count: 50 }];
    expect(theliRasidsOut(out, "GT-030")).toBe(30);
    expect(theliRasidsOut(out, "gt-030")).toBe(30);
    // closing below the given serial -> nothing cut
    expect(theliRasidsOut(out, undefined)).toBe(0);
    // partial coverage of the second book row
    const multi = [
      { from: "GT-001", to: "GT-050", count: 50 },
      { from: "GT-051", to: "GT-080", count: 30 },
    ];
    expect(theliRasidsOut(multi, "GT-065")).toBe(65);
  });

  it("subtracts cancelled rasids to reach the final rasid count", () => {
    expect(theliFinalRasids(30, 2)).toBe(28);
    expect(theliFinalRasids(30, 35)).toBe(0);
  });

  it("returns the फर्किएको (बाँकी) serial balance range after the closing serial", () => {
    const out = [{ from: "GT-001", to: "GT-050", count: 50 }];
    expect(theliRemainingRange(out, "GT-030")).toEqual({
      from: "GT-031",
      to: "GT-050",
      count: 20,
    });
    // nothing left when closing reaches सम्म; missing खारेज yields null
    expect(theliRemainingRange(out, "GT-050")).toBeNull();
    expect(theliRemainingRange(out, undefined)).toBeNull();
  });

  it("merges later serial rows into the remaining balance range", () => {
    const multi = [
      { from: "GT-001", to: "GT-050", count: 50 },
      { from: "GT-051", to: "GT-080", count: 30 },
    ];
    expect(theliRemainingRange(multi, "GT-065")).toEqual({
      from: "GT-066",
      to: "GT-080",
      count: 15,
    });
    expect(theliRemainingRange(multi, "GT-030")).toEqual({
      from: "GT-031",
      to: "GT-080",
      count: 50,
    });
  });

  it("theliTotals exposes rasids out, cancelled and final from closing_serial", () => {
    const t = theliTotals({
      opening_balance: 2294,
      amount: 3500,
      cleared_amount: 0,
      out_entries: [{ from: "GT-001", to: "GT-050", count: 50 }],
      in_entries: [],
      closing_serial: "GT-030",
      cancelled_count: 2,
      settled: false,
    });
    expect(t.rasidsOut).toBe(30);
    expect(t.cancelledCount).toBe(2);
    expect(t.finalRasids).toBe(28);
    expect(t.balance).toBe(2294 + 3500);
  });

  it("a settled day contributes zero to the next day's carry", () => {
    const settledLog = {
      employee_id: "emp-c",
      log_date: "2083/07/14",
      opening_balance: 2000,
      amount: 3000,
      cleared_amount: 5000,
      out_entries: [{ from: "GT-001", to: "GT-050", count: 50 }],
      in_entries: [],
      closing_serial: "GT-030",
      cancelled_count: 0,
      settled: true,
    };
    expect(theliTotals(settledLog).balance).toBe(0);
    expect(theliOpeningBalance([settledLog], "2083/07/15", "emp-c")).toBe(0);
  });
});

describe("theliOutsideRanges", () => {
  it("keeps unmatched out ranges whole and subtracts matched in counts", () => {
    expect(
      theliOutsideRanges(
        [
          { from: "GT-001", to: "GT-050", count: 5 },
          { from: "GT-101", to: "GT-120", count: 3 },
        ],
        [
          { from: "GT-001", to: "GT-050", count: 2 },
          { from: "GT-081", to: "GT-090", count: 10 },
        ],
      ),
    ).toEqual([
      { from: "GT-001", to: "GT-050", count: 3 },
      { from: "GT-101", to: "GT-120", count: 3 },
    ]);
  });

  it("returns nothing when every out range was fully returned (case/space tolerant)", () => {
    expect(
      theliOutsideRanges(
        [{ from: " gt-001 ", to: "GT-010", count: 4 }],
        [{ from: "GT-001", to: "gt-010 ", count: 4 }],
      ),
    ).toEqual([]);
  });
});

/* ── Employee Dr/Cr ledger ─────────────────────────────────── */

const emp = { id: "emp-1", opening_balance: 0, balance_type: "cr" as const };

const payrollRow = (over: Partial<PayrollRecord> = {}): PayrollRecord => ({
  year: 2082,
  month: 6, // कार्तिक
  employee_id: "emp-1",
  employee_name: "राम",
  designation: "संकलक",
  basic_salary: 40000,
  days_worked: 26,
  total_days: 26,
  trips: 0,
  allowance: 10000,
  gross_salary: 50000,
  tax: 5000,
  advance_adjusted: 0,
  other_deductions: 0,
  net_salary: 45000,
  payment_status: "booked",
  ...over,
});

const txn = (over: Partial<EmployeeLedgerTxn> = {}): EmployeeLedgerTxn => ({
  id: "t-1",
  ref_no: "P-0001",
  txn_date: "2082/07/10",
  party_id: "emp-1",
  amount: 1000,
  remarks: "पेश्की",
  txn_type: "payment",
  ...over,
});

describe("buildEmployeeLedger", () => {
  it("posts the opening balance on the credit side by default", () => {
    const rows = buildEmployeeLedger({
      employee: { id: "emp-1", opening_balance: 5000, balance_type: "cr" },
      payrolls: [],
      transactions: [],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      source: "opening",
      dr: 0,
      cr: 5000,
      running: 5000,
      runType: "cr",
    });
  });

  it("respects a debit opening balance", () => {
    const rows = buildEmployeeLedger({
      employee: { id: "emp-1", opening_balance: 2000, balance_type: "dr" },
      payrolls: [],
      transactions: [],
    });
    expect(rows[0]).toMatchObject({ dr: 2000, cr: 0, running: 2000, runType: "dr" });
  });

  it("credits booked salary at gross − TDS − other deductions (advance not double-counted)", () => {
    const rows = buildEmployeeLedger({
      employee: emp,
      payrolls: [
        payrollRow({
          advance_adjusted: 10000,
          net_salary: 35000,
          payment_status: "booked",
        }),
      ],
      transactions: [],
    });
    const booked = rows.find((r) => r.source === "salary_booked");
    expect(booked).toBeDefined();
    // 50000 − 5000 TDS − 0 other = 45000 (= net 35000 + advance 10000)
    expect(booked!.cr).toBe(45000);
    expect(booked!.dr).toBe(0);
    expect(booked!.runType).toBe("cr");
    expect(booked!.running).toBe(45000);
  });

  it("posts a paid salary as a debit next to its booking credit", () => {
    const rows = buildEmployeeLedger({
      employee: emp,
      payrolls: [
        payrollRow({
          payment_status: "paid",
          payment_date: "2082/08/05",
          voucher_ref: "P-0001",
          net_salary: 45000,
        }),
      ],
      transactions: [],
    });
    expect(rows.map((r) => r.source)).toEqual(["opening", "salary_booked", "salary_paid"]);
    const paid = rows.find((r) => r.source === "salary_paid")!;
    expect(paid.dr).toBe(45000);
    expect(paid.cr).toBe(0);
    expect(paid.ref).toBe("P-0001");
    // 0 seed → credit 45000 → debit 45000 = nil balance
    expect(paid.running).toBe(0);
    expect(paid.runType).toBe("dr");
  });

  it("does not post draft (pending) payroll rows", () => {
    const rows = buildEmployeeLedger({
      employee: emp,
      payrolls: [payrollRow({ payment_status: "pending" })],
      transactions: [],
    });
    expect(rows.map((r) => r.source)).toEqual(["opening"]);
  });

  it("posts an advance payment as a debit and skips salary-payment vouchers", () => {
    const rows = buildEmployeeLedger({
      employee: emp,
      payrolls: [payrollRow({ payment_status: "paid", voucher_ref: "P-0001", net_salary: 45000 })],
      transactions: [
        txn({
          id: "salary",
          ref_no: "P-0001",
          amount: 45000,
          remarks: "मासिक तलब भुक्तानी - कार्तिक 2082",
        }),
        txn({ id: "adv", ref_no: "P-0009", txn_date: "2082/06/10", amount: 10000 }),
        // Salary pay without a matching voucher_ref is still caught by its remarks
        txn({
          id: "salary2",
          ref_no: "P-0002",
          remarks: "मासिक तलब भुक्तानी - कार्तिक 2082 (राम)",
        }),
      ],
    });
    const advances = rows.filter((r) => r.source === "advance");
    expect(advances).toHaveLength(1);
    expect(advances[0]).toMatchObject({ ref: "P-0009", dr: 10000, cr: 0 });
    // The salary voucher shows up only as the paid-salary row, never as an advance
    expect(rows.filter((r) => r.ref === "P-0001").map((r) => r.source)).toEqual(["salary_paid"]);
    expect(rows.some((r) => r.ref === "P-0002")).toBe(false);
  });

  it("keeps the running balance reconciled across opening, book, advance and pay", () => {
    const rows = buildEmployeeLedger({
      employee: { id: "emp-1", opening_balance: 5000, balance_type: "cr" },
      payrolls: [
        payrollRow({
          payment_status: "paid",
          advance_adjusted: 10000,
          net_salary: 35000,
          payment_date: "2082/08/05",
          voucher_ref: "P-0001",
        }),
      ],
      transactions: [
        txn({ ref_no: "P-0009", txn_date: "2082/06/10", amount: 10000 }),
        txn({
          id: "s",
          ref_no: "P-0001",
          txn_date: "2082/08/05",
          amount: 35000,
          remarks: "मासिक तलब भुक्तानी - कार्तिक 2082",
        }),
      ],
    });
    expect(rows.map((r) => r.source)).toEqual([
      "opening",
      "advance",
      "salary_booked",
      "salary_paid",
    ]);
    expect(rows.map((r) => [r.running, r.runType])).toEqual([
      [5000, "cr"], // opening owed
      [5000, "dr"], // advance cash given → employee owes club
      [40000, "cr"], // salary booked 45000 credit
      [5000, "cr"], // paid 35000 → 5000 still payable
    ]);
    const last = rows.at(-1);
    expect(last?.running).toBe(5000);
    expect(last?.runType).toBe("cr");
  });

  it("totals debits and credits for the ledger footer", () => {
    const rows = buildEmployeeLedger({
      employee: { id: "emp-1", opening_balance: 5000, balance_type: "cr" },
      payrolls: [payrollRow({ payment_status: "booked" })],
      transactions: [txn({ amount: 2500 })],
    });
    expect(rows.reduce((s, r) => s + r.dr, 0)).toBe(2500);
    expect(rows.reduce((s, r) => s + r.cr, 0)).toBe(50000); // opening 5000 + booked 45000
  });

  it("ignores other employees' payroll rows even when passed full history", () => {
    const rows = buildEmployeeLedger({
      employee: emp,
      payrolls: [
        payrollRow({ employee_id: "emp-2", payment_status: "booked" }),
        payrollRow({ employee_id: "emp-3", payment_status: "paid", voucher_ref: "P-0007" }),
      ],
      transactions: [],
    });
    expect(rows.map((r) => r.source)).toEqual(["opening"]);
  });
});

describe("employeeOutstandingDr", () => {
  it("returns 0 when the ledger sits on the credit side", () => {
    expect(employeeOutstandingDr(emp, [], [])).toBe(0);
    expect(
      employeeOutstandingDr({ id: "emp-1", opening_balance: 5000, balance_type: "cr" }, [], []),
    ).toBe(0);
  });

  it("includes a debit opening balance", () => {
    expect(
      employeeOutstandingDr({ id: "emp-1", opening_balance: 3000, balance_type: "dr" }, [], []),
    ).toBe(3000);
  });

  it("returns outstanding advances with no salary credit yet", () => {
    const dr = employeeOutstandingDr(
      emp,
      [],
      [txn({ ref_no: "P-0009", txn_date: "2082/06/10", amount: 10000 })],
    );
    expect(dr).toBe(10000);
  });

  it("keeps a debit remainder when a smaller salary is booked", () => {
    const dr = employeeOutstandingDr(
      emp,
      [payrollRow({ payment_status: "booked", advance_adjusted: 50000, net_salary: 0 })],
      [txn({ ref_no: "P-0009", txn_date: "2082/06/10", amount: 50000 })],
    );
    // advance 50000 Dr − booked credit 45000 (50000 gross − 5000 TDS) = 5000 Dr
    expect(dr).toBe(5000);
  });

  it("returns 0 once the booked salary offsets the advance", () => {
    const dr = employeeOutstandingDr(
      emp,
      [payrollRow({ payment_status: "booked", advance_adjusted: 10000, net_salary: 35000 })],
      [txn({ ref_no: "P-0009", txn_date: "2082/06/10", amount: 10000 })],
    );
    expect(dr).toBe(0);
  });

  it("counts only this employee's rows when given the full payroll history", () => {
    const dr = employeeOutstandingDr(
      emp,
      [
        // Other employees' booked salaries must not offset this employee's advance
        payrollRow({ employee_id: "emp-2", payment_status: "booked" }),
        payrollRow({ employee_id: "emp-3", payment_status: "booked" }),
        payrollRow({ payment_status: "pending" }),
      ],
      [txn({ ref_no: "P-0009", txn_date: "2082/06/10", amount: 47480 })],
    );
    expect(dr).toBe(47480);
  });
});

describe("employeeAdvanceTransactions", () => {
  it("keeps only payment-type advances for that employee", () => {
    const payrolls = [payrollRow({ voucher_ref: "P-0001" })];
    const out = employeeAdvanceTransactions(
      "emp-1",
      [
        txn({ id: "a", ref_no: "P-0009" }),
        txn({ id: "b", ref_no: "P-0001", amount: 45000 }),
        txn({ id: "c", ref_no: "R-0001", txn_type: "receipt" }),
        txn({ id: "d", ref_no: "P-0010", party_id: "emp-2" }),
        txn({ id: "e", ref_no: "P-0011", remarks: "मासिक तलब भुक्तानी - कार्तिक 2082" }),
      ],
      payrolls,
    );
    expect(out.map((t) => t.id)).toEqual(["a"]);
  });

  it("returns nothing without an employee id", () => {
    expect(employeeAdvanceTransactions(undefined, [txn()], [])).toEqual([]);
  });
});

/* ══════════════════════════════════════════════════════════════════
   THELI STOCK, ISSUANCE & EMPLOYEE REPORTING TESTS
   ══════════════════════════════════════════════════════════════════ */
import {
  calculateTheliStockCounts,
  generateTheliRanges,
  sortTheliAvailableRanges,
  calculateTheliBooking,
  type TheliStockItem,
} from "../lib/receipt-rules";

describe("Theli Stock Master and Range Calculations", () => {
  it("calculates total vouchers and theli count automatically", () => {
    const res = calculateTheliStockCounts("GT-0001", "GT-1000", 50);
    expect(res.totalVouchers).toBe(1000);
    expect(res.totalTheli).toBe(20);

    const res2 = calculateTheliStockCounts("101", "225", 50);
    expect(res2.totalVouchers).toBe(125);
    expect(res2.totalTheli).toBe(3); // 50 + 50 + 25 = 3 thelis
  });

  it("handles empty or reversed range safely", () => {
    expect(calculateTheliStockCounts("", "")).toEqual({ totalVouchers: 0, totalTheli: 0 });
    expect(calculateTheliStockCounts("GT-500", "GT-100")).toEqual({
      totalVouchers: 0,
      totalTheli: 0,
    });
  });

  it("generates discrete theli book items preserving prefix and formatting", () => {
    const items = generateTheliRanges({
      id: "b-1",
      municipality: "वीरेन्द्रनगर",
      ward: "4",
      fiscal_year: "2081/82",
      start_from: "GT-001",
      end_to: "GT-120",
      vouchers_per_theli: 50,
    });

    expect(items.length).toBe(3);
    expect(items[0].theli_no).toBe(1);
    expect(items[0].range_from).toBe("GT-001");
    expect(items[0].range_to).toBe("GT-050");
    expect(items[0].total_vouchers).toBe(50);

    expect(items[1].theli_no).toBe(2);
    expect(items[1].range_from).toBe("GT-051");
    expect(items[1].range_to).toBe("GT-100");
    expect(items[1].total_vouchers).toBe(50);

    expect(items[2].theli_no).toBe(3);
    expect(items[2].range_from).toBe("GT-101");
    expect(items[2].range_to).toBe("GT-120");
    expect(items[2].total_vouchers).toBe(20);
  });

  it("sortTheliAvailableRanges puts remaining/returned open theli at the VERY TOP", () => {
    const items: TheliStockItem[] = [
      {
        id: "th-1",
        municipality: "वीरेन्द्रनगर",
        ward: "4",
        fiscal_year: "2081/82",
        range_from: "GT-001",
        range_to: "GT-050",
        total_vouchers: 50,
        status: "available",
      },
      {
        id: "th-rem",
        municipality: "वीरेन्द्रनगर",
        ward: "4",
        fiscal_year: "2081/82",
        range_from: "GT-031",
        range_to: "GT-050",
        total_vouchers: 20,
        status: "returned_remaining",
        is_remaining_open: true,
      },
      {
        id: "th-2",
        municipality: "वीरेन्द्रनगर",
        ward: "4",
        fiscal_year: "2081/82",
        range_from: "GT-051",
        range_to: "GT-100",
        total_vouchers: 50,
        status: "available",
      },
    ];

    const sorted = sortTheliAvailableRanges(items);
    expect(sorted[0].id).toBe("th-rem"); // Remaining open theli is first!
    expect(sorted[0].is_remaining_open).toBe(true);
    expect(sorted[1].id).toBe("th-1");
    expect(sorted[2].id).toBe("th-2");
  });

  it("calculateTheliBooking computes booked vouchers, balance on credit, and remaining range", () => {
    const item: TheliStockItem = {
      id: "th-1",
      municipality: "वीरेन्द्रनगर",
      ward: "4",
      fiscal_year: "2081/82",
      range_from: "GT-001",
      range_to: "GT-050",
      total_vouchers: 50,
      status: "issued",
    };

    // Employee reports up to GT-030 booked, Booked amount 15000, Obtained cash 12000, Previous carry 500
    const calc = calculateTheliBooking(item, "GT-030", 15000, 12000, 500);

    expect(calc.bookedCount).toBe(30);
    expect(calc.remainingCount).toBe(20);
    expect(calc.remainingRange).toEqual({
      from: "GT-031",
      to: "GT-050",
      count: 20,
    });
    expect(calc.amountBooked).toBe(15000);
    expect(calc.amountObtained).toBe(12000);
    // Balance = Carry 500 + Booked 15000 - Obtained 12000 = 3500 credit
    expect(calc.newBalance).toBe(3500);
    expect(calc.isFullyExhausted).toBe(false);
  });

  it("marks as fully exhausted when last voucher reaches end of range", () => {
    const item: TheliStockItem = {
      id: "th-1",
      municipality: "वीरेन्द्रनगर",
      ward: "4",
      fiscal_year: "2081/82",
      range_from: "GT-001",
      range_to: "GT-050",
      total_vouchers: 50,
      status: "issued",
    };

    const calc = calculateTheliBooking(item, "GT-050", 25000, 25000, 0);
    expect(calc.bookedCount).toBe(50);
    expect(calc.remainingCount).toBe(0);
    expect(calc.remainingRange).toBeNull();
    expect(calc.newBalance).toBe(0);
    expect(calc.isFullyExhausted).toBe(true);
  });

  it("calculates cancelled rasids (रद्द रसिद) and net valid count", () => {
    const item: TheliStockItem = {
      id: "th-1",
      municipality: "वीरेन्द्रनगर",
      ward: "4",
      fiscal_year: "2081/82",
      range_from: "GT-001",
      range_to: "GT-050",
      total_vouchers: 50,
      status: "issued",
    };

    // Up to GT-030 (30 vouchers booked), but 3 vouchers were cancelled
    const calc = calculateTheliBooking(item, "GT-030", 13500, 13500, 0, 3);
    expect(calc.bookedCount).toBe(30);
    expect(calc.cancelledCount).toBe(3);
    expect(calc.netValidCount).toBe(27); // 30 - 3 = 27
    expect(calc.remainingCount).toBe(20);
  });

  it("calculates second booking on partially_booked item starting from remaining_range_from", () => {
    // Theli originally GT-001 to GT-050, but previously booked up to GT-030 and kept with employee
    const partialItem: TheliStockItem = {
      id: "th-1",
      municipality: "वीरेन्द्रनगर",
      ward: "4",
      fiscal_year: "2081/82",
      range_from: "GT-001",
      range_to: "GT-050",
      total_vouchers: 50,
      status: "partially_booked",
      last_voucher_booked: "GT-030",
      remaining_range_from: "GT-031",
      remaining_range_to: "GT-050",
      remaining_vouchers_count: 20,
    };

    // Employee now books from GT-031 up to GT-045 (15 vouchers)
    const calc = calculateTheliBooking(partialItem, "GT-045", 7500, 7500, 0, 1);
    expect(calc.bookedCount).toBe(15); // GT-031 to GT-045 = 45 - 31 + 1 = 15 vouchers
    expect(calc.cancelledCount).toBe(1);
    expect(calc.netValidCount).toBe(14); // 15 - 1 = 14
    expect(calc.remainingCount).toBe(5); // GT-046 to GT-050 = 5 vouchers
    expect(calc.remainingRange).toEqual({
      from: "GT-046",
      to: "GT-050",
      count: 5,
    });
    expect(calc.isFullyExhausted).toBe(false);
  });
});
