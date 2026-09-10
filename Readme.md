# NPay - SenePay Cameroon Payment Gateway

NPay est une passerelle de paiement développée avec **Node.js**, **Express** et **SenePay API Direct** permettant d'accepter les paiements **Mobile Money Cameroun** via :

- Orange Money Cameroon
- MTN Mobile Money Cameroon

Le projet comprend :

- Un backend Express qui communique avec l'API SenePay
- Une interface frontend HTML/CSS/JavaScript
- Un système de vérification automatique du statut du paiement
- Un endpoint Webhook prêt pour la production

---

# Fonctionnalités

- Paiement Mobile Money Cameroun
- Support Orange Money
- Support MTN Mobile Money
- Vérification automatique du statut
- Interface utilisateur simple
- Architecture REST API
- Intégration SenePay API Direct
- Gestion des erreurs
- Webhook SenePay

---

# Technologies

Backend

- Node.js
- Express.js
- Axios
- dotenv
- uuid

Frontend

- HTML5
- CSS3
- JavaScript (Vanilla)

Paiement

- SenePay API Direct

---

# Structure du projet

```
nidpay/

│
├── controllers/
│ └── paymentController.js
│
├── routes/
│ └── paymentRoutes.js
│
├── services/
│ └── senepayService.js
│
├── public/
│ ├── index.html
│ ├── script.js
│ └── style.css
│
├── .env
├── .gitignore
├── package.json
├── package-lock.json
└── server.js
```

---

# Installation

Cloner le projet

```bash
git clone https://github.com/VOTRE_USERNAME/nidpay.git
```

Entrer dans le projet

```bash
cd nidpay
```

Installer les dépendances

```bash
npm install
```

---

# Configuration

Créer un fichier

```
.env
```

Ajouter

```env
SENEPAY_API_KEY=pk_test_xxxxxxxxxxxxxxxxx

SENEPAY_API_SECRET=sk_test_xxxxxxxxxxxxxxxxx

BASE_URL=http://localhost:5000

PORT=5000
```

Ne jamais publier ce fichier.

---

# Lancement

Développement

```bash
npm start
```

Le serveur démarre sur

```
http://localhost:5000
```

---

# API

## Initialiser un paiement

POST

```
/api/pay
```

Body

```json
{
    "phone":"675536430",
    "gateway":"mtn"
}
```

ou

```json
{
    "phone":"689655446",
    "gateway":"orange"
}
```

Réponse

```json
{
    "success":true,
    "token":"PIMxxxxxxxx",
    "status":"Pending"
}
```

---

## Vérifier le statut

GET

```
/api/status/:token
```

Exemple

```
GET /api/status/PIM260711112151799942116
```

---

## Webhook

POST

```
/api/webhook
```

Ce endpoint est destiné aux notifications envoyées par SenePay.

---

# Cycle d'un paiement

```
Utilisateur

      │

      ▼

Frontend

      │

      ▼

Backend Express

      │

      ▼

SenePay API

      │

      ▼

Orange Money / MTN MoMo

      │

      ▼

Confirmation du client

      │

      ▼

Statut du paiement

      │

      ▼

Frontend
```

---

# Statuts possibles

Pending

Paiement initié.

Completed

Paiement validé.

Failed

Paiement refusé.

Cancelled

Paiement annulé.

---

# Déploiement Railway

Déployer le projet sur Railway.

Configurer les variables d'environnement.

Variables nécessaires

```env
SENEPAY_API_KEY=pk_live_xxxxxxxxx

SENEPAY_API_SECRET=sk_live_xxxxxxxxx

BASE_URL=https://votre-backend.up.railway.app

PORT=5000
```

Le webhook devra utiliser

```
https://votre-backend.up.railway.app/api/webhook
```

---

# Sécurité

Ne jamais publier :

- .env
- SENEPAY_API_KEY
- SENEPAY_API_SECRET

Toujours utiliser les Variables Railway en production.

Le webhook devra vérifier la signature envoyée par SenePay avant traitement.

---

# Roadmap

- Authentification
- Base de données
- Historique des paiements
- Dashboard administrateur
- Génération de reçus
- Notifications email
- Notifications SMS
- Tableau de bord marchand

---

# Auteur

Développé par **Line Sandrine**

Backend :
Node.js + Express

Paiement :
SenePay API Direct

Pays :
🇨🇲 Cameroun

---

# Licence

Ce projet est distribué sous licence MIT.

Vous êtes libre de le modifier et de l'utiliser conformément aux termes de cette licence.# spay
