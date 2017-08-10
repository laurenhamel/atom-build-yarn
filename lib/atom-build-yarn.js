'use babel'

import fs from 'fs'
import path from 'path'
import EventEmitter from 'events'

class YarnBuildProvider extends EventEmitter {
  constructor(cwd) {
    super()
    this.cwd = cwd
    this.fileWatcher = null
  }

  destructor() {
    this.fileWatcher && this.fileWatcher.close()
  }

  getNiceName() {
    return 'yarn'
  }

  isEligible() {
    return fs.existsSync(path.join(this.cwd, 'yarn.lock'))
  }

  settings() {
    const file = path.join(this.cwd, 'package.json')
    const realPackage = fs.realpathSync(file)
    delete require.cache[realPackage]
    const pkg = require(realPackage)

    this.fileWatcher && this.fileWatcher.close()
    this.fileWatcher = (require('os').platform() === 'linux' ? fs.watchFile : fs.watch)(file, () => {
      this.emit('refresh')
    })

    // https://github.com/mochajs/mocha/issues/1844
    const env = { FORCE_COLOR: '1', MOCHA_COLORS: '1', NPM_CONFIG_COLOR: 'always' }
    const errorMatch = [
      '\\n(?<file>.+):(?<line>\\d+)\\n  ',               // First line
      '\\((?<file>[^(]+):(?<line>\\d+):(?<col>\\d+)\\)'  // Stack trace
    ]

    const config = [{
      name: 'Yarn: install',
      exec: 'yarn',
      args: [],
      env,
      errorMatch,
      sh: false
    }]

    for (const script in pkg.scripts) {
      if (pkg.scripts.hasOwnProperty(script)) {
        config.push({
          name: 'Yarn: ' + script,
          exec: 'yarn',
          args: [ 'run', script ],
          env,
          errorMatch,
          sh: false
        })
      }
    }

    return config
  }
}

export function provideBuilder() {
  return YarnBuildProvider
}
