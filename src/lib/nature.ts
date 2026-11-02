export type BusinessNature = { label: string; emoji: string };

const NATURES: BusinessNature[] = [
  { label: "Individual / Freelancer", emoji: "👤" },
  { label: "Consultancy", emoji: "💼" },
  { label: "Hotel", emoji: "🏨" },
  { label: "Restaurant", emoji: "🍴" },
  { label: "Cafe", emoji: "☕" },
  { label: "Resort", emoji: "🏝️" },
  { label: "Bakery", emoji: "🥐" },
  { label: "Grocery Store", emoji: "🛒" },
  { label: "General Store", emoji: "🏪" },
  { label: "Supermarket", emoji: "🛍️" },
  { label: "Retail Business", emoji: "🏬" },
  { label: "Wholesale Business", emoji: "📦" },
  { label: "Distributor", emoji: "🚚" },
  { label: "Import Business", emoji: "🚢" },
  { label: "Export Business", emoji: "✈️" },
  { label: "Manufacturing Industry", emoji: "🏭" },
  { label: "Food Processing Industry", emoji: "🥫" },
  { label: "Agriculture / Farming", emoji: "🌾" },
  { label: "Dairy Farming", emoji: "🐄" },
  { label: "Poultry Farming", emoji: "🐔" },
  { label: "Livestock Farming", emoji: "🐐" },
  { label: "Construction Company", emoji: "🏗️" },
  { label: "Real Estate", emoji: "🏢" },
  { label: "Hardware Store", emoji: "🔨" },
  { label: "Furniture Business", emoji: "🪑" },
  { label: "Clothing / Garment Store", emoji: "👕" },
  { label: "Electronics Store", emoji: "📱" },
  { label: "Pharmacy", emoji: "💊" },
  { label: "Hospital", emoji: "🏥" },
  { label: "Clinic", emoji: "🩺" },
  { label: "Diagnostic Laboratory", emoji: "🧪" },
  { label: "School", emoji: "🏫" },
  { label: "College / University", emoji: "🎓" },
  { label: "Training Institute", emoji: "📚" },
  { label: "Accounting Firm", emoji: "🧮" },
  { label: "Audit Firm", emoji: "📊" },
  { label: "Law Firm", emoji: "⚖️" },
  { label: "Financial Services", emoji: "💰" },
  { label: "Bank / Financial Institution", emoji: "🏦" },
  { label: "Insurance Company", emoji: "🛡️" },
  { label: "Transportation Company", emoji: "🚚" },
  { label: "Travel Agency", emoji: "🧳" },
  { label: "Logistics / Courier", emoji: "📦" },
  { label: "IT / Software Company", emoji: "💻" },
  { label: "AI / Technology Company", emoji: "🤖" },
  { label: "Digital Marketing Agency", emoji: "📱" },
  { label: "Media / News Agency", emoji: "📰" },
  { label: "Event Management", emoji: "🎉" },
  { label: "Automobile Workshop / Dealership", emoji: "🚗" },
  { label: "Waste Management / Recycling", emoji: "♻️" },
];

export const BUSINESS_NATURES = NATURES;

export function natureEmoji(nature: string | null | undefined): string {
  if (!nature) return "";
  const found = NATURES.find((n) => n.label.toLowerCase() === nature.trim().toLowerCase());
  return found ? found.emoji : "";
}

export function natureLabel(nature: string | null | undefined): string {
  if (!nature) return "";
  const found = NATURES.find((n) => n.label.toLowerCase() === nature.trim().toLowerCase());
  return found ? found.label : nature.trim();
}
