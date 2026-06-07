# Claude Code

This project uses the Payload CMS skills at `.claude/skills/payload/` and `.claude/skills/payload-multitenant-storefront/`.
Start with `.claude/skills/payload/SKILL.md` for a quick reference, then see `.claude/skills/payload/reference/` and `.claude/skills/payload-multitenant-storefront/` for detailed docs.


Contexte projet pour Claude Code. Lis ce fichier en entier avant toute tâche.
Il décrit l'architecture, les invariants à ne jamais casser, et où trouver le
détail. Les docs longues vivent dans `docs/` — suis les renvois plutôt que de
tout charger ici.

## Ce qu'on construit

Une plateforme e-commerce multi-boutiques type Shopify : **un seul déploiement
Payload CMS héberge N boutiques de marchands indépendantes**, chacune
résolue par son propre domaine ou sous-domaine. Modèle *multi-tenant poolé* :
un code, une base partitionnée par tenant. Ce n'est PAS une instance par
marchand (ça ne passe pas l'échelle).

Le cœur est générique (devise, langue, provider de paiement neutres). Le marché
sénégalais (FCFA, mobile money, français) est un **module optionnel** — voir
`docs/regional-senegal.md`, activé seulement si demandé.

## Stack

- Payload CMS (Payload tourne dans l'app Next, un seul process)
- PostgreSQL (datastore principal, partitionné par tenant + RLS sur les tables sensibles)
- Redis (cache + file de jobs Payload)
- Meilisearch (recherche produits, index filtré par tenant)
- MinIO / S3 (médias via `@payloadcms/storage-s3`)
- Caddy (reverse proxy, HTTPS, routage des domaines)
- Orchestration : Coolify sur VPS

## Les cinq piliers (ordre de construction)

À construire dans cet ordre — chacun dépend du précédent. Détail complet dans
`docs/architecture.md`.

1. **Résolution tenant** — middleware : host → tenant. `docs/tenancy.md`
2. **Isolation tenant** — chaque requête scopée ; access control + RLS. `docs/tenancy.md`
3. **Moteur de thème** — sections JSON (blocks Payload) → composants React mappés. `docs/theme-engine.md`
4. **Commerce** — catalogue, panier, commandes ; modèle partagé partitionné. `docs/commerce.md`
5. **Paiement** — interface `PaymentProvider`, credentials par tenant, webhooks. `docs/payments.md`

## Invariants — NE JAMAIS casser

Ces règles protègent contre les pires modes de défaillance. Si une tâche semble
exiger d'en violer une, arrête-toi et signale-le plutôt que de contourner.

- **Le scoping tenant vit dans l'access control, pas dans la logique métier.**
  Chaque collection appartenant à un tenant force `tenant = currentTenant` dans
  ses fonctions `access` (qui renvoient une contrainte de requête, pas un
  booléen). Un `find()` qui oublie son filtre = une boutique voit les données
  d'une autre. RLS Postgres est le second garde-fou sur `orders` et
  `transactions`.

- **Le webhook est l'unique source de vérité du paiement.** Les flux mobile
  money / redirection sont asynchrones : l'acheteur peut fermer l'onglet avant
  le callback. Ne JAMAIS marquer une commande payée sur le retour navigateur —
  uniquement sur un webhook à signature vérifiée, montant vérifié, idempotent,
  scopé au tenant. Un job de réconciliation rattrape les webhooks perdus.

- **Les secrets par tenant sont chiffrés au repos.** Les credentials de paiement
  de chaque marchand sont chiffrés (AES-256-GCM) avec une clé maître hors base
  (secret manager / env), déchiffrés seulement au moment de l'usage.

- **Les design tokens passent par variables CSS, pas par classes dynamiques.**
  Tailwind purge les classes qu'il ne voit pas au build : `grid-cols-${n}` casse
  silencieusement. Utiliser une safelist ou du style inline pour les valeurs
  pilotées par le tenant.

- **Les montants sont des entiers en unités mineures.** Jamais de float pour
  l'argent. En XOF (si module régional), stocker des entiers FCFA.

- **Le total est recalculé côté serveur au checkout.** Ne jamais faire confiance
  à un total envoyé par le client.

## Conventions de code

- TypeScript strict. Pas de `any` implicite (les stubs scaffoldés portent des
  `any` marqués `TODO` à typer).
- Chaque collection appartenant à un tenant porte un champ `tenant`
  (relationship, `required`, `index`) et un hook `beforeChange` qui le stampe
  depuis `req.context.tenantId`.
- Les composants de section reçoivent `{ settings, tenantId }` et vont chercher
  leurs données scopées par tenant eux-mêmes.
- Les handlers de webhook vivent sous `src/app/api/webhooks/[provider]/[tenantId]/`.
- Commits : Conventional Commits (`feat:`, `fix:`, `refactor:`...).

## Layout du repo

```
src/
├── middleware.ts                 # résolution tenant
├── access/tenantScoped.ts        # filtre tenant forcé
├── collections/                  # tenants, domains, pages, products, orders, transactions
├── theme/sectionRegistry.ts      # mappe type de section -> composant React
├── theme/sections/               # les composants de section
├── payments/PaymentProvider.ts   # interface paiement
├── payments/providers/           # implémentations (PayDunya, CinetPay, Stripe...)
└── app/
    ├── [...slug]/page.tsx         # render loop (remplace Liquid)
    └── api/webhooks/[provider]/[tenantId]/route.ts
```

## Démarrage

Le squelette se génère avec le script du skill (voir `docs/scaffolding.md`) :

```bash
python scripts/scaffold.py --target . --regional none      # générique
python scripts/scaffold.py --target . --regional senegal   # + module mobile money
```

Le script écrit seulement des fichiers (stubs marqués `TODO`). Installer
Payload, Next.js et les adaptateurs séparément.

## Vérifications d'acceptation (les 3 preuves)

Après chaque évolution majeure, vérifier que ces trois propriétés tiennent —
elles prouvent que les piliers les plus durs fonctionnent :

1. Deux boutiques sur deux domaines rendent des thèmes différents depuis le même
   déploiement.
2. La boutique A ne peut pas lire les données de la boutique B via l'API (test
   d'isolation — à automatiser et garder vert).
3. Une commande passe à `paid` uniquement après un webhook vérifié, jamais sur
   la redirection.

## À vérifier avant de coder (ne pas inventer)

Les noms d'options des plugins Payload (`@payloadcms/storage-s3`,
`@payloadcms/plugin-multi-tenant`) et les endpoints des agrégateurs
(PayDunya, CinetPay) changent entre versions. Vérifier la doc officielle à jour
au moment d'intégrer plutôt que de se fier à une recette figée. En cas de doute,
le signaler dans le code (`// TODO: vérifier nom d'option vs doc actuelle`).

## Où aller pour le détail

| Sujet | Fichier |
| --- | --- |
| Décisions d'architecture, graphe de dépendances | `docs/architecture.md` |
| Résolution + isolation tenant | `docs/tenancy.md` |
| Moteur de thème | `docs/theme-engine.md` |
| Commerce | `docs/commerce.md` |
| Paiement | `docs/payments.md` |
| Déploiement Coolify/Caddy | `docs/deployment.md` |
| Module Sénégal (optionnel) | `docs/regional-senegal.md` |
| Génération du squelette | `docs/scaffolding.md` |
