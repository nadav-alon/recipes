const sizes = [192, 512]

/** One PWA icon as the generator and the tests know it: its bare file name in `public/`, unversioned. */
export type IconSpec = { file: string; sizes: string; purpose?: 'maskable' }

const spec = (size: number, purpose?: 'maskable'): IconSpec => ({
  file: `pwa-${purpose ? `${purpose}-` : ''}${size}x${size}.png`,
  sizes: `${size}x${size}`,
  ...(purpose && { purpose }),
})

/** The single list of icons: the manifest is built from it, and the generator, precache and tests read it. */
export const iconSpecs: IconSpec[] = [...sizes.map((size) => spec(size)), ...sizes.map((size) => spec(size, 'maskable'))]
