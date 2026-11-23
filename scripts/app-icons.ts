import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Resvg } from '@resvg/resvg-js'

/** The PNG for a manifest icon entry, drawn from the cooking-pot SVG for its purpose at its `sizes`. */
export function renderIcon(icon: { sizes: string; purpose?: string }): Buffer {
  const size = Number.parseInt(icon.sizes, 10)
  const source = icon.purpose === 'maskable' ? 'cooking-pot-maskable.svg' : 'cooking-pot.svg'
  const svg = readFileSync(join(import.meta.dirname, 'icons', source))
  return new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng()
}
