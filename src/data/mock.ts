import type { Phenotype } from '../types'
import {
  ageRangeOptions,
  genealogyOptions,
  matches,
  phenotypeTypes,
  scanSteps,
  userPhenotype as catalogUserPhenotype,
} from '../../shared/phenotype-catalog.mjs'

export const userPhenotype = catalogUserPhenotype as Phenotype
export { ageRangeOptions, genealogyOptions, matches, phenotypeTypes, scanSteps }
