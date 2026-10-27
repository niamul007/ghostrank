export interface NichePhrase {
  singular: string
  plural: string
}

// Keys are the exact niche labels the client form saves. Phrases are everyday
// international English (US, UK, Bangladesh) and must read naturally after
// "the best ..." / "a reliable ..." in the question templates.
export const NICHE_PHRASES: Record<string, NichePhrase> = {
  "Restaurant": { singular: "restaurant", plural: "restaurants" },
  "Cafe": { singular: "cafe", plural: "cafes" },
  "Sweet shop or bakery": { singular: "bakery or sweet shop", plural: "bakeries and sweet shops" },
  "Clinic or doctor": { singular: "doctor or clinic", plural: "doctors and clinics" },
  "Dental clinic": { singular: "dentist", plural: "dentists" },
  "Hospital or diagnostic center": { singular: "hospital or diagnostic center", plural: "hospitals and diagnostic centers" },
  "Salon or beauty parlour": { singular: "beauty salon", plural: "beauty salons" },
  "Hair salon": { singular: "hair salon", plural: "hair salons" },
  "Gym or fitness": { singular: "gym", plural: "gyms" },
  "Coaching center or tutoring": { singular: "tutoring center", plural: "tutoring centers" },
  "School or university": { singular: "school or university", plural: "schools and universities" },
  "Real estate or developer": { singular: "real estate agent or developer", plural: "real estate agents and developers" },
  "Hotel or resort": { singular: "hotel or resort", plural: "hotels and resorts" },
  "Travel agency": { singular: "travel agency", plural: "travel agencies" },
  "Law firm": { singular: "law firm", plural: "law firms" },
  "Car repair or auto service": { singular: "car repair shop", plural: "car repair shops" },
  "Furniture or interior design": { singular: "furniture store or interior designer", plural: "furniture stores and interior designers" },
  "Photography or event services": { singular: "photographer or event service", plural: "photographers and event services" },
  "Home services": { singular: "home services company", plural: "home services companies" },
}

// Mapped labels use the table above. Old clients and any unknown label fall
// back to the typed niche, lowercased. A typed "Other" reads as "business".
export function nichePhrase(niche: string): NichePhrase {
  const label = (niche ?? "").trim()
  if (Object.prototype.hasOwnProperty.call(NICHE_PHRASES, label)) return NICHE_PHRASES[label]
  const lower = label.toLowerCase()
  if (!lower || lower === "other") return { singular: "business", plural: "businesses" }
  let plural: string
  if (lower.endsWith("s")) plural = lower
  else if (/[^aeiou\W\d_]y$/.test(lower)) plural = `${lower.slice(0, -1)}ies`
  else plural = `${lower}s`
  return { singular: lower, plural }
}
