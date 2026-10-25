// ──────────────────────────────────────────
// Business form options — niche list, "known for" suggestions and the
// per-field limits. Kept in one place so other screens can reuse them.
// The niche label text is what gets saved (there is no separate id).
// ──────────────────────────────────────────

export const OTHER_NICHE = "Other"

export const NICHES = [
  "Restaurant",
  "Cafe",
  "Sweet shop or bakery",
  "Clinic or doctor",
  "Dental clinic",
  "Hospital or diagnostic center",
  "Salon or beauty parlour",
  "Gym or fitness",
  "Coaching center or tutoring",
  "School or university",
  "Real estate or developer",
  "Hotel or resort",
  "Travel agency",
  "Law firm",
  "Car repair or auto service",
  "Furniture or interior design",
  "Photography or event services",
  "Home services",
  OTHER_NICHE,
] as const

export const LIST_LIMITS = {
  nameVariants: 5,
  knownFor: 3,
  competitors: 3,
} as const

export const LIST_ITEM_MAX = 80

/** Tap-to-add suggestions for "known for", keyed by niche label (3 to 5 each). */
export const KNOWN_FOR_SUGGESTIONS: Record<string, string[]> = {
  Restaurant: ["Biryani", "Family dining", "Buffet", "Late-night food", "Home delivery"],
  Cafe: ["Coffee", "Desserts", "Cozy seating", "Work-friendly space", "Breakfast"],
  "Sweet shop or bakery": ["Cakes", "Traditional sweets", "Custom orders", "Fresh baked bread", "Gift boxes"],
  "Clinic or doctor": ["Experienced doctors", "Affordable fees", "Online appointments", "Specialist care"],
  "Dental clinic": ["Root canal", "Braces", "Teeth whitening", "Painless treatment", "Dental implants"],
  "Hospital or diagnostic center": ["24/7 emergency", "Pathology tests", "Modern equipment", "Specialist doctors"],
  "Salon or beauty parlour": ["Bridal makeup", "Haircuts", "Skin care", "Hair coloring", "Affordable prices"],
  "Gym or fitness": ["Personal training", "Modern equipment", "Women-only hours", "Weight loss programs"],
  "Coaching center or tutoring": ["Admission test prep", "Small batches", "Experienced teachers", "Online classes"],
  "School or university": ["Quality education", "Experienced faculty", "Scholarships", "Modern campus"],
  "Real estate or developer": ["Apartments", "Land sales", "Affordable housing", "On-time handover", "Prime locations"],
  "Hotel or resort": ["Family stays", "Swimming pool", "Event venue", "Free breakfast", "Prime location"],
  "Travel agency": ["Visa support", "Umrah and Hajj", "Tour packages", "Cheap air tickets"],
  "Law firm": ["Property disputes", "Family law", "Corporate law", "Free consultation"],
  "Car repair or auto service": ["Engine repair", "Car wash", "Genuine parts", "Quick service", "AC repair"],
  "Furniture or interior design": ["Custom furniture", "Home interiors", "Office interiors", "Affordable pricing"],
  "Photography or event services": ["Wedding photography", "Event coverage", "Drone shots", "Video editing"],
}
