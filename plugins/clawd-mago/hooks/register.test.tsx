import { expect, test } from 'claude-code/testing'
import type { On, PluginState } from 'claude-code'

type Savvy = PluginState['savvy-progress']

const PLUGIN = 'clawd-mago'
const band = { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 100, scroll: { offset: 0, bodyRows: 10 }, view: {} }

const activeFlow: Savvy['flow'] = {
  title: 'Ship the wizard',
  total: 5,
  done: 3,
  running: 1,
  phase: 'delegate',
  isFinished: false,
  tasks: [],
}

const worker = {
  id: 'a1',
  type: 'savvy-flow:savvy-medium',
  description: 'Draw the mascot',
  model: 'opus',
  status: 'running',
  startedAt: 0,
  contextTokens: 0,
  contextMax: 0,
  tokens: 0,
  costUsd: 0,
  steps: 0,
  round: 1,
} as const

// Stands in for savvy-progress: answers its state as the plugin would hold it.
function seed(on: On, flow: Savvy['flow'], agents: Savvy['agents']) {
  on('state.get', (_$, e, next) => {
    if (e.plugin !== 'savvy-progress') return next(e)
    if (e.key === 'flow') return { value: { value: flow, version: 1 } } as never
    if (e.key === 'agents') return { value: { value: agents, version: 1 } } as never
    return next(e)
  })
}

// Stands in for what is beneath: a band of its own, counted.
function beneath(on: On) {
  const seen = { calls: 0 }
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    seen.calls += 1
    const { Text } = $.ui.resolve(e)
    return <Text>beneath</Text>
  })
  return seen
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}: an active flow draws the wizard band`, async ($, on) => {
    seed(on, activeFlow, [worker])
    const seen = beneath(on)
    const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'AbovePrompt', props: band })
    expect(await ui.find({ text: /Ship the wizard/ })).toBeDefined()
    expect(await ui.find({ text: /3\/5 feitiços/ })).toBeDefined()
    expect(await ui.find({ text: /Draw the mascot/ })).toBeDefined()
    expect(await ui.find({ text: /\(medium\)/ })).toBeDefined()
    expect(seen.calls).toBe(1)
    expect(await ui.find({ text: /beneath/ })).toBeDefined()
    await ui.unmount()
  })

  test(`${surface}: no running agent says it is waiting, total 0 draws 0/0`, async ($, on) => {
    seed(on, { ...activeFlow, total: 0, done: 0 }, [])
    const seen = beneath(on)
    const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'AbovePrompt', props: band })
    expect(await ui.find({ text: /0\/0 feitiços/ })).toBeDefined()
    expect(await ui.find({ text: /aguardando/ })).toBeDefined()
    expect(seen.calls).toBe(1)
    expect(await ui.find({ text: /beneath/ })).toBeDefined()
    await ui.unmount()
  })

  for (const [name, flow] of [
    ['no flow', null],
    ['a finished flow', { ...activeFlow, isFinished: true }],
  ] as const) {
    test(`${surface}: ${name} falls through to next`, async ($, on) => {
      seed(on, flow, [worker])
      const seen = beneath(on)
      const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'AbovePrompt', props: band })
      expect(seen.calls).toBe(1)
      expect(await ui.find({ text: /beneath/ })).toBeDefined()
      expect(await ui.find({ text: /feitiços/ })).toBeUndefined()
      await ui.unmount()
    })
  }
}

// Two crabs as savvy-progress's crab() draws them (1.2.1): a walking heavy
// (detective, prop group `it` inside `bd`) and an idle, mirrored, dimmed medium.
const savvyCrabs =
  '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="66" viewBox="0 0 300 66"><style>.run .la{animation:st .5s steps(1) infinite}</style>' +
  '<g transform="translate(0,14) scale(1.1)" opacity="1" shape-rendering="crispEdges"><g class="c-heavy run"><g class="bd"><rect x="7" y="10" width="16" height="12" fill="#D97757"/><rect x="6" y="9" width="18" height="1" fill="#5A3519"/><g class="it"><rect x="23" y="10" width="4" height="4" fill="#D97757"/><rect x="24" y="2" width="3" height="3" fill="rgba(169,214,245,.7)"/></g><g class="gl"><rect x="24" y="2" width="1" height="1" fill="#fff"/></g></g><g class="la"><rect x="7" y="22" width="2" height="4" fill="#D97757"/></g><g class="lb"><rect x="11" y="22" width="2" height="4" fill="#D97757"/></g></g></g>' +
  '<text x="50" y="20">Draw the mascot</text>' +
  '<g transform="translate(233,6) scale(-1.1,1.1)" opacity="0.45" shape-rendering="crispEdges"><g class="c-medium"><g class="bd"><rect x="7" y="10" width="16" height="12" fill="#D97757"/><g class="pan"><rect x="22" y="8" width="7" height="2" fill="#4A4A48"/></g><g class="egg"><rect x="24" y="7" width="3" height="1" fill="#F5B731"/></g></g><g class="la"></g><g class="lb"></g></g></g>' +
  '</svg>'

// Stands in for savvy-progress's pane hook: an Svg row with crabs, a Button beside it.
function savvyPane(on: On) {
  on('ui.render', { component: 'Pane', requestId: 'savvy-agents' }, ($, e) => {
    const ui = $.ui.resolve(e)
    const { Box, Text, Button } = ui
    if (e.surface === 'terminal' || !('Svg' in ui)) return <Text>no svg</Text>
    const { Svg } = ui
    return (
      <Box flexDirection="column">
        <Button key="compact" label="collapse" plain onPress={() => undefined} />
        <Svg key="row" source={savvyCrabs} alt="Draw the mascot" width={300} height={66} />
      </Box>
    )
  })
}

const pane = { title: 'Agents', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 20 }, view: {} } as const

test('desktop: the agents pane draws every crab as the wizard', async ($, on) => {
  savvyPane(on)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: 'savvy-agents', props: pane })
  const svg = await ui.find({ type: 'Svg' })
  const source = String(svg?.props.source)
  // both crabs swapped: no costume group, prop or clay left
  expect(source.includes('c-heavy')).toBe(false)
  expect(source.includes('c-medium')).toBe(false)
  expect(source.includes('class="it"')).toBe(false)
  expect(source.includes('class="pan"')).toBe(false)
  expect(source.includes('#D97757')).toBe(false)
  expect(source.match(/class="wand"/g)?.length).toBe(2)
  expect(source.includes('fill="#1F1E1D"')).toBe(true)
  expect(source.includes('fill="#7F77DD"')).toBe(true)
  // walking state kept per crab, placement and dimming kept
  expect(source.includes('<g class="c-wizard run">')).toBe(true)
  expect(source.includes('<g class="c-wizard">')).toBe(true)
  expect(source.includes('translate(233,6) scale(-1.1,1.1)" opacity="0.45"')).toBe(true)
  expect(source.includes('translate(0,14) scale(1.1)')).toBe(true)
  // the rest of the drawing and our CSS, once
  expect(source.includes('<text x="50" y="20">Draw the mascot</text>')).toBe(true)
  expect(source.match(/@keyframes wsway/g)?.length).toBe(1)
  expect(source.endsWith('</style></svg>')).toBe(true)
  expect(await ui.find({ type: 'Button', key: 'compact' })).toBeDefined()
  await ui.unmount()
})

test('terminal: the agents pane passes through untouched', async ($, on) => {
  savvyPane(on)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: 'savvy-agents', props: pane })
  expect(await ui.find({ text: /no svg/ })).toBeDefined()
  await ui.unmount()
})
