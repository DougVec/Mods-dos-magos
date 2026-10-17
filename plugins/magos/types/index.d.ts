export type Run = {
  id: string
  mage: number
  description: string
  type: string
  model: string
  start: number
  end?: number
  status: 'running' | 'done' | 'failed'
}

export type Git = {
  branch: string
  ahead: number
  behind: number
  changed: number
  untracked: number
  plus: number
  minus: number
  subject: string
  date: string
}

export type Mana = { five: number | null; week: number | null; ctx: number | null; usd: number | null }

declare module 'claude-code' {
  interface PluginState {
    'magos': { frame: number; tick: number; runs: Run[]; turns: number[]; mana: Mana; cwd: string; git: Git | null; touched: string[] }
  }
}
