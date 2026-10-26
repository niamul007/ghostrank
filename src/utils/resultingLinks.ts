// What a client's three links would be after a PATCH.
// undefined = unchanged, "" or null = cleared.

export interface ClientLinks {
  website?: string | null
  facebookUrl?: string | null
  mapsUrl?: string | null
}

const merge = (stored: string | null | undefined, update: string | null | undefined) =>
  update === undefined ? stored || null : update || null

export function resultingLinks(existing: ClientLinks, update: ClientLinks) {
  return {
    website: merge(existing.website, update.website),
    facebookUrl: merge(existing.facebookUrl, update.facebookUrl),
    mapsUrl: merge(existing.mapsUrl, update.mapsUrl),
  }
}

export function hasAnyLink(links: ClientLinks): boolean {
  return Boolean(links.website || links.facebookUrl || links.mapsUrl)
}
