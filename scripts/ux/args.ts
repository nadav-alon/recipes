import { scenarioName, type ScenarioName } from 'data-platform/local'

/** The scenario `npm run ux` starts when `--scenario` is not given. */
export const DEFAULT_SCENARIO: ScenarioName = 'owner-with-items'

/** The scenario named by `--scenario <name>` in the script's arguments; throws listing the known ones when the name is not one. */
export function parseScenario(args: readonly string[]): ScenarioName {
  const flag = args.indexOf('--scenario')
  if (flag === -1) return DEFAULT_SCENARIO
  const name = args[flag + 1]
  if (name === undefined) throw new Error('Usage: npm run ux -- --scenario <name>')
  return scenarioName(name)
}
