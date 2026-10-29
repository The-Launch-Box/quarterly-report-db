export const PORTCOS = ["echelon", "improv", "hyperscayle", "vescape", "bluetrail", "dxfoundation"] as const

export type PortcoId = (typeof PORTCOS)[number]

export function portcoId(id: string): PortcoId | null {
  return (PORTCOS as readonly string[]).includes(id) ? (id as PortcoId) : null
}

/** Signature mark, readable on the dark TLB shell and on multi-company charts. */
export const BRAND_MARK: Record<PortcoId, string> = {
  echelon: "var(--color-echelon-yellow)",
  improv: "var(--color-improv-aqua)",
  hyperscayle: "var(--color-hyper-pink)",
  vescape: "var(--color-vescape-magenta)",
  bluetrail: "var(--color-blaze-blue)",
  dxfoundation: "var(--color-dxf-nebula)",
}

/** Series order for a single company's graph. */
export const BRAND_SERIES: Record<PortcoId, readonly string[]> = {
  echelon: [
    "var(--color-echelon-yellow)",
    "var(--color-echelon-red)",
    "var(--color-echelon-blue-light)",
    "var(--color-echelon-off-white)",
  ],
  improv: [
    "var(--color-improv-aqua)",
    "var(--color-improv-raspberry)",
    "var(--color-improv-sienna)",
    "var(--color-improv-strategic-blue)",
  ],
  hyperscayle: [
    "var(--color-hyper-pink)",
    "var(--color-hyper-blue)",
    "var(--color-hyper-green)",
    "var(--color-hyper-red)",
  ],
  vescape: [
    "var(--color-vescape-magenta)",
    "var(--color-vescape-yellow)",
    "var(--color-vescape-purple)",
    "var(--color-vescape-gray)",
  ],
  bluetrail: [
    "var(--color-trail-blue)",
    "var(--color-blaze-magenta)",
    "var(--color-blaze-blue)",
    "var(--color-trail-black)",
  ],
  dxfoundation: [
    "var(--color-dxf-nebula)",
    "var(--color-dxf-violet)",
    "var(--color-dxf-aero)",
    "var(--color-dxf-discovery)",
  ],
}
