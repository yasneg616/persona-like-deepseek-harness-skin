import * as esbuild from 'esbuild'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const cssResult = await esbuild.build({
  entryPoints: ['src/client/skin.css', 'src/client/persona.css', 'src/client/p3r.css', 'src/client/p4g.css'],
  bundle: true,
  write: false,
  outdir: 'lib',
  loader: {
    '.ttf': 'dataurl',
    '.woff2': 'dataurl',
    '.svg': 'dataurl',
  },
  legalComments: 'none',
})

const styles = new Map(cssResult.outputFiles.map(file => [file.path.split(/[\\/]/).at(-1), file.text]))
const css = styles.get('skin.css')
await mkdir('lib', { recursive: true })
await writeFile('lib/skin.css', css)

const client = await esbuild.build({
  entryPoints: ['src/client/index.ts'],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  write: false,
  jsx: 'automatic',
  external: ['react', 'react/jsx-runtime'],
  plugins: [{
    name: 'skin-css-text',
    setup(build) {
      build.onResolve({ filter: /^(skin|persona|p3r|p4g)\.css$/ }, ({ path }) => ({ path, namespace: 'skin-text' }))
      build.onLoad({ filter: /.*/, namespace: 'skin-text' }, ({ path }) => ({
        contents: `export default ${JSON.stringify(styles.get(path))}`,
        loader: 'js',
      }))
    },
  }],
})

const source = client.outputFiles[0].text
const wrapped = `window.__ModuleLoader__.load({
  id: "dsh-calling-card-skin",
  factory: function (require) {
    var module = { exports: {} };
    var exports = module.exports;
    ${source}
    return module.exports;
  }
});
`
await writeFile('lib/client.js', wrapped)

await esbuild.build({
  entryPoints: ['src/client/fixture-boot.ts'],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  outfile: 'lib/fixture-boot.js',
})

await esbuild.build({
  entryPoints: ['src/host/index.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: 'lib/index.js',
})

const hostTypes = `export const name: string
export function apply(): void
`
const clientTypes = `export const name: string
export const inject: readonly string[]
export function apply(ctx: unknown): void
`
await writeFile('lib/index.d.ts', hostTypes)
await mkdir(dirname('lib/client.d.ts'), { recursive: true })
await writeFile('lib/client.d.ts', clientTypes)

const built = await readFile('lib/client.js', 'utf8')
if (!built.includes('window.__ModuleLoader__.load')) throw new Error('client factory wrapper missing')
if (!built.includes('dsh-calling-card-skin/skin.css')) throw new Error('style id missing from client bundle')
if (!built.includes('overrideTokens')) throw new Error('theme override missing from client bundle')
console.log(`built lib/client.js (${built.length} bytes) and lib/index.js`)
