# Rayane — portfolio d'architecture

Application web installable (PWA) qui présente les projets de Rayane, architecte, avec un espace administrateur pour publier projets, photos et PDF sans développeur.

Hébergée sur **Cloudflare Workers** :

| Élément | Service Cloudflare | Nom |
|---|---|---|
| Site + API | Worker | `rayane-portfolio` |
| Projets et textes | D1 (SQLite) | `rayane-portfolio` |
| Photos et PDF | R2 | `rayane-portfolio-media` |

## Ce que fait le site

**Visiteurs** : accueil, liste des projets filtrable par catégorie avec recherche, fiche projet (galerie plein écran, lecteur PDF avec miniatures et téléchargement), À propos, Contact.

**Administrateur** (`/#/admin`, protégé par mot de passe) :
- ajouter un projet en 3 étapes : informations → photos (redimensionnées automatiquement, réordonnables, la première sert de couverture) → PDF ;
- modifier, masquer/publier, réordonner, supprimer un projet (ses fichiers sont supprimés de R2) ;
- modifier tous les textes et images du site : image d'accueil, nom, accroche, présentation, image À propos, coordonnées, catégories.

Les 4 projets marqués « Exemple » utilisent des photos libres de droits d'[Unsplash](https://unsplash.com/license) (dossier `public/examples/`). Supprimez-les depuis l'espace admin quand les vrais projets sont en ligne.

## Structure

```
src/worker.js          API (/api/*), fichiers R2 (/media/*), session admin
public/                application web : index.html, app.js, styles.css, manifest, icônes
public/examples/       photos des projets d'exemple
migrations/            schéma D1 + contenu de départ
wrangler.jsonc         configuration Cloudflare (liaisons DB, MEDIA, ASSETS)
```

## API

| Méthode | Route | Accès |
|---|---|---|
| GET | `/api/content` | public (l'admin voit aussi les projets masqués) |
| POST | `/api/login` · `/api/logout` | public |
| PUT | `/api/site` | admin |
| POST | `/api/projects` | admin |
| PUT / DELETE | `/api/projects/:id` | admin |
| POST | `/api/projects/order` | admin |
| POST | `/api/media` (corps brut, en-têtes `content-type` et `x-filename`) | admin |
| DELETE | `/api/media/:key` (refusé si le fichier est encore utilisé) | admin |
| GET | `/media/:key` (`?download=1` pour forcer le téléchargement) | public |

La session admin est un cookie `HttpOnly; Secure; SameSite=Strict` signé (HMAC) valable 30 jours. Les requêtes d'écriture exigent aussi l'en-tête `x-requested-with: portfolio`.

## Déploiement (Cloudflare Workers Builds)

La base D1 (schéma + contenu de départ) et le bucket R2 sont **déjà créés** sur le compte Cloudflare.

1. Cloudflare → **Workers & Pages** → **Create** → **Import a repository** → choisir `houssamaziza/rayane-portfolio`.
2. Laisser les réglages proposés (commande de déploiement `npx wrangler deploy`). Chaque `git push` sur `main` redéploie automatiquement.
3. Dans le Worker → **Settings** → **Variables and Secrets** → ajouter un **Secret** `ADMIN_PASSWORD` (le mot de passe de l'espace admin).
4. Ouvrir l'adresse `https://rayane-portfolio.<votre-sous-domaine>.workers.dev`. Un nom de domaine personnalisé peut être ajouté dans **Settings → Domains & Routes**.

Sur iPhone : ouvrir le site dans Safari → Partager → **Sur l'écran d'accueil**.

## Développement local

```bash
npm install
echo 'ADMIN_PASSWORD=dev' > .dev.vars
npm run db:migrate:local
npm run dev            # http://localhost:8787
```

Nouvelle migration : ajouter `migrations/000X_nom.sql`, puis `npm run db:migrate` pour la base en ligne.
