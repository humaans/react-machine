const fs = require('fs')
const path = require('path')

const paths = [
  'lib/core.js',
  'lib/hooks.js',
  'lib/index.js',
  'lib/service.js',
  'types',
  'package-lock.json',
  'CHANGELOG.md',
  'LICENSE.md',
  'README.md',
]

;(async function () {
  const { execa } = await import('execa')
  const sh = (...args) => execa(...args, { stdio: 'inherit', shell: true })

  await sh('rm -rf dist && mkdir -p dist')

  for (const p of paths) {
    await sh(`cp -R ${p} dist`)
  }

  const pkg = require('./package.json')
  fs.writeFileSync(
    path.join('dist', 'package.json'),
    JSON.stringify(
      {
        name: pkg.name,
        version: pkg.version,
        description: pkg.description,
        type: 'module',
        exports: {
          '.': './index.js',
          './core': './core.js',
          './service': './service.js',
          './hooks': './hooks.js',
        },
        ...pkg,
      },
      null,
      2
    )
  )
})()
