const fs = require('fs')
const path = require('path')
const execa = require('execa')

const sh = (...args) => execa(...args, { stdio: 'inherit', shell: true })

const paths = [
  'package-lock.json',
  'LICENSE.md',
  'README.md',
  'lib/index.js',
  'lib/index.d.ts',
  'lib/core.js',
  'lib/core.d.ts',
  'lib/react.js',
  'lib/react.d.ts',
]

;(async function () {
  await sh('rm -rf dist && mkdir -p dist')

  for (const p of paths) {
    await sh(`cp ${p} dist`)
  }

  const pkg = require('../package.json')
  fs.writeFileSync(
    path.join('dist', 'package.json'),
    JSON.stringify(
      {
        ...pkg,
        type: 'module',
        exports: {
          '.': './index.js',
          './core': './core.js',
          './react': './react.js',
        },
      },
      null,
      2
    )
  )
