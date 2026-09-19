import { writeFileSync } from 'node:fs'
import { enc } from '../src/core.js'
import { bits } from '../src/protocol.js'
const marks = bits(enc('e')[1]).map((on, i) => `<circle cx="${17 + Math.floor(i / 4) * 14}" cy="${9 + (i % 4) * 10}" r="3" fill="${on ? '#a0e8d6' : '#34483e'}"/>`).join('')
writeFileSync(new URL('../public/favicon.svg', import.meta.url), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="12" fill="#101817"/>${marks}</svg>\n`)
