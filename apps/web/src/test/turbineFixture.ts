import { DEFAULT_TURBINE_MODEL } from '@/domain/constants'
import { cloneTurbineModel } from '@/domain/turbineModel'
import type { TurbineModel } from '@/domain/types'

/**
 * Modèle de test figé : les paramètres de conversion amont → barrage et de délai de la v3 (gain 0,67, décalage
 * −3,4 m³/s, délai de 65 min dépendant du débit). Les tests de mécanisme (délai, conversion, états, prévision) n'ont
 * pas à bouger à chaque recalage : seuls les tests portant sur les valeurs par défaut lisent `DEFAULT_TURBINE_MODEL`.
 */
export const TEST_TURBINE_MODEL: TurbineModel = {
  ...cloneTurbineModel(DEFAULT_TURBINE_MODEL),
  defaultGain: 0.67,
  defaultOffset: -3.4,
  lag: { refMin: 65, refFlow: 30, exponent: 0.25, maxMin: 150 },
}
