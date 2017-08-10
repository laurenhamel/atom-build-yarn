'use babel'

import temp from 'temp'
import fs from 'fs-extra'
import path from 'path'
import { vouch } from 'atom-build-spec-helpers'
import { provideBuilder } from '../lib/atom-build-yarn'

describe('Yarn provider', () => {
  let directory, builder
  const Builder = provideBuilder()

  beforeEach(() => {
    waitsForPromise(() => {
      return vouch(temp.mkdir, 'atom-build-yarn-')
        .then((dir) => vouch(fs.realpath, dir))
        .then((dir) => directory = dir)
        .then(() => fs.writeFileSync(path.join(directory, 'package.json'), fs.readFileSync(path.join(__dirname, 'package.json'))))
        .then(() => fs.writeFileSync(path.join(directory, 'yarn.lock'), fs.readFileSync(path.join(__dirname, 'yarn.lock'))))
        .then(() => builder = new Builder(directory))
    })
  })

  afterEach(() => {
    fs.removeSync(directory)
  })

  describe('when yarn.lock exists', () => {
    it('should be eligible', () => {
      expect(builder.isEligible()).toBe(true)
    })

    it('should provide default targets along with scripts', () => {
      waitsForPromise(() => {
        return Promise.resolve(builder.settings()).then(settings => {
          expect(settings.length).toBe(2)

          const defaultTarget = settings.find(s => s.name === 'Yarn: install')
          expect(defaultTarget.exec).toBe('yarn')
          expect(defaultTarget.args).toEqual([])

          const customTarget = settings.find(s => s.name === 'Yarn: custom script')
          expect(customTarget.exec).toBe('yarn')
          expect(customTarget.args).toEqual([ 'run', 'custom script' ])
        })
      })
    })
  })

  describe('when no yarn.lock exists', () => {
    it('should not be eligible', () => {
      fs.removeSync(path.join(directory, 'yarn.lock'))
      expect(builder.isEligible()).toBe(false);
    });
  });

  describe('when package.json is altered', () => {
    it('should update targets', () => {
      const pkg = JSON.parse(fs.readFileSync(`${__dirname}/package.json`));

      waitsForPromise(() => {
        return Promise.resolve(builder.settings()).then(settings => {
          expect(settings.length).toBe(2)
        })
      })

      waits(1000)

      waitsForPromise(() => new Promise(resolve => {
        builder.on('refresh', resolve)
        pkg.scripts = { 'task': 'echo all the things' }
        fs.writeFileSync(`${directory}/package.json`, JSON.stringify(pkg))
      }));

      waitsForPromise(() => {
        return Promise.resolve(builder.settings()).then(settings => {
          expect(settings.length).toBe(2)

          const target = settings.find(s => s.name === 'Yarn: task')
          expect(target.exec).toBe('yarn')
          expect(target.args).toEqual([ 'run', 'task' ])
        });
      })
    })
  })
})
