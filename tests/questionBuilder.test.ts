import { describe, it, expect } from "vitest"
import { buildQuestions, QUESTION_SET_VERSION, QuestionInput } from "../src/scanner/questionBuilder"
import { NICHE_PHRASES, nichePhrase } from "../src/scanner/nichePhrases"

const base: QuestionInput = {
  businessName: "Sunrise Dental",
  city: "Dhaka",
  niche: "Dental clinic",
  nameVariants: ["Sunrise Dental Care", "SDC"],
  knownFor: ["Root canal", "Teeth whitening", "Braces"],
  competitors: ["Smile Hub", "Bright Teeth"],
}

describe("buildQuestions", () => {
  it("returns 8 questions with the right group counts", () => {
    const qs = buildQuestions(base)
    expect(qs).toHaveLength(8)
    const count = (g: string) => qs.filter((q) => q.group === g).length
    expect(count("find")).toBe(3)
    expect(count("compare")).toBe(2)
    expect(count("need")).toBe(2)
    expect(count("reputation")).toBe(1)
    expect(new Set(qs.map((q) => q.id)).size).toBe(8)
    expect(QUESTION_SET_VERSION).toBe("v2")
  })

  it("scores 7 and leaves reputation unscored", () => {
    const qs = buildQuestions(base)
    expect(qs.filter((q) => q.scored)).toHaveLength(7)
    expect(qs.filter((q) => !q.scored).map((q) => q.group)).toEqual(["reputation"])
  })

  it("is deterministic", () => {
    expect(buildQuestions(base)).toEqual(buildQuestions(structuredClone(base)))
  })

  it("keeps names, variants and competitors out of scored questions", () => {
    const text = buildQuestions(base)
      .filter((q) => q.scored)
      .map((q) => q.text.toLowerCase())
      .join("\n")
    for (const n of ["Sunrise Dental", "Sunrise Dental Care", "SDC", "Smile Hub", "Bright Teeth"]) {
      expect(text).not.toContain(n.toLowerCase())
    }
  })

  it("puts the business name in the reputation question", () => {
    const rep = buildQuestions(base).find((q) => q.group === "reputation")!
    expect(rep.text).toBe("What do people say about Sunrise Dental in Dhaka?")
  })

  it("uses the fixed templates with niche phrases", () => {
    const qs = buildQuestions(base)
    expect(qs[0].text).toBe("What is the best dentist in Dhaka?")
    expect(qs[1].text).toBe("Can you recommend a good dentist in Dhaka?")
    expect(qs[2].text).toBe("I'm looking for a reliable dentist near Dhaka. Any suggestions?")
    expect(qs[3].text).toBe("Compare the top dentists in Dhaka.")
    expect(qs[4].text).toBe("Which dentists in Dhaka are worth visiting, and how do they differ?")
  })

  it("uses the first two knownFor items, lowercased", () => {
    const needs = buildQuestions(base).filter((q) => q.group === "need")
    expect(needs[0].text).toBe("Which dentists in Dhaka are best known for root canal?")
    expect(needs[1].text).toContain("teeth whitening")
    expect(needs.map((q) => q.text).join()).not.toContain("braces")
  })

  it("fills generic needs when knownFor has 0 or 1 items", () => {
    const none = buildQuestions({ ...base, knownFor: [] }).filter((q) => q.group === "need")
    expect(none[0].text).toContain("good value for money")
    expect(none[1].text).toContain("excellent customer reviews")
    const one = buildQuestions({ ...base, knownFor: ["  Braces "] }).filter((q) => q.group === "need")
    expect(one[0].text).toContain("braces")
    expect(one[1].text).toContain("good value for money")
  })

  it("never repeats a need", () => {
    const needs = buildQuestions({ ...base, knownFor: ["Good value for money", "good value for money", ""] }).filter(
      (q) => q.group === "need"
    )
    expect(needs[0].text).toContain("good value for money")
    expect(needs[1].text).toContain("excellent customer reviews")
  })

  it("treats missing arrays as empty", () => {
    const qs = buildQuestions({ businessName: "X Cafe", city: "Leeds", niche: "Cafe" })
    expect(qs).toHaveLength(8)
    expect(qs[0].text).toBe("What is the best cafe in Leeds?")
  })

  it("handles Other and unknown niches", () => {
    const qs = buildQuestions({ ...base, niche: "  Shoe Store " })
    expect(qs[0].text).toBe("What is the best shoe store in Dhaka?")
    expect(qs[3].text).toBe("Compare the top shoe stores in Dhaka.")
    expect(nichePhrase("Bus")).toEqual({ singular: "bus", plural: "bus" })
    expect(nichePhrase("constructor").singular).toBe("constructor")
  })

  it("handles Home services", () => {
    const qs = buildQuestions({ ...base, niche: "Home services" })
    expect(qs[0].text).toBe("What is the best home services company in Dhaka?")
    expect(qs[3].text).toBe("Compare the top home services companies in Dhaka.")
  })

  it("pluralises unknown niches", () => {
    expect(nichePhrase("Toy shop")).toEqual({ singular: "toy shop", plural: "toy shops" })
    expect(nichePhrase("Bakery")).toEqual({ singular: "bakery", plural: "bakeries" })
    expect(nichePhrase("Toy")).toEqual({ singular: "toy", plural: "toys" })
    expect(nichePhrase("Boutiques")).toEqual({ singular: "boutiques", plural: "boutiques" })
  })

  it("uses business/businesses for a typed Other", () => {
    for (const label of ["Other", "other", " OTHER "]) {
      expect(nichePhrase(label)).toEqual({ singular: "business", plural: "businesses" })
    }
    const qs = buildQuestions({ ...base, niche: "Other" })
    expect(qs[0].text).toBe("What is the best business in Dhaka?")
    expect(qs[3].text).toBe("Compare the top businesses in Dhaka.")
  })

  it("throws when there is no city or location", () => {
    expect(() => buildQuestions({ ...base, city: " ", location: "" })).toThrow(
      "Cannot build questions: the business has no city or location"
    )
    expect(() => buildQuestions({ ...base, city: undefined, location: null })).toThrow(/no city or location/)
  })

  it("skips knownFor items that contain the business name, a variant or a competitor", () => {
    const needs = (knownFor: string[]) =>
      buildQuestions({ ...base, knownFor }).filter((q) => q.group === "need").map((q) => q.text)
    const hidden = needs(["Sunrise Dental whitening", "Braces", "Root canal"])
    expect(hidden[0]).toBe("Which dentists in Dhaka are best known for braces?")
    expect(hidden[1]).toBe("Which dentists in Dhaka are best known for root canal?")
    const variant = needs(["the SDC special", "Braces"])
    expect(variant[0]).toContain("braces")
    expect(variant[1]).toContain("good value for money")
    const rival = needs(["better than SMILE HUB", "Bright Teeth style care"])
    expect(rival[0]).toContain("good value for money")
    expect(rival[1]).toContain("excellent customer reviews")
  })

  it("ignores variants and competitors shorter than 2 characters", () => {
    const qs = buildQuestions({ ...base, nameVariants: ["a", " "], competitors: ["x", ""], knownFor: ["Braces", "Extra care"] })
    const needs = qs.filter((q) => q.group === "need")
    expect(needs[0].text).toContain("braces")
    expect(needs[1].text).toContain("extra care")
  })

  it("falls back to location for legacy clients", () => {
    const qs = buildQuestions({ ...base, city: undefined, location: " Chittagong " })
    expect(qs[0].text).toBe("What is the best dentist in Chittagong?")
    const blank = buildQuestions({ ...base, city: "  ", location: "Sylhet" })
    expect(blank[0].text).toContain("Sylhet")
  })

  it("keeps a City, State area exactly", () => {
    const qs = buildQuestions({ ...base, city: "Austin, Texas" })
    expect(qs[0].text).toBe("What is the best dentist in Austin, Texas?")
    expect(qs[7].text).toBe("What do people say about Sunrise Dental in Austin, Texas?")
  })

  it("trims and never leaves double spaces or braces", () => {
    const qs = buildQuestions({ ...base, businessName: "  Sunrise   Dental ", city: "  Dhaka ", knownFor: ["  Root   canal "] })
    for (const q of qs) {
      expect(q.text).toBe(q.text.trim())
      expect(q.text).not.toMatch(/\s{2,}/)
      expect(q.text).not.toMatch(/[{}]/)
    }
  })
})

describe("NICHE_PHRASES", () => {
  const labels = [
    "Restaurant", "Cafe", "Sweet shop or bakery", "Clinic or doctor", "Dental clinic",
    "Hospital or diagnostic center", "Salon or beauty parlour", "Gym or fitness",
    "Coaching center or tutoring", "School or university", "Real estate or developer",
    "Hotel or resort", "Travel agency", "Law firm", "Car repair or auto service",
    "Furniture or interior design", "Photography or event services", "Home services",
  ]

  it("has an entry for each of the 18 labels and nothing else", () => {
    expect(labels).toHaveLength(18)
    expect(Object.keys(NICHE_PHRASES).sort()).toEqual([...labels].sort())
    for (const l of labels) {
      expect(NICHE_PHRASES[l].singular).toBeTruthy()
      expect(NICHE_PHRASES[l].plural).toBeTruthy()
    }
  })

  it("uses international wording", () => {
    expect(NICHE_PHRASES["Salon or beauty parlour"].singular).toBe("beauty salon")
    expect(NICHE_PHRASES["Coaching center or tutoring"].singular).toBe("tutoring center")
    expect(NICHE_PHRASES["Real estate or developer"].singular).toBe("real estate agent or developer")
  })
})
