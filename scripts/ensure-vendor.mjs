import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const vendorPath = join(repoRoot, 'vendor', 'MeowKit-React-Library')

if (!existsSync(vendorPath)) {
  console.error(
    [
      '',
      'MeowKit UI vendor library not found at vendor/MeowKit-React-Library.',
      '',
      'Clone it before installing:',
      '  git clone https://github.com/pve-homelab/MeowKit-React-Library.git vendor/MeowKit-React-Library',
      '',
      'Then run:',
      '  npx pnpm@9.15.0 install',
      '  npx pnpm@9.15.0 --filter @meowkit/components... build',
      '',
    ].join('\n'),
  )
  process.exit(1)
}
