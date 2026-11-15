// Seed location data linking municipalities, wards and toles.
// Shared by People Master form so selecting a tole auto-fills ward + municipality
// and selecting municipality/ward narrows the tole list.

export const SURKHET_DISTRICT = "सुर्खेत";

export interface MunicipalityInfo {
  name: string;
  wards: number;
}

export const MUNICIPALITIES: MunicipalityInfo[] = [
  { name: "वीरेन्द्रनगर नगरपालिका", wards: 16 },
  { name: "गुर्भाँकोट नगरपालिका", wards: 9 },
  { name: "बरेङ नगरपालिका", wards: 9 },
  { name: "चौकुने गाउँपालिका", wards: 7 },
  { name: "पाँचपुरिया गाउँपालिका", wards: 8 },
  { name: "लेकबेंसी गाउँपालिका", wards: 9 },
  { name: "भेरी गाउँपालिका", wards: 11 },
  { name: "बल्लिगुबा गाउँपालिका", wards: 8 },
];

// Birendranagar ward → known toles (extendable).
export const TOLES_BY_MUNICIPALITY_WARD: Record<string, Record<string, string[]>> = {
  "वीरेन्द्रनगर नगरपालिका": {
    "1": ["बिदौर", "देवीस्थान"],
    "2": ["डराम", "पुरानो बजार"],
    "3": ["तारगाउँ", "कर्णाली चोक"],
    "4": ["बीरेन्द्र चोक", "खोर्खे", "निर्मल चोक"],
    "5": ["चिसापानी", "सिद्ध बजार"],
    "6": ["बुद्धपथ", "बसपार्क", "फट्टे चोक"],
    "7": ["इट्रम", "पिपलटार"],
    "8": ["खड्कगाउँ", "मानिसको टार"],
    "9": ["लटीकोइली", "कुल्थोक"],
    "10": ["कुँडी", "एयरपोर्ट क्षेत्र"],
    "11": ["ढुल्लीकुँया", "भीमगिट्टे"],
    "12": ["नयाँ गाउँ", "देउटी भन्ज्याङ"],
    "13": ["माटेला", "भुमेश्वर"],
    "14": ["गर्फु", "बराहताल"],
    "15": ["रत्नाङ्गला", "बुल्भुले टार"],
    "16": ["छिन्चु", "ताल्लो छिन्चु"],
  },
  "गुर्भाँकोट नगरपालिका": {
    "1": ["गुर्भाँकोट बजार"],
    "2": ["कुसुमटार"],
    "3": ["लेकगाउँ"],
    "4": ["जमे"],
    "5": ["डुँडीचौर"],
    "6": ["काँदेरी"],
    "7": ["गोपालपुर"],
    "8": ["तातोपानी"],
    "9": ["कोटगाउँ"],
  },
  "बरेङ नगरपालिका": {
    "1": ["बरेङ बजार"],
    "2": ["ताती"],
    "3": ["जरसाली"],
    "4": ["भेरीगाड"],
    "5": ["कालीगण्डकी"],
    "6": ["डोटीगाड"],
    "7": ["कालिमाटी"],
    "8": ["सेटीगाड"],
    "9": ["राँगासाली"],
  },
  "चौकुने गाउँपालिका": {
    "1": ["चौकुने बजार"],
    "2": ["डाँडागाउँ"],
    "3": ["चिराइती"],
    "4": ["हिलेटार"],
    "5": ["खोलागाउँ"],
    "6": ["माझीगाउँ"],
    "7": ["लेकसानी"],
  },
  "पाँचपुरिया गाउँपालिका": {
    "1": ["पाँचपुरिया बजार"],
    "2": ["कमराङ"],
    "3": ["टारेङ"],
    "4": ["तुर्से"],
    "5": ["मेन्ची"],
    "6": ["खैरी"],
    "7": ["सुर्खेती"],
    "8": ["कुसे"],
  },
  "लेकबेंसी गाउँपालिका": {
    "1": ["लेकबेंसी बजार"],
    "2": ["कुपिन्डे"],
    "3": ["बेंसी"],
    "4": ["घोरेटार"],
    "5": ["ठुलो गाउँ"],
    "6": ["सल्यानगाड"],
    "7": ["डुम्रे"],
    "8": ["रामपुर"],
    "9": ["खडगभञ्ज्याङ"],
  },
  "भेरी गाउँपालिका": {
    "1": ["भेरी बजार"],
    "2": ["चिपुर"],
    "3": ["नेपालगन्ज"],
    "4": ["खरीगाड"],
    "5": ["देउराली"],
    "6": ["गुल्मीगाड"],
    "7": ["कोइली"],
    "8": ["भूरीगाड"],
    "9": ["राप्तीगाड"],
    "10": ["सिस्ने"],
    "11": ["तामास"],
  },
  "बल्लिगुबा गाउँपालिका": {
    "1": ["बल्लिगुबा बजार"],
    "2": ["कुँडा"],
    "3": ["टाँडी"],
    "4": ["गोरेटी"],
    "5": ["धुवाँ"],
    "6": ["टिमी"],
    "7": ["खरी"],
    "8": ["सल्घारी"],
  },
};

export function getWardOptions(municipality: string): { value: string; label: string }[] {
  const info = MUNICIPALITIES.find((m) => m.name === municipality);
  const count = info?.wards ?? 16;
  return Array.from({ length: count }, (_, i) => String(i + 1)).map((w) => ({
    value: w,
    label: `वडा ${w}`,
  }));
}

export function getToleOptions(
  municipality: string,
  ward: string,
): { value: string; label: string }[] {
  if (!municipality) return [];
  const byWard = TOLES_BY_MUNICIPALITY_WARD[municipality] ?? {};
  if (ward) return (byWard[ward] ?? []).map((t) => ({ value: t, label: t }));
  return Object.entries(byWard ?? {})
    .flatMap(([, toles]) => toles)
    .sort()
    .map((t) => ({ value: t, label: t }));
}

// Looks up the ward containing a tole within a municipality. Returns null when the
// tole is not in the seed data (caller keeps current values).
export function findWardForTole(municipality: string, tole: string): string | null {
  const byWard = TOLES_BY_MUNICIPALITY_WARD[municipality];
  if (!byWard) return null;
  const match = Object.entries(byWard).find(([, toles]) => toles.includes(tole));
  return match ? match[0] : null;
}

// Looks up the municipality containing a tole anywhere. Returns null when unknown.
export function findMunicipalityForTole(tole: string): string | null {
  for (const municipality of Object.keys(TOLES_BY_MUNICIPALITY_WARD)) {
    const byWard = TOLES_BY_MUNICIPALITY_WARD[municipality] ?? {};
    if (Object.values(byWard).some((toles) => toles.includes(tole))) return municipality;
  }
  return null;
}
