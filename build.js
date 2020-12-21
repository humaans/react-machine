const fs = require('fs')
const path = require('path')
const execa = require('execa')

const sh = (...args) => execa(...args, { stdio: 'inherit', shell: true })

const paths = [
  'package-lock.json',
  'LICENSE.md',
  'README.md',
  'lib/index.js',
  'lib/core.js',
  'lib/hooks.js',
  'lib/service.js',
  'types',
]

;(async function () {
  await sh('rm -rf dist && mkdir -p dist')

  for (const p of paths) {
    await sh(`cp -R ${p} dist`)
  }

  const pkg = require('./package.json')
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
})()
