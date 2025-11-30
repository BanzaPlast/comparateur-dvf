# Comparateur DVF - Mode Local

Ce comparateur DVF vous permet de comparer votre prix avec les transactions réelles DVF (Demandes de Valeurs Foncières), en utilisant un fichier de données local au lieu de l'API en ligne.

## 🚀 Comment utiliser

### 1. Obtenir un fichier de données DVF

Vous pouvez télécharger les données DVF depuis plusieurs sources :

- **data.gouv.fr** : https://www.data.gouv.fr/fr/datasets/demandes-de-valeurs-foncieres/
- **Etalab DVF** : https://app.dvf.etalab.gouv.fr/

### 2. Format du fichier

Le fichier doit être au format **JSON** et contenir un tableau de transactions. Chaque transaction doit avoir au minimum :

```json
[
  {
    "id_mutation": "2023-1234",
    "date_mutation": "2023-01-15",
    "valeur_fonciere": 450000,
    "adresse_numero": "12",
    "adresse_nom_voie": "Rue de la Paix",
    "code_postal": "75001",
    "type_local": "Appartement",
    "surface_reelle_bati": 65.5,
    "surface_terrain": null
  },
  ...
]
```

#### Champs requis :
- `valeur_fonciere` : Prix de vente en euros
- `code_postal` : Code postal de la transaction
- `type_local` : "Maison" ou "Appartement"
- `surface_reelle_bati` ou `surface_terrain` : Surface en m²

#### Champs optionnels mais recommandés :
- `date_mutation` : Date de la transaction
- `adresse_numero` : Numéro de rue
- `adresse_nom_voie` : Nom de la rue

### 3. Utiliser l'application

1. Ouvrez `index.html` dans votre navigateur
2. **Chargez votre fichier DVF** en cliquant sur "Sélectionner un fichier DVF (JSON)"
3. Une fois le fichier chargé, vous verrez : ✅ nom_fichier.json (X transactions)
4. Remplissez les autres champs :
   - **Adresse** : Utilisez l'autocomplétion pour sélectionner une adresse
   - **Type de bien** : Maison ou Appartement
   - **Prix proposé** : Le prix que vous voulez évaluer
   - **Surface** : Surface en m²
5. Cliquez sur **Analyser le prix**

## 🔍 Comment ça fonctionne

L'application :
1. Charge votre fichier JSON en mémoire
2. Filtre les transactions selon :
   - Le code postal de l'adresse sélectionnée
   - Le type de bien (Maison/Appartement)
   - La validité des données (surface et prix > 0)
   - Priorité aux transactions de la même rue si disponibles
3. Calcule les statistiques (moyenne, médiane, min, max)
4. Compare votre prix avec le marché

## 📁 Structure des fichiers

```
comparateur-dvf/
├── index.html          # Interface utilisateur
├── app.js              # Logique de l'application (filtrage local)
├── README.md           # Cette documentation
├── api/
│   └── dvf.js         # Ancienne API (non utilisée en mode local)
└── data/              # Placez vos fichiers DVF ici (optionnel)
    └── exemple.json   # Exemple de fichier DVF
```

## ⚙️ Configuration

Aucune configuration nécessaire ! L'application fonctionne entièrement côté client (dans le navigateur).

### Anciennes dépendances (non nécessaires en mode local)
- ~~API Backend~~ : Non utilisée
- ~~Connexion Internet~~ : Nécessaire uniquement pour l'autocomplétion d'adresse

## 🛠️ Dépannage

### Le fichier ne se charge pas
- Vérifiez que c'est bien un fichier `.json`
- Vérifiez la syntaxe JSON (utilisez un validateur JSON en ligne)
- Vérifiez que le fichier contient un tableau `[...]` et non un objet `{...}`

### Aucune transaction trouvée
- Vérifiez que votre fichier contient des transactions pour le code postal recherché
- Vérifiez le type de bien (Maison vs Appartement)
- Essayez avec une adresse différente dans la même zone

### Erreur de format
Le fichier doit respecter le format décrit ci-dessus. Les champs peuvent avoir des noms légèrement différents selon la source des données.

## 📊 Exemple de fichier DVF minimal

Créez un fichier `data/exemple.json` :

```json
[
  {
    "date_mutation": "2023-06-15",
    "valeur_fonciere": 280000,
    "adresse_numero": "5",
    "adresse_nom_voie": "Rue Victor Hugo",
    "code_postal": "75016",
    "type_local": "Appartement",
    "surface_reelle_bati": 45
  },
  {
    "date_mutation": "2023-05-20",
    "valeur_fonciere": 520000,
    "adresse_numero": "12",
    "adresse_nom_voie": "Avenue Foch",
    "code_postal": "75016",
    "type_local": "Appartement",
    "surface_reelle_bati": 85
  }
]
```

## 🔐 Sécurité et confidentialité

- Toutes les données restent sur votre ordinateur
- Aucune donnée n'est envoyée à un serveur
- Le fichier DVF est chargé uniquement dans votre navigateur

## 📝 Licence

Ce projet est open source.
