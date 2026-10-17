import { atom, read } from 'claude-code'
import type { PluginState, Register, RenderElement, RenderNode } from 'claude-code'

type Savvy = PluginState['savvy-progress']

// savvy-progress's own state, read only: this mod never writes it.
const flow = atom({ plugin: 'savvy-progress', key: 'flow' } as const, null)
const agents = atom({ plugin: 'savvy-progress', key: 'agents' } as const, [] as Savvy['agents'])

const P = '#7F77DD'
const D = '#534AB7'
const W = '#f5f5f5'
const ACCENT = '#AFA9EC'
const MUTED = '#888780'
const EMPTY = '#444441'
const CELLS = 20
const PHASES = ['plan', 'design', 'delegate', 'review', 'close'] as const

// Clawd as a wizard: each line is [text, color] runs.
const MASCOT: [string, string][][] = [
  [['      ', W], ['✦', W]],
  [['     ', W], ['▟', D], ['█', P], ['▙', D], ['      ', W], ['✧', W]],
  [['    ', W], ['▟██', P], ['★', W], ['█▙', P], ['   ', W], ['╱', W]],
  [['  ', W], ['▀▀▀▀▀▀▀▀▀▀', D], [' ', W], ['╱', W]],
  [['   ', W], ['▐█', P], ['■ ■', W], ['█▌', P], ['━┛', W]],
  [['   ', W], ['▐█████▌', P]],
  [['  ', W], ['▟██', D], ['✦', W], ['███▙', D]],
  [['   ', W], ['▘▘  ▝▝', P]],
]

// --- the agents pane: savvy-progress draws each crab as an SVG group
// `<g class="c-<costume>[ run]">…</g>` inside a positioned `<g transform>`;
// we swap that inner group for the wizard and keep the placement around it.

const INK = '#1F1E1D'
const rect = (x: number, y: number, w: number, h: number, c: string) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`

// Pointed hat, its brim (last row) on y=9, right on the body's top at y=10.
const HAT = [
  '..........kk......',
  '.........kkk......',
  '........kkkk......',
  '.......kkwkk......',
  '......kkkkkkk.....',
  '.....kkkkkkkkk....',
  '....kkkkkkkkkkk...',
  '...ppppppppppppp..',
  'kkkkkkkkkkkkkkkkkk',
]
const HAT_X = 6
const HAT_Y = 1
const hatPixels = (want: (ch: string) => boolean) =>
  HAT.flatMap((row, dy) =>
    [...row].map((ch, dx) => (ch !== '.' && want(ch) ? rect(HAT_X + dx, HAT_Y + dy, 1, 1, ch === 'k' ? INK : ch === 'p' ? P : W) : '')),
  ).join('')

const WIZ_BODY = [
  rect(7, 10, 16, 12, P),
  rect(3, 14, 4, 4, P),
  rect(23, 10, 4, 4, P),
  rect(9, 12, 2, 2, INK),
  rect(19, 12, 2, 2, INK),
  rect(7, 21, 16, 1, W),
  hatPixels(ch => ch !== 'w'),
  `<g class="star">${hatPixels(ch => ch === 'w')}</g>`,
  `<g class="wand">${rect(27, 5, 1, 3, W)}${rect(26, 8, 1, 3, W)}</g>`,
  `<g class="spark">${rect(28, 2, 1, 3, ACCENT)}${rect(27, 3, 3, 1, ACCENT)}</g>`,
].join('')
const WIZ_LEGS = `<g class="la">${rect(7, 22, 2, 4, P)}${rect(17, 22, 2, 4, P)}</g><g class="lb">${rect(11, 22, 2, 4, P)}${rect(21, 22, 2, 4, P)}</g>`
const wizard = (isRunning: boolean) => `<g class="c-wizard${isRunning ? ' run' : ''}"><g class="bd">${WIZ_BODY}</g>${WIZ_LEGS}</g>`

// Floats instead of walking; the wand sways about its lower end, spark and star blink.
const WIZ_CSS = `<style>
.c-wizard.run{animation:wfloat 1s ease-in-out infinite}
.c-wizard.run .la,.c-wizard.run .lb,.c-wizard.run .bd{animation:none}
.c-wizard.run .wand{transform-box:fill-box;transform-origin:25% 100%;animation:wsway .8s ease-in-out infinite}
.c-wizard.run .spark{animation:wblink .5s steps(1) infinite}
.c-wizard.run .star{animation:wblink 1s steps(1) infinite}
@keyframes wfloat{50%{transform:translateY(-2px)}}@keyframes wsway{25%{transform:rotate(-15deg)}75%{transform:rotate(15deg)}}@keyframes wblink{50%{opacity:.15}}
@media (prefers-reduced-motion: reduce){.c-wizard,.c-wizard g{animation:none!important}}
</style>`

const CRAB_OPEN = /<g class="c-[\w-]+( run)?">/g
const G_TAG = /<g[\s>]|<\/g>/g

// Index just past the `</g>` that closes a group whose body starts at `from`; -1 if unclosed.
const closeOf = (svg: string, from: number): number => {
  let depth = 1
  G_TAG.lastIndex = from
  for (let m = G_TAG.exec(svg); m; m = G_TAG.exec(svg)) {
    depth += m[0] === '</g>' ? -1 : 1
    if (depth === 0) return G_TAG.lastIndex
  }
  return -1
}

const swapCrabs = (svg: string): string => {
  let out = ''
  let at = 0
  CRAB_OPEN.lastIndex = 0
  for (let m = CRAB_OPEN.exec(svg); m; m = CRAB_OPEN.exec(svg)) {
    const end = closeOf(svg, CRAB_OPEN.lastIndex)
    if (end < 0) break
    out += svg.slice(at, m.index) + wizard(m[1] !== undefined)
    at = end
    CRAB_OPEN.lastIndex = end
  }
  if (at === 0) return svg
  return (out + svg.slice(at)).replace(/<\/svg>\s*$/, `${WIZ_CSS}</svg>`)
}

// Rewrites every Svg leaf of a tree; everything else (Buttons and their press stamps included) is kept as is.
const wizardize = (n: RenderElement): RenderElement => {
  if (n.type === 'Svg') {
    const source = swapCrabs(n.props.source)
    return source === n.props.source ? n : { ...n, props: { ...n.props, source } }
  }
  if ('children' in n && Array.isArray(n.children)) {
    const children: RenderNode[] = n.children.map(c => (typeof c === 'string' ? c : wizardize(c)))
    return { ...n, children } as RenderElement
  }
  return n
}

export const register: Register = on => {

  on('ui.render', { component: 'Pane', requestId: 'savvy-agents' }, async ($, e, next) => wizardize(await next(e)))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const f = await read($, flow)
    if (f === null || f.isFinished || e.props.hasSurvey) return next(e)
    // The bands beneath (savvy-progress, skins' usage) stay, under ours. Claude Code's
    // own placeholder ({ type: 'engine' }) is never nested: the desktop drops a band that nests it.
    const drawn = await Promise.resolve(next(e)).catch(() => null)
    const below = drawn && drawn.type !== 'engine' ? wizardize(drawn) : null

    const { Box, Text } = $.ui.resolve(e)
    const running = (await read($, agents)).find(a => a.status === 'running')
    const filled = f.total > 0 ? Math.min(CELLS, Math.max(0, Math.round((f.done / f.total) * CELLS))) : 0

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" gap={2}>
          <Box flexDirection="column" flexShrink={0}>
            {MASCOT.map((line, i) => (
              <Text key={`m${i}`}>
                {line.map(([text, color], j) => (
                  <Text key={`m${i}-${j}`} color={color}>
                    {text}
                  </Text>
                ))}
              </Text>
            ))}
          </Box>
          <Box flexDirection="column">
            <Text color={ACCENT} wrap="truncate-end">
              savvy-flow · {f.title}
            </Text>
            <Text>
              <Text color={P}>{'█'.repeat(filled)}</Text>
              <Text color={EMPTY}>{'░'.repeat(CELLS - filled)}</Text>
              <Text color={W}>
                {'  '}
                {f.done}/{f.total} feitiços
              </Text>
            </Text>
            <Text>
              <Text color={W}>Etapa: </Text>
              {PHASES.map((p, i) => (
                <Text key={p} color={MUTED}>
                  {i > 0 ? ' › ' : ''}
                  <Text color={p === f.phase ? ACCENT : MUTED}>{p}</Text>
                </Text>
              ))}
            </Text>
            {running ? (
              <Text wrap="truncate-end">
                <Text color={W}>Agora: {running.description}</Text>
                <Text color={MUTED}> ({running.type.replace(/^savvy-flow:savvy-/, '')})</Text>
              </Text>
            ) : (
              <Text color={MUTED}>Agora: aguardando…</Text>
            )}
          </Box>
        </Box>
        {below}
      </Box>
    )
  })
}
