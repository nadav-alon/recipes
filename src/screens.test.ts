import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync('src/screens.css', 'utf8')
const rule = (selector: string) => new RegExp(`${selector}\\s*\\{[^}]*\\}`).exec(css)?.[0] ?? ''

describe('screen layout', () => {
  it('lets a fieldset shrink below its content so no screen scrolls sideways at phone width', () => {
    expect(rule('fieldset')).toMatch(/min-width:\s*0/)
  })

  it('keeps the screen column inside the viewport and wraps long text', () => {
    const column = rule('main,\\s*article,\\s*form')
    expect(column).toMatch(/max-width:\s*var\(--shell-content-width\)/)
    expect(column).toMatch(/min-width:\s*0/)
    expect(column).toMatch(/overflow-wrap:\s*anywhere/)
  })
})

describe('Ingredient quantity and unit row', () => {
  it('lays the two fields side by side, each allowed to shrink so the row cannot overflow', () => {
    expect(rule('\\.quantity-unit')).toMatch(/display:\s*flex/)
    expect(rule('\\.quantity-unit')).toMatch(/align-items:\s*flex-end/)
    expect(rule('\\.quantity-unit > \\*')).toMatch(/flex:\s*1 1 0/)
    expect(rule('\\.quantity-unit > \\*')).toMatch(/min-width:\s*0/)
  })
})

describe('sign-in screen', () => {
  it('centres its content and makes the sign-in button at least 48px tall', () => {
    expect(rule('main\\.sign-in')).toMatch(/align-items:\s*center/)
    expect(rule('main\\.sign-in')).toMatch(/justify-content:\s*center/)
    expect(rule('main\\.sign-in')).toMatch(/min-height:\s*calc\(100dvh/)
    expect(rule('main\\.sign-in \\.ui-button')).toMatch(/min-height:\s*3rem/)
  })
})
