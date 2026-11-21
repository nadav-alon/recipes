import { describe, expect, it } from 'vitest'
import { DEFAULT_SCENARIO, parseScenario } from './args.ts'

describe('parseScenario', () => {
  it('defaults to owner-with-items', () => {
    expect(DEFAULT_SCENARIO).toBe('owner-with-items')
    expect(parseScenario([])).toBe('owner-with-items')
  })

  it('reads the name after --scenario', () => {
    expect(parseScenario(['--scenario', 'invited-member'])).toBe('invited-member')
  })

  it('refuses an unknown name, listing the known ones', () => {
    expect(() => parseScenario(['--scenario', 'nope'])).toThrow(/owner-with-items/)
  })

  it('refuses --scenario with no name', () => {
    expect(() => parseScenario(['--scenario'])).toThrow(/Usage/)
  })
})
