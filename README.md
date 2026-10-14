# verif-prompt

Mod Claude Code qui vérifie chaque prompt avec Claude Haiku avant l'envoi. Si le prompt manque de détails pour obtenir un résultat de qualité et prévisible, il affiche les manques et propose des versions réécrites.

## Installation

Dans une session Claude Code (terminal) :

```
/plugin install verif-prompt --marketplace decarufe/verif-prompt
```

Répondez `y` pour ajouter le marketplace, puis choisissez la portée (utilisateur par défaut).

## Usage

Avant l'envoi d'un prompt jugé insuffisant, une fenêtre propose :

- **Suggestion 1 / 2** : envoie la version réécrite du prompt ;
- **Envoyer tel quel** ;
- **Annuler** : le prompt n'est pas envoyé et revient dans la zone de saisie ;
- **Other** : vos précisions sont ajoutées au prompt.

Ne sont jamais vérifiés : les réponses courtes à une question de l'assistant, les commandes `/…`, le mode shell `!…` et les messages qui ne viennent pas de vous.

### Commandes

| Commande | Effet |
| --- | --- |
| `/verif-prompt on` | active la vérification |
| `/verif-prompt off` | désactive la vérification (réglage conservé entre les sessions) |
| `/verif-prompt` | bascule entre activé et désactivé |
| `>> mon prompt` | envoie ce prompt sans vérification (le préfixe `>>` est retiré) |

Si Haiku ne répond pas (erreur ou délai de 30 s dépassé), le prompt part tel quel.

## Développement

```
claude plugin validate .
claude plugin test .
```
