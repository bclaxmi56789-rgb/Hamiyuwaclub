import NepaliDate, { dateConfigMap } from "nepali-date-converter";

export type CustomerPlanSubscription = {
  plan_id: string;
  name: string;
  amount?: number;
  incentive?: number;
  chargeable_amount: number;
  uom?: string;
  quantity?: number;
  trips?: number; // Number of trips / Trips per period (ट्रिप संख्या)
  no_of_trips?: number;
};

export type PlanItem = {
  id: string;
  name: string;
  uom?: string; // Unit of measurement: e.g. महिना (Month), ट्रिप (Trip), घर (House), कोठा (Room), के.जी. (Kg)
  rate?: number; // Base rate per unit
  trips?: number; // Number of trips / Trips per period (ट्रिप संख्या)
  no_of_trips?: number;
  amount: number;
  incentive: number;
  chargeable_amount: number;
  description?: string;
  is_active?: boolean;
};

export const DEFAULT_PLANS: PlanItem[] = [
  {
    id: "plan-household",
    name: "घरायसी (Household)",
    uom: "महिना (Month)",
    rate: 500,
    trips: 4,
    no_of_trips: 4,
    amount: 500,
    incentive: 0,
    chargeable_amount: 500,
    description: "नियमित घरायसी फोहोरमैला संकलन सेवा (महिनामा ४ ट्रिप)",
    is_active: true,
  },
  {
    id: "plan-commercial",
    name: "व्यापारिक (Commercial)",
    uom: "महिना (Month)",
    rate: 1200,
    trips: 8,
    no_of_trips: 8,
    amount: 1200,
    incentive: 200,
    chargeable_amount: 1000,
    description: "पसल तथा साना व्यवसायिक फर्महरू (महिनामा ८ ट्रिप)",
    is_active: true,
  },
  {
    id: "plan-hotel",
    name: "होटल / रेष्टुरेन्ट (Hotel/Restaurant)",
    uom: "महिना (Month)",
    rate: 1800,
    trips: 12,
    no_of_trips: 12,
    amount: 1800,
    incentive: 300,
    chargeable_amount: 1500,
    description: "होटल, रेष्टुरेन्ट, क्याफे तथा भोजनालय (महिनामा १२ ट्रिप)",
    is_active: true,
  },
  {
    id: "plan-institutional",
    name: "संस्थागत / कार्यालय (Institutional)",
    uom: "महिना (Month)",
    rate: 2500,
    trips: 8,
    no_of_trips: 8,
    amount: 2500,
    incentive: 500,
    chargeable_amount: 2000,
    description: "सरकारी तथा गैरसरकारी संघ-संस्था, बैंक तथा वित्तीय संस्था (महिनामा ८ ट्रिप)",
    is_active: true,
  },
  {
    id: "plan-per-trip",
    name: "विशेष संकलन (Per Trip)",
    uom: "ट्रिप (Trip)",
    rate: 1500,
    trips: 1,
    no_of_trips: 1,
    amount: 1500,
    incentive: 0,
    chargeable_amount: 1500,
    description: "ट्र्याक्टर/टिपर विशेष फोहोर संकलन सेवा प्रति ट्रिप",
    is_active: true,
  },
];

export function matchPlan(
  plans: PlanItem[],
  planId?: string,
  planName?: string,
): PlanItem | undefined {
  if (!plans || plans.length === 0) return undefined;
  if (planId) {
    const byId = plans.find((p) => p.id === planId);
    if (byId) return byId;
  }
  if (planName) {
    const trimmed = planName.trim().toLowerCase();
    const byExact = plans.find((p) => p.name.trim().toLowerCase() === trimmed);
    if (byExact) return byExact;
    const bySub = plans.find(
      (p) =>
        trimmed.includes(p.name.trim().toLowerCase()) ||
        p.name.trim().toLowerCase().includes(trimmed),
    );
    if (bySub) return bySub;
    if (trimmed.includes("घरायसी") || trimmed.includes("household")) {
      const h = plans.find((p) => p.id === "plan-household" || p.name.includes("घरायसी"));
      if (h) return h;
    }
    if (trimmed.includes("व्यापारिक") || trimmed.includes("commercial")) {
      const c = plans.find((p) => p.id === "plan-commercial" || p.name.includes("व्यापारिक"));
      if (c) return c;
    }
    if (trimmed.includes("होटल") || trimmed.includes("hotel")) {
      const hot = plans.find((p) => p.id === "plan-hotel" || p.name.includes("होटल"));
      if (hot) return hot;
    }
    if (trimmed.includes("संस्था") || trimmed.includes("institutional")) {
      const inst = plans.find((p) => p.id === "plan-institutional" || p.name.includes("संस्था"));
      if (inst) return inst;
    }
  }
  return plans[0];
}

export function getCustomerTotalRate(p: Person, allPlans?: PlanItem[]): number {
  if (p.plans && p.plans.length > 0) {
    const sum = p.plans.reduce(
      (acc, sp) => acc + (Number(sp.chargeable_amount) || 0) * (Number(sp.quantity) || 1),
      0,
    );
    if (sum > 0) return sum;
  }
  if (p.plan_id && allPlans) {
    const ids = p.plan_id.split(",").map((s) => s.trim());
    const matched = allPlans.filter((pl) => ids.includes(pl.id));
    if (matched.length > 0) {
      return matched.reduce((acc, pl) => acc + pl.chargeable_amount, 0);
    }
  }
  if (p.plan) {
    if (allPlans) {
      const matched = allPlans.find((pl) => pl.name === p.plan);
      if (matched) return matched.chargeable_amount;
    }
    const match = p.plan.match(/\d+/);
    if (match) return Number(match[0]);
  }
  return 500;
}

/** A manually entered past-due entry for pre-system opening balance. */
export type OpeningDue = { fy: number; month: number; amount: number };

export type Person = {
  card: string;
  name: string;
  district?: string;
  municipality?: string;
  ward: string;
  tole: string;
  phone: string;
  email?: string;
  pan?: string;
  full_address?: string;
  plan?: string;
  plan_id?: string;
  plans?: CustomerPlanSubscription[];
  joining_date?: string;
  latitude?: number | null;
  longitude?: number | null;
  gps_accuracy?: number | null;
  opening_dues?: OpeningDue[]; // manually entered pre-system dues
  locality_photo?: string; // photo of the customer's locality/house
  nature?: string; // business nature (from BUSINESS_NATURES master list)
};
export type ReceiptMonthItem = { m: number; amt: number; year?: number };
export type Receipt = Person & {
  id?: string;
  no: number;
  ref?: string;
  date: string;
  year: string;
  mode: string;
  months: ReceiptMonthItem[];
  total: number;
  accountId?: string;
  accountName?: string;
};
/** Reference number is typed manually by staff; older receipts without one fall back to the generated format. */
export const receiptReference = (r: Pick<Receipt, "ward" | "year" | "no" | "ref">) =>
  r.ref?.trim() || `W${r.ward}-${r.year}-${String(r.no).padStart(6, "0")}`;
export function validateReference(ref: string) {
  const v = ref.trim();
  if (!v) return "Enter the reference number.";
  if (v.length > 40) return "Reference number must be 40 characters or fewer.";
  return "";
}
export const MONTHS = [
  "बैशाख",
  "जेठ",
  "असार",
  "साउन",
  "भदौ",
  "असोज",
  "कार्तिक",
  "मंसिर",
  "पुष",
  "माघ",
  "फागुन",
  "चैत",
];
export const FISCAL_MONTHS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2];
export const MODES = ["नगद (Cash)", "eSewa", "Khalti", "बैंक (Bank)", "चेक (Cheque)"];
const NP = "०१२३४५६७८९";
export const np = (v: string | number) => String(v).replace(/\d/g, (d) => NP[+d] ?? d);
export const en = (v: string) => String(v).replace(/[०-९]/g, (d) => String(NP.indexOf(d)));
export function bsCalendarMonth(year: number, month: number) {
  const keys = [
    "Baisakh",
    "Jestha",
    "Asar",
    "Shrawan",
    "Bhadra",
    "Aswin",
    "Kartik",
    "Mangsir",
    "Poush",
    "Magh",
    "Falgun",
    "Chaitra",
  ] as const;
  const key = keys[month];
  const config = dateConfigMap[String(year)];
  if (!key || !config) return null;
  return { days: config[key], startDay: new NepaliDate(year, month, 1).getDay() };
}
export function parseBS(date: string) {
  const normalized = en(date);
  if (!/^\d{4}\/\d{2}\/\d{2}$/.test(normalized)) return null;
  const [y, m, d] = normalized.split("/").map(Number);
  if (y === undefined || m === undefined || d === undefined) return null;
  const monthKeys = [
    "Baisakh",
    "Jestha",
    "Asar",
    "Shrawan",
    "Bhadra",
    "Aswin",
    "Kartik",
    "Mangsir",
    "Poush",
    "Magh",
    "Falgun",
    "Chaitra",
  ] as const;
  const config = dateConfigMap[String(y)];
  const key = monthKeys[m - 1];
  if (!config || !key || d < 1 || d > config[key]) return null;
  return { y, m, d };
}
export function fiscalYear(date: string): number | null {
  const bs = parseBS(date);
  return bs ? (bs.m >= 4 ? bs.y : bs.y - 1) : null;
}
/** Fiscal-year range in BS: FY startYear runs Shrawan 1 (startYear/04/01) to the last day of Asar (startYear+1/03). */
export function fiscalYearRange(startYear: number): { start: string; end: string } | null {
  const asarDays = dateConfigMap[String(startYear + 1)]?.["Asar"];
  if (!asarDays) return null;
  return {
    start: `${startYear}/04/01`,
    end: `${startYear + 1}/03/${String(asarDays).padStart(2, "0")}`,
  };
}
/** True when a valid BS date falls inside fiscal year fy (Shrawan fy/04/01 → Asar end fy+1/03). */
export function dateInFiscalYear(date: string, fy: number): boolean {
  const bs = parseBS(date);
  return !!bs && (bs.m >= 4 ? bs.y === fy : bs.y - 1 === fy);
}
/** Shared date-inside-fiscal-year rule: null when valid, otherwise a Nepali error message. */
export function validateDateInFiscalYear(date: string, fy: number, label = "मिति"): string {
  if (!fy) return `${label}को आर्थिक वर्ष पहिचान भएन।`;
  const bs = parseBS(date);
  if (!bs) return `${label} सम्पूर्ण BS मिति (बर्ष/महिना/दिन) भर्नुहोस्।`;
  const inside = bs.m >= 4 ? bs.y === fy : bs.y - 1 === fy;
  if (!inside)
    return `${label} छनौट आर्थिक वर्ष ${fy}/${fy + 1} (श्रावण १ देखि असार मसान्त) भित्र हुनुपर्छ।`;
  return "";
}
/** Selectable fiscal years: 2079/2080 through 2099/2100. */
export const FISCAL_YEARS = Array.from({ length: 21 }, (_, i) => 2079 + i);
export const fiscalLabel = (year: string | number) => np(`${year}/${Number(year) + 1}`);
export const monthYear = (fy: string | number, month: number) => Number(fy) + (month < 3 ? 1 : 0);

/**
 * Computes every {fy, month} tuple that is due since joining_date up to (but NOT including)
 * the current BS month, then subtracts months already paid.
 *
 * Only fully-expired months are considered due. The current (ongoing) month is never shown.
 *
 * Returns an array sorted in fiscal order (Shrawan first).
 * Each entry: { fy, month, isOverdue }
 *   isOverdue = true  → already past; not yet paid (always true now)
 */
export type DueMonth = { fy: number; month: number; isOverdue: boolean; amount?: number };

export function getDueMonths(
  joiningDateBS: string | undefined,
  paidSet: Set<string>, // keys in format "fy:month"
  currentBS: string, // today in BS "YYYY/MM/DD"
): DueMonth[] {
  if (!joiningDateBS) return [];
  const normDate = (d: string) => en(d).replace(/[^0-9/]/g, "");

  const parseBSDate = (d: string) => {
    const parts = normDate(d).split("/").map(Number);
    return { y: parts[0] ?? 0, m: (parts[1] ?? 1) - 1, d: parts[2] ?? 1 }; // m is 0-indexed
  };

  const from = parseBSDate(joiningDateBS);
  const to = parseBSDate(currentBS);

  if (!from.y || !to.y) return [];

  // Walk every calendar month from joining to today
  const due: DueMonth[] = [];
  let cy = from.y;
  let cm = from.m; // 0-indexed (0=Baisakh, 11=Chaitra)

  // Only months that have fully expired are due; the current month is not yet due.
  const toTotal = to.y * 12 + to.m;

  while (cy * 12 + cm < toTotal) {
    // Fiscal year: Shrawan(3)–Chaitra(11) → fy = cy, Baisakh(0)–Asar(2) → fy = cy-1
    const fy = cm >= 3 ? cy : cy - 1;
    const key = `${fy}:${cm}`;
    if (!paidSet.has(key)) {
      due.push({ fy, month: cm, isOverdue: true });
    }
    cm++;
    if (cm > 11) {
      cm = 0;
      cy++;
    }
  }

  // Sort by fiscal order within each fy
  due.sort((a, b) => {
    if (a.fy !== b.fy) return a.fy - b.fy;
    return FISCAL_MONTHS.indexOf(a.month) - FISCAL_MONTHS.indexOf(b.month);
  });

  return due;
}

/**
 * Merges opening dues (manually entered historical dues) with auto-calculated due months.
 * Opening dues that are already in paidSet are excluded.
 * Opening dues that overlap auto-calculated dues are de-duplicated (opening due takes precedence for amount).
 */
export function mergeOpeningDues(
  autoDues: DueMonth[],
  openingDues: OpeningDue[] | undefined,
  paidSet: Set<string>,
): DueMonth[] {
  if (!openingDues || openingDues.length === 0) return autoDues;

  const openingKeys = new Set(openingDues.map((d) => `${d.fy}:${d.month}`));
  // auto dues that are NOT in opening dues (no overlap)
  const nonOverlapping = autoDues.filter((d) => !openingKeys.has(`${d.fy}:${d.month}`));

  // opening dues not yet paid
  const unpaidOpening: DueMonth[] = openingDues
    .filter((d) => !paidSet.has(`${d.fy}:${d.month}`))
    .map((d) => ({ fy: d.fy, month: d.month, isOverdue: true, amount: d.amount }));

  const all = [...unpaidOpening, ...nonOverlapping];
  all.sort((a, b) => {
    if (a.fy !== b.fy) return a.fy - b.fy;
    return FISCAL_MONTHS.indexOf(a.month) - FISCAL_MONTHS.indexOf(b.month);
  });
  return all;
}

/** Months/amounts still owed by one customer: paid receipt months are removed. */
export function remainingDuesForPerson(
  joiningDateBS: string | undefined,
  openingDues: OpeningDue[] | undefined,
  receipts: {
    ward: string;
    card: string;
    year: number | string;
    months: { m: number; year?: number }[];
  }[],
  ward: string,
  card: string,
  defaultMonthlyFee: number,
  currentBS: string,
): { months: DueMonth[]; total: number } {
  const paid = new Set(
    receipts
      .filter((r) => r.ward === ward && r.card.toLowerCase() === card.toLowerCase())
      .flatMap((r) => r.months.map((m) => `${m.year ?? r.year}:${m.m}`)),
  );
  const months = mergeOpeningDues(getDueMonths(joiningDateBS, paid, currentBS), openingDues, paid);
  return { months, total: months.reduce((s, dm) => s + (dm.amount ?? defaultMonthlyFee), 0) };
}

const NepaliDateCtor: typeof NepaliDate =
  typeof (NepaliDate as unknown as { fromAD?: unknown }).fromAD === "function"
    ? NepaliDate
    : ((NepaliDate as unknown as { default: typeof NepaliDate }).default as typeof NepaliDate);

export function todayBS() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kathmandu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (name: string) => Number(parts.find((p) => p.type === name)?.value);
  return NepaliDateCtor.fromAD(new Date(part("year"), part("month") - 1, part("day"))).format(
    "YYYY/MM/DD",
    "en",
  );
}
export function matchingPeople(
  people: Person[],
  ward: string,
  name: string = "",
  card: string = "",
  phone: string = "",
) {
  const n = name.trim().toLowerCase();
  const c = card.trim().toLowerCase();
  const ph = phone.trim();
  if (!n && !c && !ph) return [];
  return people
    .filter((p) => {
      if (p.ward !== ward) return false;
      const matchCard = c ? p.card.toLowerCase().includes(c) : false;
      const matchName = n ? p.name.toLowerCase().includes(n) : false;
      const matchPhone = ph ? p.phone.includes(ph) : false;
      const matchPan = c && p.pan ? p.pan.toLowerCase().includes(c) : false;
      const matchEmail = (c || n) && p.email ? p.email.toLowerCase().includes(c || n) : false;
      return matchCard || matchName || matchPhone || matchPan || matchEmail;
    })
    .slice(0, 8);
}
export function nextReceiptNumber(receipts: Receipt[], ward: string, year: string) {
  return (
    Math.max(0, ...receipts.filter((r) => r.ward === ward && r.year === year).map((r) => r.no)) + 1
  );
}
export function validateReceipt(
  p: Person,
  date: string,
  mode: string,
  months: Receipt["months"],
  registeredCards?: Set<string>,
) {
  if (!/^[1-9]\d?$/.test(p.ward) || !p.name.trim() || !p.tole.trim())
    return "Ward, name and tole are required.";
  if (!p.card.trim())
    return "Card number is required. Please select or register the customer in People Master first.";
  if (registeredCards && !registeredCards.has(p.card.trim())) {
    return `Customer (Card: ${p.card}) is not registered in People Master for Ward ${p.ward}. Please create the customer in People Master first.`;
  }
  if (p.phone.trim() && !/^9\d{9}$/.test(p.phone.trim()))
    return "Contact number is optional, but if given it must be 10 digits starting with 9.";
  if (!MODES.includes(mode)) return "Select a payment mode.";
  if (!parseBS(date)) return "Enter a valid Nepali date (YYYY/MM/DD).";
  if (
    !months.length ||
    months.some(
      (m) =>
        !Number.isInteger(m.m) ||
        m.m < 0 ||
        m.m > 11 ||
        !Number.isFinite(m.amt) ||
        m.amt <= 0 ||
        (m.year !== undefined && (!Number.isInteger(m.year) || m.year < 2079 || m.year > 2099)),
    )
  )
    return "Select at least one month with a positive amount.";
  return "";
}
/** Sum receipt totals by a key; returns rows sorted by amount desc. */
export function collectionBy(receipts: Receipt[], key: (r: Receipt) => string) {
  const map = new Map<string, { key: string; amount: number; count: number }>();
  for (const r of receipts) {
    const k = key(r) || "—";
    const row = map.get(k) ?? { key: k, amount: 0, count: 0 };
    row.amount += r.total;
    row.count += 1;
    map.set(k, row);
  }
  return [...map.values()].sort((a, b) => b.amount - a.amount);
}
/** Paid amount per BS month in fiscal order (Shrawan → Asar), from each receipt's month lines. */
export function collectionByMonth(receipts: Receipt[], targetYear?: number) {
  return FISCAL_MONTHS.map((m) => ({
    m,
    amount: receipts.reduce((a, r) => {
      const matching = r.months.filter(
        (x) =>
          x.m === m &&
          (!targetYear || (x.year ? x.year === targetYear : Number(r.year) === targetYear)),
      );
      return a + matching.reduce((s, x) => s + x.amt, 0);
    }, 0),
  }));
}
/** BS receipt date within optional inclusive BS range (YYYY/MM/DD). */
export function inBSRange(date: string, from: string, to: string) {
  const d = en(date);
  return (!from || d >= en(from)) && (!to || d <= en(to));
}

/** One completed collection trip (driver visited the customer's home). */
export type TripLogEntry = {
  id?: string;
  ward: string;
  card: string;
  fiscal_year: number;
  month: number;
  logged_at?: string;
};

/** Total planned trips per month from the customer's plan subscriptions. */
export function plannedTripsForPerson(p: Person, allPlans?: PlanItem[]): number {
  if (p.plans && p.plans.length > 0) {
    const sum = p.plans.reduce(
      (acc, sp) =>
        acc + (Number(sp.trips ?? sp.no_of_trips ?? 1) || 1) * (Number(sp.quantity) || 1),
      0,
    );
    if (sum > 0) return sum;
  }
  const matched = matchPlan(allPlans ?? [], p.plan_id, p.plan);
  return Number(matched?.trips ?? matched?.no_of_trips ?? 1) || 1;
}

/**
 * Trip progress colour: 0 done = red (बाँकी सबै), partial = orange, plan complete = green.
 * e.g. a 3-trip plan starts red, turns orange after the 1st trip and green after the 3rd.
 */
export function tripStatus(completed: number, planned: number): { color: string; label: string } {
  if (completed >= planned) return { color: "#10b981", label: "पूरा भयो त्रिप" };
  if (completed > 0) return { color: "#f59e0b", label: "जारी छ" };
  return { color: "#dc2626", label: "सुरु हुन बाँकी" };
}

/** Club Member (Designation, Name, Occupation, DOB, Membership Fee) */
export type Member = {
  id?: string;
  name: string;
  designation: string;
  occupation?: string;
  dob?: string;
  membership_fee?: number;
  phone?: string;
  address?: string;
  status?: "active" | "inactive";
  created_at?: string;
  updated_at?: string;
};

/** Backward compatibility alias */
export type BODMember = Member;

/** Authorized person for an event/programme */
export type AuthorizedPerson = {
  id?: string;
  name: string;
  designation?: string;
  role?: string;
  phone?: string;
  type: "employee" | "member" | "other";
};

/** Event or Programme record */
export type ClubEvent = {
  id?: string;
  title: string;
  locality: string;
  budget_required: number;
  budget_allocated?: number;
  commencing_date: string;
  end_date?: string;
  status: "planned" | "ongoing" | "completed" | "postponed";
  authorized_persons: AuthorizedPerson[];
  remarks?: string;
  created_at?: string;
  updated_at?: string;
};

/** Attendee in meeting minutes — members, advisors (सल्लाहकार) or representatives (प्रतिनिधि) */
export type MinutesAttendee = {
  name: string;
  designation?: string;
  category: "member" | "advisor" | "representative";
};

/** Agenda item — carries forward across meetings until done */
export type MinutesAgenda = {
  id: string;
  text: string;
  decision?: string;
  done: boolean;
};

/** Meeting minutes for an event/programme */
export type EventMinutes = {
  id?: string;
  event_id: string;
  meeting_date: string;
  attendees: MinutesAttendee[];
  agenda: MinutesAgenda[];
  draft: string;
  created_at?: string;
  updated_at?: string;
};

type SpeechRecognitionResultLike = {
  results: ArrayLike<ArrayLike<{ transcript: string; isFinal: boolean }>>;
};

export type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecognitionResultLike) => void) | null;
  onerror: () => void;
  onend: () => void;
};

export type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

/** Employee / Staff */
export type Employee = {
  id?: string;
  name: string;
  age?: number;
  dob?: string;
  designation: string;
  qualification?: string;
  basic_salary: number;
  allowance_type?: "day" | "trip" | "fixed" | "none";
  allowance_rate?: number;
  other_allowance?: number;
  phone?: string;
  pan?: string;
  status?: "active" | "inactive" | "on_leave";
  joining_date?: string;
  /** Ledger opening balance; employee account is credit (payable) by default */
  opening_balance?: number;
  balance_type?: "dr" | "cr";
  created_at?: string;
  updated_at?: string;
};

/** Monthly Payroll record for an employee */
export type PayrollRecord = {
  id?: string;
  year: number;
  month: number;
  employee_id: string;
  employee_name: string;
  designation: string;
  basic_salary: number;
  days_worked: number;
  total_days: number;
  trips: number;
  allowance: number;
  other_allowance?: number;
  gross_salary: number;
  tax: number;
  advance_adjusted: number;
  other_deductions: number;
  net_salary: number;
  /** "pending" = editable draft, "booked" = locked & ready to pay, "paid" = fully paid & immutable */
  payment_status: "paid" | "pending" | "booked";
  is_booked?: boolean;
  booked_at?: string;
  payment_date?: string;
  payment_mode?: "cash" | "bank" | "esewa" | "cheque";
  voucher_ref?: string;
  remarks?: string;
  created_at?: string;
  updated_at?: string;
};

/** Calculate salary breakdown for an employee row */
export function calculatePayrollRow(params: {
  basic_salary: number;
  days_worked: number;
  total_days?: number;
  trips?: number;
  allowance_type?: "day" | "trip" | "fixed" | "none";
  allowance_rate?: number;
  custom_allowance?: number;
  other_allowance?: number;
  tax?: number;
  advance_adjusted?: number;
  other_deductions?: number;
}) {
  const basic = Math.max(0, Number(params.basic_salary) || 0);
  const totalDays = Math.max(1, Number(params.total_days) || 26);
  const daysWorked = Math.max(0, Number(params.days_worked) || 0);
  const trips = Math.max(0, Number(params.trips) || 0);
  const rate = Math.max(0, Number(params.allowance_rate) || 0);

  // If days worked is full or totalDays, full basic, otherwise pro-rated if user prefers
  // In typical Nepal monthly payroll, basic is either full or pro-rated (basic * daysWorked / totalDays)
  // We calculate earned basic proportionally if daysWorked < totalDays, otherwise full
  const earnedBasic =
    daysWorked >= totalDays ? basic : Math.round((basic * daysWorked) / totalDays);

  let allowance = 0;
  if (
    params.custom_allowance !== undefined &&
    params.custom_allowance !== null &&
    !isNaN(params.custom_allowance)
  ) {
    allowance = Number(params.custom_allowance);
  } else {
    const type = params.allowance_type || "day";
    if (type === "day") {
      allowance = Math.round(daysWorked * rate);
    } else if (type === "trip") {
      allowance = Math.round(trips * rate);
    } else if (type === "fixed") {
      allowance = rate;
    }
  }

  const other_allowance = Math.max(0, Number(params.other_allowance) || 0);
  const gross_salary = Math.max(0, earnedBasic + allowance + other_allowance);
  const tax = Math.max(0, Number(params.tax) || 0);
  const advance_adjusted = Math.max(0, Number(params.advance_adjusted) || 0);
  const other_deductions = Math.max(0, Number(params.other_deductions) || 0);
  const net_salary = Math.max(0, gross_salary - tax - advance_adjusted - other_deductions);

  return {
    earned_basic: earnedBasic,
    allowance,
    other_allowance,
    gross_salary,
    tax,
    advance_adjusted,
    other_deductions,
    net_salary,
  };
}

// ─────────────────────────────────────────────
// Employee Ledger (Dr/Cr) — employee account is a credit/payable ledger
// ─────────────────────────────────────────────

/** One posting row in an employee's Dr/Cr ledger */
export type EmployeeLedgerRow = {
  id: string;
  /** BS display date; "-" for the opening pseudo-row */
  date_bs: string;
  particulars: string;
  source: "opening" | "salary_booked" | "salary_paid" | "advance";
  ref?: string;
  dr: number;
  cr: number;
  /** Absolute running balance */
  running: number;
  /** Side the running balance sits on: positive seed = dr, negative = cr */
  runType: "dr" | "cr";
};

/** Employee-side receipt/payment row as loaded into the members workspace */
export type EmployeeLedgerTxn = {
  id: string;
  ref_no: string;
  txn_date: string;
  party_id?: string;
  amount: number;
  remarks?: string;
  /** "payment" | "receipt"; omitted by older cached data (treated as payment) */
  txn_type?: string;
};

const SALARY_PAY_REMARK_PREFIX = "मासिक तलब भुक्तानी";

/**
 * Advance payments made to an employee from Receipts & Payments.
 * Excludes salary-payment vouchers: those are matched by payroll voucher_ref
 * (and by the auto-generated salary remarks), so a salary pay is never double
 * counted as an advance.
 */
export function employeeAdvanceTransactions(
  employeeId: string | undefined,
  transactions: EmployeeLedgerTxn[],
  payrolls: PayrollRecord[],
): EmployeeLedgerTxn[] {
  if (!employeeId) return [];
  const salaryRefs = new Set(
    payrolls
      .map((r) => (r.voucher_ref ?? "").trim())
      .filter((ref): ref is string => ref.length > 0),
  );
  return transactions.filter((t) => {
    if (t.party_id !== employeeId) return false;
    if (t.txn_type && t.txn_type !== "payment") return false;
    const ref = (t.ref_no ?? "").trim();
    if (salaryRefs.has(ref)) return false;
    const remarks = (t.remarks ?? "").trim();
    if (remarks.startsWith(SALARY_PAY_REMARK_PREFIX)) return false;
    return true;
  });
}

/**
 * Builds the employee's Dr/Cr ledger:
 * - Opening balance row (Cr by default, from employee master)
 * - Booked salary → Cr: gross − TDS − other deductions
 *   (= net_salary + advance_adjusted, so an advance cash payment posted as Dr
 *   is not double-counted)
 * - Salary paid (cash) → Dr: net_salary
 * - Advance paid (cash) → Dr
 * Draft (pending) payroll rows do not post.
 */
export function buildEmployeeLedger(params: {
  employee?: Pick<Employee, "id" | "opening_balance" | "balance_type"> | null;
  payrolls: PayrollRecord[];
  transactions: EmployeeLedgerTxn[];
}): EmployeeLedgerRow[] {
  const { employee, payrolls, transactions } = params;
  const opening = Math.max(0, Number(employee?.opening_balance) || 0);
  const balType: "dr" | "cr" = employee?.balance_type === "dr" ? "dr" : "cr";

  type Draft = Omit<EmployeeLedgerRow, "running" | "runType"> & {
    sortKey: string;
    rank: number;
  };
  const drafts: Draft[] = [];

  for (const r of payrolls) {
    const posted =
      r.payment_status === "booked" || r.payment_status === "paid" || r.is_booked === true;
    if (!posted) continue;

    const sortKey = `${r.year}-${String(r.month + 1).padStart(2, "0")}`;
    const monthLabel = `${MONTHS[r.month] ?? `महिना ${r.month + 1}`} ${r.year}`;
    const credit = Math.max(
      0,
      (Number(r.gross_salary) || 0) - (Number(r.tax) || 0) - (Number(r.other_deductions) || 0),
    );
    if (credit > 0) {
      drafts.push({
        id: `booked-${r.id ?? `${r.year}-${r.month}`}`,
        date_bs: monthLabel,
        particulars: `तलब बुकिङ (Salary Booked) — ${monthLabel}`,
        source: "salary_booked",
        dr: 0,
        cr: credit,
        sortKey,
        rank: 1,
      });
    }

    if (r.payment_status === "paid") {
      const paid = Math.max(0, Number(r.net_salary) || 0);
      if (paid > 0) {
        drafts.push({
          id: `paid-${r.id ?? `${r.year}-${r.month}`}`,
          date_bs: (r.payment_date ?? "").trim() || monthLabel,
          particulars: `तलब भुक्तानी (Salary Paid) — ${monthLabel}`,
          source: "salary_paid",
          ref: (r.voucher_ref ?? "").trim(),
          dr: paid,
          cr: 0,
          sortKey,
          rank: 2,
        });
      }
    }
  }

  const advances = employeeAdvanceTransactions(employee?.id, transactions, payrolls);
  for (const t of advances) {
    const paid = Math.max(0, Number(t.amount) || 0);
    if (paid <= 0) continue;
    const date = (t.txn_date ?? "").trim();
    drafts.push({
      id: `adv-${t.id}`,
      date_bs: date || "-",
      particulars: (t.remarks ?? "").trim() || "पेश्की भुक्तानी (Advance Paid)",
      source: "advance",
      ref: (t.ref_no ?? "").trim(),
      dr: paid,
      cr: 0,
      // BS date "YYYY/MM/DD" → "YYYY-MM", matching the payroll month key
      sortKey: date ? date.slice(0, 7).replace("/", "-") : "9999-99",
      rank: 3,
    });
  }

  drafts.sort((a, b) => {
    if (a.sortKey !== b.sortKey) return a.sortKey < b.sortKey ? -1 : 1;
    return a.rank - b.rank;
  });

  const rows: EmployeeLedgerRow[] = [];
  // Positive running = Dr balance, negative = Cr (same convention as vendor ledger)
  let running = balType === "dr" ? opening : -opening;
  rows.push({
    id: "opening",
    date_bs: "-",
    particulars: "प्रारम्भिक शेष (Opening Balance)",
    source: "opening",
    dr: balType === "dr" ? opening : 0,
    cr: balType === "cr" ? opening : 0,
    running: opening,
    runType: balType,
  });
  for (const { sortKey: _sortKey, rank: _rank, ...d } of drafts) {
    running = running + d.dr - d.cr;
    rows.push({
      ...d,
      running: Math.abs(running),
      runType: running >= 0 ? "dr" : "cr",
    });
  }
  return rows;
}

/**
 * Outstanding debit balance (employee owes the club) from the employee's
 * Dr/Cr ledger. Returns 0 when the ledger sits on the credit side.
 * Used to pre-fill the advance-katti (advance_adjusted) amount when booking
 * payroll; the user can still adjust the amount before booking.
 */
export function employeeOutstandingDr(
  employee: Pick<Employee, "id" | "opening_balance" | "balance_type"> | null | undefined,
  payrolls: PayrollRecord[],
  transactions: EmployeeLedgerTxn[],
): number {
  const rows = buildEmployeeLedger({ employee: employee ?? null, payrolls, transactions });
  const last = rows[rows.length - 1];
  if (!last || last.runType !== "dr") return 0;
  return Math.max(0, last.running);
}

// ─────────────────────────────────────
// Vendor Master & Ledger
// ─────────────────────────────────────────────

/** Vendor master record */
export type Vendor = {
  id?: string;
  name: string;
  address?: string;
  pan_vat?: string;
  phone?: string;
  email?: string;
  due_days?: number;
  opening_balance?: number;
  balance_type?: "dr" | "cr";
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
};

/** One entry in a vendor's ledger */
export type VendorLedgerEntry = {
  id?: string;
  vendor_id: string;
  date_bs: string;
  description: string;
  dr: number;
  cr: number;
  balance: number;
  ref_type?: string;
  ref_id?: string;
  created_at?: string;
};

// ─────────────────────────────────────────────
// Expenses / Fixed Assets / Items
// ─────────────────────────────────────────────

/** One line in a fixed-asset or inventory purchase */
export type AssetLineItem = {
  item_code: string;
  name: string;
  lot: string;
  uom: string;
  qty: number;
  rate: number;
  amount: number;
};

/** One line in an OpEx expense */
export type ExpenseLineItem = {
  description: string;
  uom: string;
  qty: number;
  rate: number;
  amount: number;
  tds_applicable: boolean;
  tds_rate: number;
  tds_amount: number;
  net_amount: number;
};

/** Full expense / fixed-asset / inventory record */
export type ExpenseRecord = {
  id?: string;
  expense_type: "fixed_asset" | "item" | "expense";
  date_bs: string;
  bill_number?: string;
  vendor_id?: string;
  vendor_name?: string;
  linked_member_id?: string;
  linked_employee_id?: string;
  linked_event_id?: string;
  line_items: AssetLineItem[] | ExpenseLineItem[];
  other_charges?: number;
  other_charges_desc?: string;
  discount?: number;
  discount_desc?: string;
  subtotal?: number;
  final_amount: number;
  bill_scanned_amount?: number;
  bill_match_status?: "match" | "mismatch" | "pending";
  remarks?: string;
  status?: "draft" | "approved";
  created_at?: string;
  updated_at?: string;
};

/** Item master (reusable item catalogue) */
export type ItemMaster = {
  id?: string;
  item_code: string;
  name: string;
  parent?: string;
  sub_parent?: string;
  uom: string;
  units?: number;
  amount?: number;
  category?: "asset" | "item";
  last_rate?: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
};

/** Fixed Asset Master (स्थिर सम्पत्ति सूची) */
export type FixedAssetMaster = {
  id?: string;
  code: string;
  name: string;
  parent?: string;
  sub_parent?: string;
  uom: string;
  units?: number;
  amount?: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
};

/** Standard Item Master Parent Categories */
export const ITEM_PARENTS = [
  "सफाई तथा फोहोरमैला सामाग्री (Cleaning & Waste)",
  "कार्यालय तथा स्टेशनरी सामाग्री (Office & Stationery)",
  "इन्धन तथा लुब्रिकेन्ट्स (Fuel & Lubricants)",
  "मर्मत तथा पार्टपुर्जा सामाग्री (Maintenance & Parts)",
  "स्वास्थ्य तथा सुरक्षा पोशाक (Safety & Health PPE)",
  "प्रचार प्रसार तथा मुद्रण सामाग्री (Printing & Publicity)",
  "अन्य उपभोग्य सामग्री (Other Consumables)",
];

/** Standard Fixed Asset Parent Categories */
export const FIXED_ASSET_PARENTS = [
  "सवारी साधन (Vehicles)",
  "कार्यालय उपकरण तथा कम्प्युटर (IT & Office Equipment)",
  "फर्निचर तथा फिक्चर्स (Furniture & Fixtures)",
  "मेसिनरी तथा मेशिन औजार (Machinery & Plant)",
  "फोहोरमैला प्रशोधन उपकरण (Waste Processing Plant)",
  "जग्गा तथा संरचना/भवन (Land & Building)",
  "अन्य स्थिर सम्पत्ति (Other Fixed Assets)",
];

export const COMMON_UOM_OPTIONS = [
  "nos",
  "kg",
  "ltr",
  "mtr",
  "ft",
  "pkt",
  "box",
  "set",
  "pair",
  "roll",
  "unit",
  "drum",
  "sack",
];

/* ── Receipts & Payments module ───────────────────────────────── */

export interface RPAccount {
  id: string;
  account_type: "cash" | "bank";
  name: string;
  account_number?: string | null;
  opening_balance: number;
  address?: string | null;
  remarks?: string | null;
  owner_id?: string;
  created_at?: string;
}

export type RPTxnType = "receipt" | "payment" | "transfer";

/** Reference prefix per cash-book transaction type: R-xxxx, P-xxxx, T-xxxx. */
export const RP_REF_PREFIX: Record<RPTxnType, string> = {
  receipt: "R",
  payment: "P",
  transfer: "T",
};

/** Formats the cash-book reference; used by the form preview and the saved voucher. */
export const rpReference = (type: RPTxnType, seq: number) =>
  `${RP_REF_PREFIX[type]}-${String(Math.max(1, Math.floor(seq))).padStart(4, "0")}`;

/** Sequence (xxxx) from a saved reference, 0 when unparseable. */
export const rpRefSeq = (ref: string) => {
  const m = /^[RPT]-(\d+)$/.exec(ref.trim());
  return m ? Number(m[1]) : 0;
};

export interface RPTransaction {
  id: string;
  txn_type: RPTxnType;
  ref_no: string;
  txn_date: string;
  account_id: string;
  to_account_id?: string | null;
  party_type?: string | null;
  party_id?: string | null;
  party_name?: string | null;
  amount: number;
  remarks?: string | null;
  fiscal_year?: number | null;
  ref_month?: number | null;
  account_name?: string | null;
  owner_id?: string;
  created_at?: string;
}

export interface RPParty {
  id: string;
  name: string;
}

export const RP_TXN_TYPES: Array<{ value: RPTxnType; label: string }> = [
  { value: "receipt", label: "रसिद आम्दानी" },
  { value: "payment", label: "भुक्तानी खर्च" },
  { value: "transfer", label: "सार्वेक्षण (Transfer)" },
];

/* ── Theli daily log (collector cart out/in) ──────────────────── */

/** One morning-out or evening-in range row: card range देखि–सम्म र रसिद संख्या. */
export type TheliRangeEntry = { from: string; to: string; count: number };

/** Daily theli record: out ranges in the morning, closing serial in the evening, cash amounts. */
export type TheliLog = {
  id?: string;
  log_date: string; // BS "YYYY/MM/DD"
  ward?: string;
  employee_id: string;
  employee_name: string;
  supervisor_type: "member" | "employee";
  supervisor_id: string;
  supervisor_name: string;
  opening_balance: number; // cash balance carried in from the previous day (प्रति-कर्मचारी)
  out_entries: TheliRangeEntry[];
  in_entries: TheliRangeEntry[]; // legacy range rows; new model uses closing_serial
  closing_serial?: string; // खारेज सिरियल: आज काटिएको अन्तिम रसिद
  cancelled_count?: number; // रद्द रसिद संख्या
  settled?: boolean; // सेटल: बोकेको समग्र अन्तर बुझाइयो
  amount: number; // collected during the day
  cleared_amount: number; // handed over / deposited
  remarks?: string;
  owner_id?: string;
  created_at?: string;
  updated_at?: string;
};

/** Extract the numeric tail of a serial like "GT-001" → 1, "2294" → 2294. NaN when no digits. */
export function theliSerialNumber(serial: string | undefined): number {
  const digits = (serial ?? "").replace(/[^0-9]/g, "");
  return digits ? Number(digits) : NaN;
}

/** देखि–सम्म सिरियलको फरकबाट रसिद संख्या (समेत गणना); सिरियल भर्न नसके म्यानुअल count. */
export function theliRangeCount(entry: TheliRangeEntry): number {
  const f = theliSerialNumber(entry.from);
  const t = theliSerialNumber(entry.to);
  if (!isNaN(f) && !isNaN(t) && t >= f) return t - f + 1;
  return Math.max(0, Number(entry.count) || 0);
}

/** Sum of stored counts in a range list (legacy shape helper). */
export function theliRangeSum(entries: TheliRangeEntry[] | undefined): number {
  return (entries ?? []).reduce((s, e) => s + (Number(e.count) || 0), 0);
}

/**
 * आज काटिएको रसिद: खारेज सिरियलले ढाकेको भाग — सिरियल समेत गणना.
 * Multi-range serial books are counted per covered span; खारेज खाली हुँदा 0.
 */
export function theliRasidsOut(
  outEntries: TheliRangeEntry[] | undefined,
  closingSerial: string | undefined,
): number {
  const c = theliSerialNumber(closingSerial);
  if (isNaN(c)) return 0;
  let total = 0;
  for (const e of outEntries ?? []) {
    const f = theliSerialNumber(e.from);
    const t = theliSerialNumber(e.to);
    if (isNaN(f) || isNaN(t)) continue;
    total += Math.max(0, Math.min(c, t) - f + 1);
  }
  return total;
}

/** अन्तिम रसिद = काटिएको − रद्द (कसै पनि न्यून मान 0). */
export function theliFinalRasids(rasidsOut: number, cancelled: number): number {
  return Math.max(0, (Number(rasidsOut) || 0) - (Number(cancelled) || 0));
}

/** Serial rebuilt with the same prefix/padding as the typed one: ("GT-050", 31) → "GT-031". */
export function theliSerialWithFormat(source: string, n: number): string {
  const digits = (source ?? "").replace(/[^0-9]/g, "");
  const prefix = (source ?? "").replace(/[0-9]/g, "");
  return `${prefix}${String(n).padStart(digits.length || 1, "0")}`;
}

/**
 * फर्किएको (बाँकी) रसिद दायरा: खारेज सिरियल पछिको हिस्सा —
 * देखि GT-001–सम्म GT-050 र खारेज GT-030 भए → GT-031–GT-050 (20).
 * खारेज भरिएको छैन वा सबै काटिसकेको भए null.
 */
export function theliRemainingRange(
  outEntries: TheliRangeEntry[] | undefined,
  closingSerial: string | undefined,
): TheliRangeEntry | null {
  const c = theliSerialNumber(closingSerial);
  if (isNaN(c)) return null;
  let start: number | null = null;
  let end = 0;
  let fromSource = "";
  let toValue = "";
  for (const e of outEntries ?? []) {
    const f = theliSerialNumber(e.from);
    const t = theliSerialNumber(e.to);
    if (isNaN(f) || isNaN(t) || t <= c) continue;
    const s = Math.max(c + 1, f);
    if (start === null || s < start) {
      start = s;
      fromSource = e.from;
    }
    if (t > end) {
      end = t;
      toValue = e.to;
    }
  }
  if (start === null || end < start) return null;
  return {
    from: theliSerialWithFormat(fromSource, start),
    to: toValue,
    count: end - start + 1,
  };
}

/** Daily theli live arithmetic: out/in counts, rasids cut (खारेज basis), final rasids, cash balance. */
export function theliTotals(
  log: Pick<
    TheliLog,
    "opening_balance" | "amount" | "cleared_amount" | "out_entries" | "in_entries"
  > &
    Partial<Pick<TheliLog, "closing_serial" | "cancelled_count" | "settled">>,
): {
  outCount: number;
  inCount: number;
  outsideCount: number;
  balance: number;
  rasidsOut: number;
  cancelledCount: number;
  finalRasids: number;
} {
  const outCount = theliRangeSum(log.out_entries);
  const inCount = theliRangeSum(log.in_entries);
  const rasidsOut = theliRasidsOut(log.out_entries, log.closing_serial);
  const cancelledCount = Math.max(0, Number(log.cancelled_count) || 0);
  return {
    outCount,
    inCount,
    outsideCount: Math.max(outCount - inCount, 0),
    balance:
      (Number(log.opening_balance) || 0) +
      (Number(log.amount) || 0) -
      (Number(log.cleared_amount) || 0),
    rasidsOut,
    cancelledCount,
    finalRasids: theliFinalRasids(rasidsOut, cancelledCount),
  };
}

/**
 * Cash balance carried from the latest log earlier than logDate ("YYYY/MM/DD" lexical works).
 * With employeeId set, the carry is per collector — each person's अन्तर carries forward
 * separately until it is ticked as settled (सेटल).
 */
export function theliOpeningBalance(
  logs: (Pick<
    TheliLog,
    "log_date" | "opening_balance" | "amount" | "cleared_amount" | "out_entries" | "in_entries"
  > & { employee_id?: string })[],
  logDate: string,
  employeeId?: string,
): number {
  const key = logDate.replace(/[^0-9]/g, "");
  let latest: { date: string; balance: number } | null = null;
  for (const l of logs) {
    if (employeeId && l.employee_id && l.employee_id !== employeeId) continue;
    const k = l.log_date.replace(/[^0-9]/g, "");
    if (!k || k >= key) continue;
    if (!latest || k > latest.date) latest = { date: k, balance: theliTotals(l).balance };
  }
  return latest ? latest.balance : 0;
}

/**
 * Ranges still outside: each out range is matched against an in range with the same
 * देखि–सम्म pair; surplus counts of a matched out range remain, unmatched out ranges
 * stay whole.
 */
export function theliOutsideRanges(
  outEntries: TheliRangeEntry[],
  inEntries: TheliRangeEntry[],
): TheliRangeEntry[] {
  const norm = (s: string) => s.trim().toUpperCase();
  const used = new Array(inEntries.length).fill(false);
  const outside: TheliRangeEntry[] = [];
  for (const o of outEntries) {
    let remaining = o.count;
    inEntries.forEach((i, idx) => {
      if (!used[idx] && norm(i.from) === norm(o.from) && norm(i.to) === norm(o.to)) {
        used[idx] = true;
        remaining -= i.count;
      }
    });
    if (remaining > 0) outside.push({ from: o.from, to: o.to, count: remaining });
  }
  return outside;
}

/* ══════════════════════════════════════════════════════════════════
   THELI STOCK, ISSUANCE & EMPLOYEE REPORTING
   ══════════════════════════════════════════════════════════════════ */

export type TheliRangeStatus =
  "available" | "returned_remaining" | "issued" | "partially_booked" | "completed";

export type TheliStockBatch = {
  id: string;
  municipality: string;
  ward: string;
  fiscal_year: string;
  start_from: string;
  end_to: string;
  vouchers_per_theli: number;
  total_vouchers: number;
  total_theli: number;
  created_at?: string;
  remarks?: string;
};

export type TheliStockItem = {
  id: string;
  batch_id?: string;
  municipality: string;
  ward: string;
  fiscal_year: string;
  theli_no?: number;
  range_from: string;
  range_to: string;
  total_vouchers: number;
  status: TheliRangeStatus;
  is_remaining_open?: boolean; // True when partially returned and ready to be issued first!

  // Issuance info
  issued_to_id?: string;
  issued_to_name?: string;
  supervisor_name?: string;
  issued_date?: string;

  // Reporting / booking
  last_voucher_booked?: string;
  booked_vouchers_count?: number;
  remaining_vouchers_count?: number;
  remaining_range_from?: string;
  remaining_range_to?: string;
  amount_booked?: number;
  amount_obtained?: number;
  balance?: number;

  updated_at?: string;
};

/**
 * Calculates total number of vouchers and thelis from range start and end.
 * E.g. start: "GT-0001", end: "GT-1000", vouchersPerTheli: 50 -> { totalVouchers: 1000, totalTheli: 20 }
 */
export function calculateTheliStockCounts(
  startFrom: string | undefined,
  endTo: string | undefined,
  vouchersPerTheli = 50,
): { totalVouchers: number; totalTheli: number } {
  const s = theliSerialNumber(startFrom);
  const e = theliSerialNumber(endTo);
  if (isNaN(s) || isNaN(e) || e < s) {
    return { totalVouchers: 0, totalTheli: 0 };
  }
  const totalVouchers = e - s + 1;
  const perTheli = Math.max(1, vouchersPerTheli);
  const totalTheli = Math.ceil(totalVouchers / perTheli);
  return { totalVouchers, totalTheli };
}

/**
 * Generates discrete theli book items from a stock batch.
 * E.g. "GT-001" to "GT-150" with 50/theli -> 3 items (1..50, 51..100, 101..150).
 */
export function generateTheliRanges(
  batch: Pick<
    TheliStockBatch,
    "municipality" | "ward" | "fiscal_year" | "start_from" | "end_to"
  > & {
    id?: string;
    vouchers_per_theli?: number;
  },
): TheliStockItem[] {
  const s = theliSerialNumber(batch.start_from);
  const e = theliSerialNumber(batch.end_to);
  if (isNaN(s) || isNaN(e) || e < s) return [];

  const perTheli = Math.max(1, batch.vouchers_per_theli ?? 50);
  const items: TheliStockItem[] = [];
  let curr = s;
  let theliNo = 1;

  while (curr <= e) {
    const nextEnd = Math.min(curr + perTheli - 1, e);
    const rangeFrom = theliSerialWithFormat(batch.start_from, curr);
    const rangeTo = theliSerialWithFormat(batch.end_to, nextEnd);
    const count = nextEnd - curr + 1;

    items.push({
      id: `${batch.id || "batch"}-th-${theliNo}`,
      batch_id: batch.id,
      municipality: batch.municipality,
      ward: batch.ward,
      fiscal_year: batch.fiscal_year,
      theli_no: theliNo,
      range_from: rangeFrom,
      range_to: rangeTo,
      total_vouchers: count,
      status: "available",
      is_remaining_open: false,
      booked_vouchers_count: 0,
      remaining_vouchers_count: count,
      amount_booked: 0,
      amount_obtained: 0,
      balance: 0,
    });

    curr = nextEnd + 1;
    theliNo++;
  }

  return items;
}

/**
 * Sorts available theli items so that remaining/returned open thelis
 * appear at the VERY TOP (first range should show this is remaining one),
 * followed by fresh unopened ones in serial order.
 */
export function sortTheliAvailableRanges(items: TheliStockItem[]): TheliStockItem[] {
  return [...items].sort((a, b) => {
    // 1. Remaining/returned open thelis always rank first
    const aIsRemaining = a.is_remaining_open || a.status === "returned_remaining";
    const bIsRemaining = b.is_remaining_open || b.status === "returned_remaining";
    if (aIsRemaining && !bIsRemaining) return -1;
    if (!aIsRemaining && bIsRemaining) return 1;

    // 2. Otherwise sort by numeric start serial
    const aNum = theliSerialNumber(a.range_from);
    const bNum = theliSerialNumber(b.range_from);
    if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;

    return a.range_from.localeCompare(b.range_from);
  });
}

/**
 * Calculates booking metrics when an employee reports the last voucher booked.
 */
export function calculateTheliBooking(
  item: TheliStockItem,
  lastVoucherBooked: string | undefined,
  amountBookedInput?: number,
  amountObtainedInput?: number,
  carriedBalance = 0,
): {
  bookedCount: number;
  remainingCount: number;
  remainingRange: { from: string; to: string; count: number } | null;
  amountBooked: number;
  amountObtained: number;
  newBalance: number;
  isFullyExhausted: boolean;
} {
  const startNum = theliSerialNumber(item.range_from);
  const endNum = theliSerialNumber(item.range_to);
  const lastNum = theliSerialNumber(lastVoucherBooked);

  if (isNaN(startNum) || isNaN(endNum)) {
    return {
      bookedCount: 0,
      remainingCount: item.total_vouchers,
      remainingRange: null,
      amountBooked: 0,
      amountObtained: amountObtainedInput || 0,
      newBalance: carriedBalance - (amountObtainedInput || 0),
      isFullyExhausted: false,
    };
  }

  if (isNaN(lastNum) || lastNum < startNum) {
    // No vouchers booked yet
    return {
      bookedCount: 0,
      remainingCount: endNum - startNum + 1,
      remainingRange: { from: item.range_from, to: item.range_to, count: endNum - startNum + 1 },
      amountBooked: 0,
      amountObtained: amountObtainedInput || 0,
      newBalance: carriedBalance - (amountObtainedInput || 0),
      isFullyExhausted: false,
    };
  }

  const clampedLast = Math.min(lastNum, endNum);
  const bookedCount = clampedLast - startNum + 1;
  const remainingCount = Math.max(0, endNum - clampedLast);

  const remainingRange =
    remainingCount > 0
      ? {
          from: theliSerialWithFormat(item.range_to, clampedLast + 1),
          to: item.range_to,
          count: remainingCount,
        }
      : null;

  const amountBooked = Math.max(0, amountBookedInput || 0);
  const amountObtained = Math.max(0, amountObtainedInput || 0);
  const newBalance = carriedBalance + amountBooked - amountObtained;

  return {
    bookedCount,
    remainingCount,
    remainingRange,
    amountBooked,
    amountObtained,
    newBalance,
    isFullyExhausted: remainingCount === 0,
  };
}
