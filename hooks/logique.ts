// Logique pure du mod : heuristiques, consigne envoyée à Haiku et lecture de sa réponse.

export type Suggestion = { titre: string; prompt: string }

export type Verdict = {
  suffisant: boolean
  problemes: string[]
  suggestions: Suggestion[]
}

/** Préfixe qui envoie le prompt sans vérification (il est retiré avant l'envoi). */
export const PREFIXE_CONTOURNEMENT = '>>'

export const CHOIX_TEL_QUEL = 'Envoyer tel quel'
export const CHOIX_ANNULER = 'Annuler'

const MOTS_MAX_REPONSE_COURTE = 15
const CARACTERES_MAX_REPONSE_COURTE = 120

/**
 * Vrai quand le prompt est une réponse courte à une question que l'assistant vient de poser :
 * ces réponses ne sont jamais vérifiées.
 */
export function estReponseCourte(texte: string, dernierMessageAssistant: string | undefined): boolean {
  const propre = texte.trim()
  const mots = propre.split(/\s+/).filter(Boolean).length
  const court = mots <= MOTS_MAX_REPONSE_COURTE && propre.length <= CARACTERES_MAX_REPONSE_COURTE
  if (!court || dernierMessageAssistant === undefined) return false

  return dernierMessageAssistant.slice(-600).includes('?')
}

/** Vrai pour ce qui n'est pas un prompt à vérifier : vide, commande, mode shell. */
export function estHorsVerification(texte: string): boolean {
  const propre = texte.trim()

  return propre.length === 0 || propre.startsWith('/') || propre.startsWith('!')
}

export const CONSIGNE_SYSTEME = `Tu évalues la qualité d'un prompt qu'un développeur s'apprête à envoyer à un assistant de programmation (Claude Code) qui travaille dans son dépôt et voit déjà le code, les fichiers et la conversation.

Juge si le prompt contient assez de détails pour produire un résultat de qualité et prévisible : objectif clair, périmètre (quels fichiers, écrans ou comportements), critères de réussite ou résultat attendu, contraintes importantes.

Sois indulgent : l'assistant peut lire le code lui-même, donc n'exige pas de détails qu'il peut trouver seul. Ne signale un manque que s'il changerait matériellement le résultat ou forcerait l'assistant à deviner. Un prompt qui poursuit la conversation (« continue », « oui, fais-le », une réponse à une question de l'assistant) est suffisant.

Réponds UNIQUEMENT avec un objet JSON, sans texte autour :
{"suffisant": true|false, "problemes": ["manque concret, une phrase courte"], "suggestions": [{"titre": "4 à 6 mots", "prompt": "le prompt complet réécrit"}]}

Si "suffisant" est false, donne 1 ou 2 suggestions : chacune est le prompt complet réécrit, dans la langue du développeur, qui garde son intention et ajoute les précisions manquantes sous forme d'hypothèses raisonnables explicites (il pourra les corriger). Si "suffisant" est true, laisse "problemes" et "suggestions" vides.`

export function construireDemande(texte: string, dernierMessageAssistant: string | undefined): string {
  const contexte = dernierMessageAssistant
    ? `Dernier message de l'assistant (contexte) :\n"""\n${dernierMessageAssistant.slice(-1500)}\n"""\n\n`
    : ''

  return `${contexte}Prompt à évaluer :\n"""\n${texte}\n"""`
}

/** Lit la réponse de Haiku ; undefined quand elle est illisible (le prompt part alors tel quel). */
export function lireVerdict(reponse: string): Verdict | undefined {
  const debut = reponse.indexOf('{')
  const fin = reponse.lastIndexOf('}')
  if (debut < 0 || fin <= debut) return undefined

  let brut: unknown
  try {
    brut = JSON.parse(reponse.slice(debut, fin + 1))
  } catch {
    return undefined
  }
  if (typeof brut !== 'object' || brut === null) return undefined

  const objet = brut as Record<string, unknown>
  if (typeof objet.suffisant !== 'boolean') return undefined

  const problemes = Array.isArray(objet.problemes)
    ? objet.problemes.filter((p): p is string => typeof p === 'string' && p.trim() !== '')
    : []
  const suggestions = Array.isArray(objet.suggestions)
    ? objet.suggestions
        .filter(
          (s): s is Suggestion =>
            typeof s === 'object' &&
            s !== null &&
            typeof (s as Suggestion).titre === 'string' &&
            typeof (s as Suggestion).prompt === 'string' &&
            (s as Suggestion).prompt.trim() !== '',
        )
        .slice(0, 2)
    : []

  return { suffisant: objet.suffisant, problemes, suggestions }
}

export function libelleSuggestion(index: number, suggestion: Suggestion): string {
  const titre = suggestion.titre.trim().slice(0, 40)

  return `Suggestion ${index + 1} : ${titre}`
}

export function construireQuestion(verdict: Verdict): string {
  const problemes = verdict.problemes.length
    ? verdict.problemes.map(p => `• ${p}`).join('\n')
    : '• Le prompt manque de précisions.'
  const suggestions = verdict.suggestions
    .map((s, i) => `── ${libelleSuggestion(i, s)}\n${s.prompt.trim()}`)
    .join('\n\n')

  return `Ce prompt risque de donner un résultat imprévisible :\n${problemes}\n\n${suggestions}\n\nChoisissez une suggestion, envoyez tel quel, annulez, ou tapez vos précisions sous « Other ». Que voulez-vous faire ?`
}

export type Decision =
  | { genre: 'envoyer'; texte: string }
  | { genre: 'annuler' }

/** Traduit le choix de l'utilisateur en texte à envoyer ou en annulation. */
export function decider(texteOriginal: string, verdict: Verdict, reponse: string): Decision {
  if (reponse === CHOIX_ANNULER) return { genre: 'annuler' }
  if (reponse === CHOIX_TEL_QUEL) return { genre: 'envoyer', texte: texteOriginal }

  const index = verdict.suggestions.findIndex((s, i) => libelleSuggestion(i, s) === reponse)
  if (index >= 0) return { genre: 'envoyer', texte: verdict.suggestions[index].prompt.trim() }

  const precisions = reponse.trim()
  if (precisions === '') return { genre: 'envoyer', texte: texteOriginal }

  return { genre: 'envoyer', texte: `${texteOriginal}\n\nPrécisions : ${precisions}` }
}
