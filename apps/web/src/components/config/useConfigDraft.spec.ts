import { beforeEach, describe, expect, it } from 'vitest'
import { useExploit } from '@/composables/useExploit'
import { useStations } from '@/composables/useStations'
import { DEFAULT_TURBINE_MODEL } from '@/domain/constants'
import { useConfigDraft } from './useConfigDraft'

beforeEach(() => {
  useStations().reset()
  useExploit().reset()
})

describe('useConfigDraft · station aval', () => {
  it('accepte une station aval étiquetée Aval', () => {
    const { draft, commit } = useConfigDraft()
    expect(draft.turbine.downCode).toBe(DEFAULT_TURBINE_MODEL.downCode)
    expect(commit()).toBeNull()
  })

  it('refuse une station aval qui n’est pas étiquetée Aval', () => {
    const { draft, commit } = useConfigDraft()
    draft.turbine.downCode = draft.turbine.refCode
    expect(commit()).toContain('Aval')
  })

  it('refuse une station aval absente des stations suivies', () => {
    const { draft, commit } = useConfigDraft()
    draft.stations = draft.stations.filter((s) => s.code !== draft.turbine.downCode)
    expect(commit()).toContain('stations suivies')
  })

  it('accepte l’absence de station aval', () => {
    const { draft, commit } = useConfigDraft()
    draft.turbine.downCode = ''
    expect(commit()).toBeNull()
  })
})
