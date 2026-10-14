import type { Register } from 'claude-code'

import {
  CHOIX_ANNULER,
  CHOIX_TEL_QUEL,
  CONSIGNE_SYSTEME,
  PREFIXE_CONTOURNEMENT,
  construireDemande,
  construireQuestion,
  decider,
  estHorsVerification,
  estReponseCourte,
  libelleSuggestion,
  lireVerdict,
} from './logique'

const CLE_ACTIF = 'actif'

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'verif-prompt',
      description: 'Active ou désactive la vérification des prompts par Haiku (on | off).',
      argumentHint: 'on | off',
    })

    return next(e)
  })

  on('command.run', { command: 'verif-prompt' }, async ($, e) => {
    const argument = e.args.trim().toLowerCase()
    const actif =
      argument === 'on' ? true : argument === 'off' ? false : (await $.store.get(CLE_ACTIF)) === false
    await $.store.set(CLE_ACTIF, actif)

    return {
      text: actif
        ? `Vérification des prompts activée (préfixez un prompt par « ${PREFIXE_CONTOURNEMENT} » pour l'envoyer sans vérification).`
        : 'Vérification des prompts désactivée.',
    }
  })

  on('prompt.submit', async ($, e, next) => {
    const humain = e.origin.kind === 'composer' || e.origin.kind === 'bridge'
    if (!humain || estHorsVerification(e.text)) return next(e)

    if (e.text.trimStart().startsWith(PREFIXE_CONTOURNEMENT)) {
      return next({ ...e, text: e.text.trimStart().slice(PREFIXE_CONTOURNEMENT.length).trimStart() })
    }

    if ((await $.store.get(CLE_ACTIF)) === false) return next(e)

    const messages = await $.session.messages()
    const dernierAssistant = messages.filter(m => m.role === 'assistant' && m.text.trim() !== '').at(-1)?.text
    if (estReponseCourte(e.text, dernierAssistant)) return next(e)

    $.ui.status('Vérification du prompt par Haiku…')
    const reponse = await $.model.complete({
      model: 'haiku',
      system: CONSIGNE_SYSTEME,
      prompt: construireDemande(e.text, dernierAssistant),
      maxTokens: 2000,
      timeoutMs: 30000,
    })
    $.ui.status(undefined)

    if (!reponse.isAnswered) {
      $.ui.log(`verif-prompt : Haiku n'a pas répondu (${reponse.reason}), prompt envoyé tel quel.`)

      return next(e)
    }

    const verdict = lireVerdict(reponse.text)
    if (verdict === undefined || verdict.suffisant) return next(e)

    const options = [
      ...verdict.suggestions.map((s, i) => libelleSuggestion(i, s)),
      CHOIX_TEL_QUEL,
      CHOIX_ANNULER,
    ]

    let choix: string
    try {
      choix = await $.ui.ask(construireQuestion(verdict), { header: 'Prompt', options })
    } catch {
      choix = CHOIX_ANNULER
    }

    const decision = decider(e.text, verdict, choix)
    if (decision.genre === 'annuler') {
      await $.prompt.fill({ text: e.text })

      return { drop: 'Prompt annulé : il est remis dans la zone de saisie.' }
    }

    if (decision.texte !== e.text) $.ui.log(`verif-prompt : prompt envoyé →\n${decision.texte}`)

    return next({ ...e, text: decision.texte })
  }).catch(($, e, next) => next(e))
}
