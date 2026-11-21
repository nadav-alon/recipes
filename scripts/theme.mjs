// Regenerates src/theme.css from the seed in src/seed.ts, the one place the accent is written.
import { execFileSync } from 'node:child_process'
import { SEED } from '../src/seed.ts'

execFileSync('household-theme', [SEED, 'src/theme.css'], { stdio: 'inherit' })
