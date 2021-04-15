'use babel';

import fs from 'fs';
import glob from 'glob';
import EventEmitter from 'events';

class YarnBuildProvider extends EventEmitter {
  constructor(cwd) {
    super();

    const context = this;

    this.cwd = cwd;
    this.config = {
      __config: [],
      add (conf) {
        this.__config.push({
          ...conf,
          env: {
            FORCE_COLOR: '1',
            MOCHA_COLORS: '1',
            NPM_CONFIG_COLOR: 'always'
          },
          errorMatch: [
            '\\n(?<file>.+):(?<line>\\d+)\\n  ',               // First line
            '\\((?<file>[^(]+):(?<line>\\d+):(?<col>\\d+)\\)'  // Stack trace
          ],
          sh: false
        });
      },
      get () {
        return this.__config;
      }
    };
    this.watching = {
      __watching: [],
      __watch: require('os').platform() === 'linux' ? fs.watchFile : fs.watch,
      add (files) {
         this.__watching = [...files.map(file => ({ file, watcher: null }))];
      },
      start () {
        for (const conf of this.__watching) {
          conf.watcher = this.__watch(conf.file, () => context.emit('refresh'));
        }
      },
      stop () {
        for (let i = this.__watching.length - 1; i > -1; i--) {
          this.__watching[i].watcher && this.__watching[i].watcher.close();
        }
      },
      restart () {
        this.stop();
        this.start();
      }
    };
  }

  destructor() {
    this.watching.stop();
  }

  getNiceName() {
    return 'yarn'
  }

  isEligible() {
    const locks = glob.sync(`${this.cwd}/**/yarn.lock`, {
      ignore: ['**/node_modules/**']
    });

    return locks.length
  }

  settings() {
    const files = glob.sync(`${this.cwd}/**/package.json`, {
      ignore: ['**/node_modules/**']
    });

    files.forEach(file => delete require.cache[file]);

    const pkgs = files.map(file => require(file));

    this.watching.add(files);
    this.watching.restart();

    this.config.add({
      name: 'Yarn: install',
      exec: 'yarn',
      args: ['install']
    });

    const workspaces = pkgs.find(pkg => pkg.workspaces);

    if (workspaces) this.config.add({
      name: 'Yarn: workspaces info',
      exec: 'yarn',
      args: ['workspaces', 'info']
    });

    for (const pkg of pkgs) {
      for (const script in pkg.scripts) {
        if (pkg.scripts.hasOwnProperty(script)) {
          this.config.add({
            name: `Yarn: ${workspaces ? `${pkg.name}: ` : '' }${script}`,
            exec: 'yarn',
            args: [
              ...(workspaces ? ['workspace', `${pkg.name}`] : []),
              ...(workspaces ? [] : ['run']),
              script
            ]
          });
        }
      }
    }

    return this.config.get();
  }
}

export function provideBuilder() {
  return YarnBuildProvider
}
