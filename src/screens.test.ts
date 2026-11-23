import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync('src/screens.css', 'utf8')
const rule = (selector: string) => new RegExp(`${selector}\\s*\\{[^}]*\\}`).exec(css)?.[0] ?? ''

describe('screen layout', () => {
  it('styles no bare main, article or form, which would fight household-ui\'s CentredCard', () => {
    expect(css).not.toMatch(/^(main|article|form)\s*[,{]/m)
  })

  it('lets a fieldset shrink below its content so no screen scrolls sideways at phone width', () => {
    expect(rule('fieldset')).toMatch(/min-width:\s*0/)
  })

  it('keeps the screen column inside the viewport and wraps long text', () => {
    const column = rule('\\.screen')
    expect(column).toMatch(/max-width:\s*var\(--shell-content-width\)/)
    expect(column).toMatch(/min-width:\s*0/)
    expect(column).toMatch(/overflow-wrap:\s*anywhere/)
  })
})

describe('pre-Household cards', () => {
  it('wrap long text so a 360px screen does not scroll sideways', () => {
    expect(rule('\\.ui-centred-card')).toMatch(/overflow-wrap:\s*anywhere/)
  })
})

describe('Ingredient flag colours', () => {
  it('colours Missing from the theme error tokens and Running low from its warning tokens, in light and dark through the tokens themselves', () => {
    expect(rule('\\.ingredient-flag--missing')).toMatch(/background:\s*var\(--md-sys-color-error-container\)[^}]*color:\s*var\(--md-sys-color-on-error-container\)/)
    expect(rule('\\.ingredient-flag--running-low')).toMatch(/background:\s*var\(--md-sys-color-warning-container\)[^}]*color:\s*var\(--md-sys-color-on-warning-container\)/)
  })

  it('writes no colour literal for a flag', () => {
    expect(css.slice(css.indexOf('.ingredient-flag'))).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i)
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

describe('step textareas in the editor', () => {
  it('grow with their text, without scrolling inside, only where the browser supports field-sizing', () => {
    expect(css).toMatch(/@supports\s*\(field-sizing:\s*content\)\s*\{\s*\.step-row textarea/)
    const area = rule('\\.step-row textarea')
    expect(area).toMatch(/field-sizing:\s*content/)
    expect(area).toMatch(/min-height:\s*2lh/)
    expect(area).toMatch(/overflow-y:\s*hidden/)
    expect(area).toMatch(/resize:\s*none/)
  })
})

describe('Catalogue hand-off in the editor', () => {
  it('is spaced from the field above and makes its button at least 48px tall', () => {
    expect(rule('\\.catalogue-hand-off')).toMatch(/margin-top:\s*var\(--md-sys-spacing-/)
    expect(rule('\\.catalogue-hand-off-link')).toMatch(/min-height:\s*3rem/)
  })
})

describe('floating button and snackbar placement', () => {
  it('declares no bottom bar and no side rail, so household-ui places them for an app without either', () => {
    const root = rule(':root')
    expect(root).toMatch(/--shell-bar-height:\s*0(rem)?\s*;/)
    expect(root).toMatch(/--shell-rail-width:\s*0(rem)?\s*;/)
  })

  it('loads the override after household-ui tokens so it wins', () => {
    const entrySource = readFileSync('src/main.tsx', 'utf8')
    const tokens = entrySource.indexOf('household-ui/ui/tokens.css')
    const screens = entrySource.indexOf('./screens.css')
    expect(tokens).toBeGreaterThanOrEqual(0)
    expect(screens).toBeGreaterThanOrEqual(0)
    expect(tokens).toBeLessThan(screens)
  })
})

describe('sign-in screen', () => {
  it('centres its content and makes the sign-in button at least 48px tall', () => {
    expect(rule('main\\.screen\\.sign-in')).toMatch(/align-items:\s*center/)
    expect(rule('main\\.screen\\.sign-in')).toMatch(/justify-content:\s*center/)
    expect(rule('main\\.screen\\.sign-in')).toMatch(/min-height:\s*calc\(100dvh/)
    expect(rule('main\\.screen\\.sign-in \\.ui-button')).toMatch(/min-height:\s*3rem/)
  })
})

describe('room for the floating New Recipe button', () => {
  it('is reserved only below the 45rem width where the button becomes a bar action', () => {
    expect(css).toMatch(/@media not all and \(min-width: 45rem\)\s*\{\s*\.screen\s*\{[^}]*padding-bottom:\s*6rem/)
  })
})
