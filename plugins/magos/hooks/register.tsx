import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { Git, Mana, Run } from '../types'

const frame = atom({ plugin: 'magos', key: 'frame' } as const, 0)
const tick = atom({ plugin: 'magos', key: 'tick' } as const, 0)
const runs = atom({ plugin: 'magos', key: 'runs' } as const, [] as Run[])
const turns = atom({ plugin: 'magos', key: 'turns' } as const, [] as number[])
const mana = atom({ plugin: 'magos', key: 'mana' } as const, { five: null, week: null, ctx: null, usd: null } as Mana)
const cwd = atom({ plugin: 'magos', key: 'cwd' } as const, '')
const PANE = 'magos-torre'

const git = atom({ plugin: 'magos', key: 'git' } as const, null as Git | null)
const touched = atom({ plugin: 'magos', key: 'touched' } as const, [] as string[])

// Feitiços rápidos: cada botão manda um pedido ao Claude, que age com as permissões de sempre
const ACOES = {
  testes: 'Rode os testes deste projeto e me resuma o resultado: quantos passaram, quais falharam e por quê.',
  deploy: 'Faça o deploy deste projeto. Antes de publicar qualquer coisa, me mostre o que vai ser feito e espere minha confirmação.',
  revisar: 'Revise as mudanças ainda não commitadas deste projeto e aponte bugs ou problemas.',
}

const RUNAS = ['ᚠ', 'ᚢ', 'ᚦ', 'ᚨ', 'ᚱ', 'ᚲ', 'ᚷ', 'ᚹ']
const PONTA = ['✦', '✧', '★', '✶', '✷', '✸']

// Um mago diferente para cada subagente
// Magos não humanos: cada um uma criatura, com rosto, cores e detalhes próprios.
// Linhas do sprite que mudam por criatura: 4 (orelhas), 6–9 (rosto), 15 (barra ou tentáculos).
// Letras: A pele, a pele clara, E pupila, e olho/anel, N nariz/bico/chifre, M boca/presa
const MAGOS = [
  { icon: '🐉', name: 'Dragão do Fogo', color: '#ff6b35', robe: '#c2361b', trim: '#7a1f0e', orb: '#ffb000',
    skin: { A: '#f0a830', a: '#fff0b0', E: '#1f1e1d', N: '#f5e6c8', M: '#ffffff' },
    rows: { 6: '...NAAAAAN....T.', 7: '....AEAEA.....T.', 8: '....AAaAA.....T.', 9: '...AAMAMAA...KT.' } },
  { icon: '🐧', name: 'Pinguim do Gelo', color: '#7fdbff', robe: '#3c8fc4', trim: '#1f4f73', orb: '#d6f6ff',
    skin: { A: '#1f2a3a', a: '#ffffff', E: '#1f1e1d', N: '#ffb000' },
    rows: { 6: '....AAAAA.....T.', 7: '....aEaEa.....T.', 8: '....aaNaa.....T.', 9: '....AaaaA....KT.' } },
  { icon: '🐈‍⬛', name: 'Gato do Trovão', color: '#f5ff3b', robe: '#4b3f9e', trim: '#2a2360', orb: '#f5ff3b',
    skin: { A: '#2b2b2b', a: '#cfcfcf', E: '#f5ff3b', N: '#ff8fb1' },
    rows: { 4: '..A.HHHHH.A...T.', 6: '...AAAAAAA....T.', 7: '...AEAAAEA....T.', 8: '...AAANAAA....T.', 9: '..aAAAAAAAa..KT.' } },
  { icon: '🐸', name: 'Sapo Druida', color: '#39ff88', robe: '#2f7a3a', trim: '#1c4723', orb: '#7dff9e',
    skin: { A: '#4caf50', a: '#a5d66b', E: '#1f1e1d', e: '#ffffff', M: '#2e7d32' },
    rows: { 6: '...AeeAeeA....T.', 7: '...AeEAeEA....T.', 8: '...AaaaaaA....T.', 9: '...AMMMMMA...KT.' } },
  { icon: '👻', name: 'Fantasma Necromante', color: '#b388ff', robe: '#4f3d70', trim: '#2b2238', orb: '#9b5cff',
    skin: { A: '#f0f0ff', E: '#1f1e1d', M: '#1f1e1d' },
    rows: { 6: '....AAAAA.....T.', 7: '....AEAEA.....T.', 8: '....AAAAA.....T.', 9: '....AAMAA....KT.', 15: '.D.DD.DD.DD...T.' } },
  { icon: '🐙', name: 'Polvo das Águas', color: '#2b9bff', robe: '#1a5fa8', trim: '#0d335c', orb: '#4fe3ff',
    skin: { A: '#ff7a8a', a: '#ffb3bd', E: '#1f1e1d', M: '#c2455a' },
    rows: { 6: '...AAAAAAA....T.', 7: '...AaEAEaA....T.', 8: '...AAAAAAA....T.', 9: '....AAMAA....KT.', 15: '.A.A.A.A.A.A..T.' } },
  { icon: '🦉', name: 'Coruja Vidente', color: '#ff2bd6', robe: '#8a1f7a', trim: '#4d0f44', orb: '#ff7ae6',
    skin: { A: '#8d6e63', a: '#d7ccc8', E: '#1f1e1d', e: '#ffd166', N: '#ffb000' },
    rows: { 4: '..A.HHHHH.A...T.', 6: '...AAAAAAA....T.', 7: '...AeEAeEA....T.', 8: '...aAANAAa....T.', 9: '....aaaaa....KT.' } },
  { icon: '🦊', name: 'Raposa Arcanista', color: '#ffd166', robe: '#e8e0c8', trim: '#a08a50', orb: '#ffd166',
    skin: { A: '#ff8a2b', a: '#ffffff', E: '#1f1e1d', N: '#1f1e1d' },
    rows: { 4: '..A.HHHHH.A...T.', 6: '...AAAAAAA....T.', 7: '...AEAAAEA....T.', 8: '....aaaaa.....T.', 9: '.....aNa.....KT.' } },
] as const

// Base do sprite 16×16: chapéu, manto e cajado; o rosto vem de cada criatura
const SPRITE = [
  '..............O.',
  '......H......OOO',
  '.....HH.......O.',
  '.....HSH......T.',
  '....HHHHH.....T.',
  '..BBBBBBBBB...T.',
  '..............T.',
  '..............T.',
  '..............T.',
  '.............KT.',
  '...RRRRRRRRRRKT.',
  '..RRRRRRRR....T.',
  '..RRRRRRRR....T.',
  '..RRRRRRRR....T.',
  '.RRRRRRRRRR...T.',
  '.DDDDDDDDDD...T.',
]

const shade = (hex: string, k: number) =>
  '#' + [1, 3, 5].map(i => Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * k))).toString(16).padStart(2, '0')).join('')

const wizardSvg = (m: (typeof MAGOS)[number], x: number, y: number, px: number, live: boolean, k: number) => {
  const fill: Record<string, string> = {
    H: m.robe, S: '#ffd166', B: shade(m.robe, 0.7), R: m.robe, D: m.trim, T: '#8b5a2b', O: m.orb,
    K: m.skin.A, ...m.skin,
  }
  const rows: Record<number, string> = m.rows
  // Cada parte numa camada própria para animar separado: corpo, chapéu, olhos, cajado
  const layer: Record<string, string> = { H: 'hat', S: 'hat', B: 'hat', E: 'eye', T: 'staff', O: 'staff', K: 'staff' }
  const parts: Record<string, string> = { body: '', hat: '', eye: '', staff: '' }
  SPRITE.map((row, j) => rows[j] ?? row).forEach((row, j) => [...row].forEach((c, i) => {
    if (c === '.') return
    parts[layer[c] ?? 'body'] += `<rect${c === 'O' ? ' class="orb"' : ''} x="${x + i * px}" y="${y + j * px}" width="${px}" height="${px}" fill="${fill[c]}"/>`
  }))
  const ox = x + 14.5 * px, oy = y + 1.5 * px
  // Faíscas em volta do orbe, cada uma com seu atraso
  const sparks = [[-9, -4], [7, -6], [-6, 8], [9, 6], [0, -11]].map(([dx, dy], i) => {
    const cx = ox + dx!, cy = oy + dy!, r = live ? 2.2 : 1.4
    return `<path class="spark" style="animation-delay:${(i * 0.37 + k * 0.21).toFixed(2)}s" d="M${cx} ${cy - r * 2}L${cx + r * 0.5} ${cy - r * 0.5}L${cx + r * 2} ${cy}L${cx + r * 0.5} ${cy + r * 0.5}L${cx} ${cy + r * 2}L${cx - r * 0.5} ${cy + r * 0.5}L${cx - r * 2} ${cy}L${cx - r * 0.5} ${cy - r * 0.5}Z" fill="${m.orb}"/>`
  }).join('')
  const d = `style="animation-delay:-${(k * 0.43).toFixed(2)}s"`
  return `<g class="${live ? 'cast' : 'idle'}" ${d}>
<circle class="halo" cx="${ox}" cy="${oy}" r="${px * (live ? 3.4 : 2.2)}" fill="${m.orb}"/>
<g class="body">${parts.body}<g class="eyes" ${d}>${parts.eye}</g></g>
<g class="hat" ${d}>${parts.hat}</g>
<g class="staff" ${d}>${parts.staff}</g>
${sparks}</g>`
}

const CSS = `<style>
.t{fill:#1f1f1f}.s{fill:#6b6b68}.ln{stroke:#e4e4e1}.card{fill:#f6f3fb;stroke:#ddd3ee}.k{fill:#e9e4f2}
@media (prefers-color-scheme: dark){.t{fill:#ececec}.s{fill:#a8a8a4}.ln{stroke:#333331}.card{fill:#1c1626;stroke:#3a2f4d}.k{fill:#2c2440}}
g,rect,path,circle{transform-box:fill-box;transform-origin:50% 100%}
.idle{animation:bob 2.4s ease-in-out infinite}
.cast{animation:bob 1s ease-in-out infinite}
@keyframes bob{50%{transform:translateY(-2px)}}
.eyes{transform-origin:50% 50%;animation:blink 4s steps(1) infinite}
@keyframes blink{0%,92%,100%{transform:scaleY(1)}94%,97%{transform:scaleY(.1)}}
.hat{animation:tilt 3.2s ease-in-out infinite}
.cast .hat{animation-duration:1.2s}
@keyframes tilt{25%{transform:rotate(-4deg)}75%{transform:rotate(4deg)}}
.staff{transform-origin:50% 100%;animation:wave 2.8s ease-in-out infinite}
.cast .staff{animation:cast .7s ease-in-out infinite}
@keyframes wave{50%{transform:rotate(3deg)}}
@keyframes cast{0%,100%{transform:rotate(-6deg) translateY(0)}50%{transform:rotate(8deg) translateY(-3px)}}
.orb{animation:glow 1.6s ease-in-out infinite}
.cast .orb{animation-duration:.5s}
@keyframes glow{50%{opacity:.45}}
.halo{transform-origin:50% 50%;opacity:.25;animation:halo 2s ease-in-out infinite}
.cast .halo{animation-duration:.6s}
@keyframes halo{50%{transform:scale(1.5);opacity:.05}}
.spark{transform-origin:50% 50%;opacity:0;animation:tw 2.2s ease-in-out infinite}
.cast .spark{animation-duration:.9s}
@keyframes tw{0%,100%{opacity:0;transform:scale(.3) rotate(0)}50%{opacity:1;transform:scale(1) rotate(90deg)}}
@media (prefers-reduced-motion: reduce){*{animation:none!important}.spark{opacity:.6}}
</style>`

const xml = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const fit = (t: string, max: number) => (t.length > max ? t.slice(0, max - 1) + '…' : t)

// Ferramentas como feitiços: ícone, nome, cor e o campo da entrada que resume a chamada
const FEITICOS: Record<string, { icon: string; name: string; color: string; field: string }> = {
  Bash: { icon: '⚗️', name: 'Alquimia', color: '#ff2bd6', field: 'command' },
  Read: { icon: '📜', name: 'Grimório', color: '#00e5ff', field: 'file_path' },
  Edit: { icon: '🪶', name: 'Pena encantada', color: '#f5ff3b', field: 'file_path' },
  Write: { icon: '🪶', name: 'Pena encantada', color: '#f5ff3b', field: 'file_path' },
  Grep: { icon: '🔍', name: 'Olho que tudo vê', color: '#39ff88', field: 'pattern' },
  Glob: { icon: '🔍', name: 'Olho que tudo vê', color: '#39ff88', field: 'pattern' },
  WebFetch: { icon: '🦉', name: 'Coruja mensageira', color: '#ff8a2b', field: 'url' },
  WebSearch: { icon: '🦉', name: 'Coruja mensageira', color: '#ff8a2b', field: 'query' },
}

const fmt = (ms: number) => (ms < 60000 ? `${Math.round(ms / 1000)}s` : `${Math.floor(ms / 60000)}m${Math.round((ms % 60000) / 1000)}s`)

const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000))
  return m < 1 ? 'agora' : m < 60 ? `há ${m} min` : m < 1440 ? `há ${Math.round(m / 60)} h` : `há ${Math.round(m / 1440)} d`
}

// Lê o estado do git na pasta da sessão; null fora de um repositório
const readGit = async ($: EngineInterface): Promise<Git | null> => {
  const st = await $.process.run(['git', 'status', '--porcelain=v2', '--branch'], { timeoutMs: 5000 }).catch(() => null)
  if (!st || st.exitCode !== 0) return null
  const lines = st.stdout.split('\n')
  const head = lines.find(l => l.startsWith('# branch.head '))?.slice(14) ?? '?'
  const ab = lines.find(l => l.startsWith('# branch.ab '))?.match(/\+(\d+) -(\d+)/)
  const changed = lines.filter(l => /^[12u] /.test(l)).length
  const untracked = lines.filter(l => l.startsWith('? ')).length
  const [stat, log] = await Promise.all([
    $.process.run(['git', 'diff', '--shortstat', 'HEAD'], { timeoutMs: 5000 }).catch(() => null),
    $.process.run(['git', 'log', '-1', '--format=%s%x1f%cI'], { timeoutMs: 5000 }).catch(() => null),
  ])
  const n = (re: RegExp) => Number(stat?.stdout.match(re)?.[1] ?? 0)
  const [subject = '', date = ''] = (log?.exitCode === 0 ? log.stdout.trim() : '').split('\x1f')
  return {
    branch: head === '(detached)' ? 'HEAD solto' : head,
    ahead: Number(ab?.[1] ?? 0), behind: Number(ab?.[2] ?? 0),
    changed, untracked, plus: n(/(\d+) insertion/), minus: n(/(\d+) deletion/),
    subject, date,
  }
}

export const register: Register = on => {
  let timer: Timer | undefined
  let turnStart = 0

  on('prompt.submit', async ($, e, next) => {
    turnStart = await $.clock.now()
    timer?.cancel()
    timer = $.clock.every(200, () => update($, frame, n => {
      if ((n + 1) % 5 === 0) void update($, tick, t => t + 1)
      return n + 1
    }))
    return next(e)
  })

  let toolsThisTurn = 0
  on('tool.call', async ($, e, next) => {
    toolsThisTurn += 1
    const result = await next(e)
    if (e.tool === 'Edit' || e.tool === 'Write' || e.tool === 'NotebookEdit') {
      const f = String((e as { file_path?: string; notebook_path?: string }).file_path ?? (e as { notebook_path?: string }).notebook_path ?? '')
      if (f) await update($, touched, t => [f, ...t.filter(x => x !== f)].slice(0, 20))
    }
    if (e.tool === 'Edit' || e.tool === 'Write' || e.tool === 'Bash') {
      const g = await readGit($)
      await update($, git, () => g)
    }
    return result
  })

  const readMana = (rl: readonly { kind: string; percentUsed: number }[], ctx: number | null | undefined, usd: number | undefined): Mana => ({
    five: rl.find(r => r.kind === 'five_hour')?.percentUsed ?? null,
    week: rl.find(r => r.kind === 'seven_day')?.percentUsed ?? null,
    ctx: ctx ?? null,
    usd: usd ?? null,
  })

  on('session.measure', async ($, e, next) => {
    await update($, mana, () => readMana(e.rateLimits, e.context.percent, e.cost?.usd))
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const n = toolsThisTurn
    toolsThisTurn = 0
    await update($, turns, t => [...t, n].slice(-10))
    const g = await readGit($)
    await update($, git, () => g)
    timer?.cancel()
    timer = undefined
    const ms = (await $.clock.now()) - turnStart
    if (turnStart && ms > 30000) $.ui.toast(`🧙 Feitiço concluído em ${fmt(ms)}`)
    return next(e)
  })

  // Registra cada subagente: qual mago, quando começou e como terminou
  on('tool.call', { tool: 'Agent' }, async ($, e, next) => {
    const start = await $.clock.now()
    await update($, runs, rs => rs.some(r => r.id === e.tool_use_id) ? rs : [...rs, {
      id: e.tool_use_id, mage: rs.length % MAGOS.length, description: e.description ?? '',
      type: e.subagent_type ?? 'aprendiz', model: e.model ?? 'herdado', start, status: 'running' as const,
    }])
    if (!(await $.ui.panes()).some(p => p.id === PANE)) void $.ui.open({ id: PANE, title: 'Torre dos Magos' })
    try {
      const result = await next(e)
      const end = await $.clock.now()
      await update($, runs, rs => rs.map(r => r.id === e.tool_use_id ? { ...r, end, status: 'done' as const } : r))
      return result
    } catch (err) {
      const end = await $.clock.now()
      await update($, runs, rs => rs.map(r => r.id === e.tool_use_id ? { ...r, end, status: 'failed' as const } : r))
      throw err
    }
  })

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await update($, cwd, () => e.cwd)
    const g = await readGit($)
    await update($, git, () => g)
    const u = await $.session.usage()
    await update($, mana, () => readMana(u.rateLimits, u.context.percent, u.cost?.usd))
    $.command.register({ name: 'torre', description: 'Abre ou fecha a Torre dos Magos (painel dos subagentes)' })
    // A torre abre em toda sessão; /torre fecha
    if (!(await $.ui.panes()).some(p => p.id === PANE)) void $.ui.open({ id: PANE, title: 'Torre dos Magos' })
    return started
  })

  on('command.run', { command: 'torre' }, async ($, e) => {
    if ((await $.ui.panes()).some(p => p.id === PANE)) {
      await $.ui.close({ id: PANE })
      return { text: 'A torre se fechou' }
    }
    await $.ui.open({ id: PANE, title: 'Torre dos Magos' })
    return { text: '🧙 A Torre dos Magos se abriu' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const list = [...(await read($, runs))].reverse()
    await read($, tick)
    const now = await $.clock.now()
    const hist = await read($, turns)
    const mn = await read($, mana)
    const dir = await read($, cwd)
    const ui = $.ui.resolve(e)
    const { Box, Text, Button } = ui
    const running = list.filter(r => r.status === 'running')
    const label = (r: Run) => r.status === 'running' ? 'conjurando…' : r.status === 'failed' ? 'feitiço falhou' : 'feitiço concluído'
    const mark = (r: Run) => r.status === 'running' ? '✦' : r.status === 'failed' ? '✗' : '✓'
    const markColor = (r: Run, c: string) => r.status === 'running' ? c : r.status === 'failed' ? '#ff3860' : '#39ff88'
    const time = (r: Run) => fmt((r.end ?? now) - r.start)
    const home = dir.replace(/^\/Users\/[^/]+/, '~')
    const pct = mn.five ?? mn.ctx
    const pctLabel = mn.five !== null ? 'Limite de 5 horas' : 'Contexto usado'

    const cast = (text: string) => () => { void $.prompt.submit({ text, asUser: true }) }
    const clear = () => update($, runs, rs => rs.filter(r => r.status === 'running'))
    const buttons = (
      <Box flexDirection="column" gap={1}>
        <Button key="testes" variant="primary" label="▶ Rodar testes" onPress={cast(ACOES.testes)} />
        <Button key="deploy" variant="secondary" label="⇧ Deploy" onPress={cast(ACOES.deploy)} />
        <Box flexDirection="row" gap={1}>
          <Button key="revisar" label="🔍 Revisar código" onPress={cast(ACOES.revisar)} />
          <Button key="limpar" label="🧹 Limpar torre" onPress={clear} />
        </Box>
      </Box>
    )

    if (e.surface === 'desktop' && 'Svg' in ui) {
      const { Svg } = ui
      const W = Math.max(260, Math.min(900, (e.props.bodyColumns || 40) * 8 - 8))
      const F = 'ui-monospace,SFMono-Regular,Menlo,monospace'
      const card = (h: number, title: string, body: string, dot = false) =>
        `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}">${CSS}
<rect class="card" x=".5" y=".5" width="${W - 1}" height="${h - 1}" rx="12"/>
${dot ? `<circle class="orb" cx="18" cy="20" r="4" fill="#ff3860"/>` : ''}
<text class="t" x="${dot ? 28 : 14}" y="24" font-family="${F}" font-size="12" font-weight="700" letter-spacing="1.5">${xml(title)}</text>
<rect x="${(dot ? 28 : 14) + title.length * 8.6 + 6}" y="12" width="48" height="16" rx="5" fill="#a77bff"/>
<text x="${(dot ? 28 : 14) + title.length * 8.6 + 30}" y="24" text-anchor="middle" font-family="${F}" font-size="9.5" font-weight="700" fill="#1a1028">MAGIA</text>
${body}</svg>`

      // Cabeçalho: a raposa arcanista guarda a torre
      const head = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="60" viewBox="0 0 ${W} 60">${CSS}
${wizardSvg(MAGOS[7], 4, 4, 3, running.length > 0, 7)}
<text class="t" x="64" y="26" font-family="${F}" font-size="13"><tspan font-weight="700">Claude Code</tspan><tspan class="s"> · ${running.length ? `${running.length} ${running.length === 1 ? 'mago conjurando' : 'magos conjurando'}` : 'torre em silêncio'}</tspan></text>
<text class="s" x="64" y="44" font-family="${F}" font-size="12">${xml(fit(home, Math.floor((W - 70) / 7.4)))}</text></svg>`

      // Grimório: feitiços (ferramentas) por turno, últimos 10
      const bars = hist.length ? hist : [0]
      const max = Math.max(1, ...bars)
      const cw = W - 28, ch = 90, bw = Math.min(34, (cw - (bars.length - 1) * 8) / bars.length)
      const chart = bars.map((n, i) => {
        const h = Math.max(3, (n / max) * ch)
        const x = 14 + i * (bw + 8)
        return `<rect x="${x}" y="${40 + ch - h}" width="${bw}" height="${h}" rx="3" fill="${i % 2 ? '#c9a6ff' : '#a77bff'}"/><text class="s" x="${x + bw / 2}" y="${36 + ch - h}" text-anchor="middle" font-family="${F}" font-size="9">${n}</text>`
      }).join('') + `<line class="ln" x1="14" y1="${40 + ch + .5}" x2="${W - 14}" y2="${40 + ch + .5}"/><text class="s" x="14" y="${ch + 58}" font-family="${F}" font-size="10">feitiços por turno${hist.length ? '' : ' · ainda nenhum turno'}</text>`

      // Mana: limite de 5 horas (ou contexto, quando o limite não vem)
      const mw = W - 28
      const fill = pct === null ? 0 : Math.round((mw * Math.min(100, pct)) / 100)
      const meter = `<defs><linearGradient id="mana" x1="0" x2="${mw}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#39ff88"/><stop offset=".55" stop-color="#ffd166"/><stop offset="1" stop-color="#ff3860"/></linearGradient></defs>
<text class="t" x="14" y="50" font-family="${F}" font-size="12">${pctLabel}</text>
<text class="t" x="${W - 14}" y="50" text-anchor="end" font-family="${F}" font-size="12">${pct === null ? '—' : `${Math.round(pct)}%`}</text>
<rect class="k" x="14" y="60" width="${mw}" height="14" rx="7"/><rect x="14" y="60" width="${fill}" height="14" rx="7" fill="url(#mana)"/>
<text class="s" x="14" y="92" font-family="${F}" font-size="10">${[mn.week !== null ? `semana ${Math.round(mn.week)}%` : '', mn.ctx !== null && mn.five !== null ? `contexto ${Math.round(mn.ctx)}%` : '', mn.usd !== null ? `≈ $${mn.usd.toFixed(2)}` : ''].filter(Boolean).join('  ·  ')}</text>`

      // Ao vivo: o que cada mago está fazendo
      const shown = list.slice(0, 8)
      const rowsSvg = shown.length
        ? shown.map((r, i) => {
            const m = MAGOS[r.mage % MAGOS.length]!
            const y = 40 + i * 54
            const chars = Math.floor((W - 90) / 7.4)
            return `${wizardSvg(m, 12, y, 3, r.status === 'running', r.mage)}
<text x="66" y="${y + 18}" font-family="${F}" font-size="12" font-weight="700" fill="${m.color}">${xml(m.icon + ' ' + m.name)}</text>
<text x="${W - 14}" y="${y + 18}" text-anchor="end" font-family="${F}" font-size="12" fill="${markColor(r, m.color)}">${mark(r)} ${time(r)}</text>
<text class="t" x="66" y="${y + 35}" font-family="${F}" font-size="12">${xml(fit(r.description || r.type, chars))}</text>`
          }).join('')
        : `<text class="s" x="14" y="58" font-family="${F}" font-size="12">Nenhum mago invocado ainda.</text>`
      const liveH = 52 + Math.max(1, shown.length) * 54

      return (
        <Box flexDirection="column" gap={1}>
          <Svg key="head" source={head} alt={`Claude Code, ${running.length} magos conjurando, ${home}`} width={W} height={60} />
          <Svg key="chart" source={card(ch + 72, 'GRIMÓRIO', chart)} alt={`Feitiços por turno: ${hist.join(', ') || 'nenhum'}`} width={W} height={ch + 72} />
          <Text bold>FEITIÇOS RÁPIDOS</Text>
          {buttons}
          <Svg key="mana" source={card(104, 'MANA', meter)} alt={`${pctLabel}: ${pct === null ? 'sem dado' : Math.round(pct) + '%'}`} width={W} height={104} />
          <Svg key="live" source={card(liveH, 'AO VIVO · SEUS MAGOS', rowsSvg, true)} alt={shown.map(r => `${MAGOS[r.mage % MAGOS.length]!.name}: ${r.description}, ${label(r)}`).join('; ') || 'Nenhum mago invocado'} width={W} height={liveH} />
        </Box>
      )
    }

    // Terminal: o mesmo em texto
    const cols = Math.max(24, e.props.bodyColumns || 40)
    const barW = Math.max(8, cols - 12)
    const filled = pct === null ? 0 : Math.round((barW * Math.min(100, pct)) / 100)
    const spark = (hist.length ? hist : [0]).map(n => '▁▂▃▄▅▆▇█'[Math.round((n / Math.max(1, ...hist)) * 7)]).join('')
    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <Text><Text bold>Claude Code</Text><Text dimColor> · {running.length} magos conjurando</Text></Text>
          <Text dimColor wrap="truncate-end">{home}</Text>
        </Box>
        <Box flexDirection="column">
          <Text bold color="#a77bff">GRIMÓRIO</Text>
          <Text color="#a77bff">{spark}</Text>
          <Text dimColor>feitiços por turno</Text>
        </Box>
        <Box flexDirection="column">
          <Text bold color="#a77bff">FEITIÇOS RÁPIDOS</Text>
          {buttons}
        </Box>
        <Box flexDirection="column">
          <Text bold color="#a77bff">MANA <Text dimColor>· {pctLabel} {pct === null ? '—' : `${Math.round(pct)}%`}</Text></Text>
          <Text><Text color={pct !== null && pct > 80 ? '#ff3860' : pct !== null && pct > 50 ? '#ffd166' : '#39ff88'}>{'█'.repeat(filled)}</Text><Text dimColor>{'░'.repeat(barW - filled)}</Text></Text>
        </Box>
        <Box flexDirection="column">
          <Text bold color="#a77bff"><Text color="#ff3860">●</Text> AO VIVO · SEUS MAGOS</Text>
          {list.length === 0 && <Text dimColor>Nenhum mago invocado ainda.</Text>}
          {list.slice(0, 8).map(r => {
            const m = MAGOS[r.mage % MAGOS.length]!
            return (
              <Text key={r.id} wrap="truncate-end">
                <Text color={m.color}>{m.icon} {m.name}</Text> <Text color={markColor(r, m.color)}>{mark(r)}</Text> {r.description || r.type} <Text dimColor>{time(r)}</Text>
              </Text>
            )
          })}
        </Box>
      </Box>
    )
  })


  // Faixa acima do prompt: o pergaminho do projeto (git e arquivos que o Claude mexeu)
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const g = await read($, git)
    const files = await read($, touched)
    if (!g && files.length === 0) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const cast = (text: string) => () => { void $.prompt.submit({ text, asUser: true }) }
    const dirty = g ? g.changed + g.untracked : 0
    const base = (f: string) => f.split('/').pop() ?? f
    const shown = files.slice(0, 4).map(base).join(', ') + (files.length > 4 ? ` +${files.length - 4}` : '')
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" gap={1} flexWrap="wrap">
          {g ? <>
            <Text bold color="#a77bff">⎇ {g.branch}</Text>
            {g.ahead > 0 ? <Text color="#39ff88">↑{g.ahead}</Text> : ''}
            {g.behind > 0 ? <Text color="#ffd166">↓{g.behind}</Text> : ''}
            <Text dimColor>·</Text>
            {dirty === 0
              ? <Text color="#39ff88">✓ tudo commitado</Text>
              : <Text>{dirty} {dirty === 1 ? 'arquivo alterado' : 'arquivos alterados'}{g.plus || g.minus ? <Text> (<Text color="#39ff88">+{g.plus}</Text> <Text color="#ff3860">−{g.minus}</Text>)</Text> : null}</Text>}
            {g.subject ? <Text dimColor wrap="truncate-end">· último: “{g.subject}” {g.date ? ago(g.date) : ''}</Text> : ''}
          </> : <Text dimColor>📁 pasta sem git</Text>}
        </Box>
        {files.length > 0 ? <Text dimColor wrap="truncate-end">🪶 Claude mexeu em: {shown}</Text> : null}
        {g && dirty > 0 && !e.props.isWorking ? (
          <Box flexDirection="row" gap={1}>
            <Button key="commit" label="✓ Commit" onPress={cast('Faça commit das mudanças atuais com uma mensagem clara. Mostre a mensagem antes de commitar.')} />
            <Button key="review" label="🔍 Revisar mudanças" onPress={cast('Revise as mudanças ainda não commitadas e aponte bugs ou problemas.')} />
            {g.behind > 0 ? <Button key="pull" label="↓ Atualizar branch" onPress={cast('Atualize esta branch com o remoto (pull). Se houver conflito, me explique antes de resolver.')} /> : null}
          </Box>
        ) : null}
      </Box>
    )
  })

  // Spinner: runa girando no lugar das reticências
  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    const f = await read($, frame)
    return next({ ...e, props: { ...e.props, suffix: ` ${RUNAS[f % RUNAS.length]}` } })
  })

  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    const { tool, input, isRunning, isErrored, isInterrupted } = e.props
    const args = (input ?? {}) as Record<string, unknown>
    const { Box, Text } = $.ui.resolve(e)
    const status = isRunning ? null : isErrored ? ['✗', '#ff3860'] : isInterrupted ? ['◌', '#f5ff3b'] : ['✓', '#39ff88']

    if (tool === 'Agent') {
      const id = e.props.tool_use_id
      const rs = await read($, runs)
      const run = rs.find(r => r.id === id)
      const m = MAGOS[(run ? run.mage : rs.length) % MAGOS.length]!
      const f = isRunning ? await read($, frame) : 0
      const ms = run?.end ? run.end - run.start : 0
      return (
        <Box>
          <Text color={m.color} bold>{m.icon} {m.name}</Text>
          <Text dimColor> ({String(args.subagent_type ?? 'aprendiz')}) </Text>
          <Text>{String(args.description ?? '')} </Text>
          {isRunning
            ? <Text color={m.color}>{PONTA[f % PONTA.length]} conjurando…</Text>
            : <Text color={status![1]}>{status![0]} {isErrored ? 'feitiço falhou' : isInterrupted ? 'interrompido' : 'feitiço concluído'}{ms ? ` em ${fmt(ms)}` : ''}</Text>}
        </Box>
      )
    }

    const s = FEITICOS[tool]
    if (!s) return next(e)
    const max = Math.max(20, (e.viewport?.columns ?? 100) - s.name.length - 12)
    const raw = String(args[s.field] ?? '').replace(/\s+/g, ' ')
    const arg = raw.length > max ? raw.slice(0, max - 1) + '…' : raw
    return (
      <Box>
        <Text color={s.color} bold>{s.icon} {s.name} </Text>
        <Text dimColor>{arg} </Text>
        {status ? <Text color={status[1]}>{status[0]}</Text> : <Text color={s.color}>…</Text>}
      </Box>
    )
  })
}
