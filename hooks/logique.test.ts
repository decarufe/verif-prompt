import { expect, mock, test } from 'claude-code/testing'

import {
  CHOIX_ANNULER,
  CHOIX_TEL_QUEL,
  decider,
  estHorsVerification,
  estReponseCourte,
  libelleSuggestion,
  lireVerdict,
  type Verdict,
} from './logique'

const COMMANDE = {
  command: 'verif-prompt',
  origin: { kind: 'composer' },
  presentation: { isFullscreen: false, columns: 120 },
} as const

const VERDICT: Verdict = {
  suffisant: false,
  problemes: ['Aucun écran précisé.'],
  suggestions: [{ titre: 'Préciser l’écran', prompt: 'Corrige le bouton Enregistrer de /inventaire.' }],
}

test('une réponse courte à une question n’est pas vérifiée', () => {
  expect(estReponseCourte('oui, la deuxième', 'Laquelle préférez-vous ?')).toBe(true)
  expect(estReponseCourte('corrige le bug', 'Terminé.')).toBe(false)
  expect(estReponseCourte('corrige le bug', undefined)).toBe(false)
  expect(estReponseCourte('mot '.repeat(30), 'Une question ?')).toBe(false)
})

test('les commandes et le mode shell sont ignorés', () => {
  expect(estHorsVerification('/clear')).toBe(true)
  expect(estHorsVerification('!git status')).toBe(true)
  expect(estHorsVerification('ajoute un test')).toBe(false)
})

test('le verdict de Haiku est lu même entouré de texte', () => {
  const verdict = lireVerdict('Voici : {"suffisant": false, "problemes": ["x"], "suggestions": [{"titre": "t", "prompt": "p"}]} fin')
  expect(verdict).toEqual({ suffisant: false, problemes: ['x'], suggestions: [{ titre: 't', prompt: 'p' }] })
  expect(lireVerdict('pas de json')).toBe(undefined)
  expect(lireVerdict('{"suffisant": "peut-être"}')).toBe(undefined)
})

test('chaque choix donne le bon prompt', () => {
  expect(decider('fix', VERDICT, CHOIX_ANNULER)).toEqual({ genre: 'annuler' })
  expect(decider('fix', VERDICT, CHOIX_TEL_QUEL)).toEqual({ genre: 'envoyer', texte: 'fix' })
  expect(decider('fix', VERDICT, libelleSuggestion(0, VERDICT.suggestions[0]))).toEqual({
    genre: 'envoyer',
    texte: 'Corrige le bouton Enregistrer de /inventaire.',
  })
  expect(decider('fix', VERDICT, 'sur mobile seulement')).toEqual({
    genre: 'envoyer',
    texte: 'fix\n\nPrécisions : sur mobile seulement',
  })
})

test('/verif-prompt bascule la vérification', async ($, on) => {
  mock.store(on)
  const off = await $.command.run({ ...COMMANDE, args: 'off' })
  expect(off.text).toBe('Vérification des prompts désactivée.')
  const bascule = await $.command.run({ ...COMMANDE, args: '' })
  expect(bascule.text).toMatch(/activée/)
})
