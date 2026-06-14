// Minifies the Able Player stylesheet with lightningcss and prepends a
// version banner. Replaces the former grunt-contrib-cssmin task.
//
// Usage: node tools/build-css.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { transform } from 'lightningcss';

const root = new URL('..', import.meta.url);
const pkg = JSON.parse(readFileSync(new URL('package.json', root)));

const src = new URL('styles/ableplayer.css', root);
const outDir = new URL('build/', root);
const out = new URL('ableplayer.min.css', outDir);

const { code } = transform({
  filename: 'styles/ableplayer.css',
  code: readFileSync(src),
  minify: true,
});

// No date in the banner: otherwise a new build differs even when the CSS didn't change.
const banner = `/*! ${pkg.name} V${pkg.version} */`;

mkdirSync(outDir, { recursive: true });
writeFileSync(out, banner + '\n' + code.toString());

console.log(`Minified styles/ableplayer.css -> build/ableplayer.min.css`);
