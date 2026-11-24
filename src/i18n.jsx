import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

// ---------------------------------------------------------------------------
// Traduction FR / AR / EN (phase 1).
// Principe : le dictionnaire associe chaque texte francais a sa version
// anglaise ou arabe. Tout texte sans traduction reste en francais.
// Seul le role FORMATION_SANITAIRE peut changer de langue ; tous les autres
// roles restent en francais.
// ---------------------------------------------------------------------------

const CLE_LANGUE = "SYGIMS_langue";
const LANGUES = ["fr", "ar", "en"];

const EN = {
  "Agent formation sanitaire": "Health facility agent",
  "D\u00e9connexion": "Log out",
  "Tableau de bord": "Dashboard",
  "Vue adapt\u00e9e \u00e0 ton r\u00f4le :": "View tailored to your role:",
  "Chargement des donn\u00e9es...": "Loading data...",
  "Aucun contenu d\u00e9fini pour ce r\u00f4le pour l'instant.": "No content defined for this role yet.",
  "Produits suivis": "Tracked products",
  "Par produit et par lot": "By product and by batch",
  "Alertes de rupture": "Stock-out alerts",
  "Ruptures et sous-seuils": "Stock-outs and below minimum",
  "Prochaine p\u00e9remption": "Next expiry",
  "M\u00e9thode FEFO": "FEFO method",
  "Aucun lot": "No batch",
  "Expir\u00e9": "Expired",
  "j": "d",
  "Nouvelle dispensation": "New dispensation",
  "Enregistrer ce que vous donnez aujourd'hui": "Record what you give out today",
  "R\u00e9quisitions": "Requisitions",
  "Stock": "Stock",
  "Offre de service": "Service offer",
  "Compte": "Account",
  "Nouvelle r\u00e9quisition": "New requisition",
  "Suivi de mes r\u00e9quisitions": "Track my requisitions",
  "Rechercher un dossier": "Search a file",
  "Stock du r\u00e9seau": "Network stock",
  "Saisie initiale de stock": "Initial stock entry",
  "Inventaire physique": "Physical inventory",
  "Destructions": "Destructions",
  "Bordereaux \u00e0 confirmer": "Delivery notes to confirm",
  "Mes services": "My services",
  "Notifications": "Notifications",
  "Rapports": "Reports",
  "Changer mon mot de passe": "Change my password",
  "\u2190 Retour": "\u2190 Back",
  "Dispensation enregistr\u00e9e": "Dispensation recorded",
  "Enregistrer une dispensation": "Record a dispensation",
  "Bordereau de dispensation": "Dispensation slip",
  "N\u00b0": "No.",
  "Destinataire": "Recipient",
  "Produit": "Product",
  "Quantit\u00e9": "Quantity",
  "Prix unitaire": "Unit price",
  "Montant": "Amount",
  "Total": "Total",
  "Dispens\u00e9 par :": "Dispensed by:",
  "Cachet et signature": "Stamp and signature",
  "Retour au tableau de bord": "Back to dashboard",
  "Voir le panier": "View basket",
  "Produits": "Products",
  "Rechercher un produit (ex. amox, para...)": "Search a product (e.g. amox, para...)",
  "Toutes": "All",
  "Chargement du catalogue...": "Loading catalogue...",
  "Aucun produit trouv\u00e9.": "No product found.",
  "Retour aux produits": "Back to products",
  "Panier": "Basket",
  "Clique sur un produit pour l'ajouter.": "Tap a product to add it.",
  "Retirer ce produit": "Remove this product",
  "Calcul\u2026": "Calculating\u2026",
  "Stock insuffisant pour au moins un produit du panier.": "Insufficient stock for at least one product in the basket.",
  "Destin\u00e9 \u00e0": "Intended for",
  "Choisir": "Choose",
  "Patient": "Patient",
  "Laboratoire": "Laboratory",
  "Maternit\u00e9": "Maternity",
  "Autre service": "Other service",
  "Responsable labo": "Lab manager",
  "Responsable maternit\u00e9": "Maternity manager",
  "Service": "Service",
  "Nom, t\u00e9l\u00e9phone ou code patient": "Name, phone or patient code",
  "Nom du responsable labo": "Lab manager's name",
  "Nom du/de la responsable": "Manager's name",
  "Nom du service": "Service name",
  "Enregistrer la dispensation": "Record the dispensation",
  "Envoi\u2026": "Sending\u2026",
  "Rapport de dispensation": "Dispensation report",
  "R\u00e9partition de tes dispensations par type de b\u00e9n\u00e9ficiaire, sur la p\u00e9riode de ton choix.": "Breakdown of your dispensations by type of recipient, over the period of your choice.",
  "Du": "From",
  "Au": "To",
  "G\u00e9n\u00e9rer le rapport": "Generate report",
  "Formation sanitaire": "Health facility",
  "du": "from",
  "au": "to",
  "tout l'historique": "full history",
  "G\u00e9n\u00e9r\u00e9 le": "Generated on",
  "Aucune dispensation sur cette p\u00e9riode.": "No dispensation in this period.",
  "Date": "Date",
  "Type": "Type",
  "B\u00e9n\u00e9ficiaire": "Recipient",
  "Action": "Action",
  "\u2190 Pr\u00e9c\u00e9dent": "\u2190 Previous",
  "Suivant \u2192": "Next \u2192",
  "Page": "Page",
  "Demander l'annulation": "Request cancellation",
  "quantit\u00e9": "quantity",
  "Cette demande sera examin\u00e9e par le MCM ou le SASSM de votre Moughataa. Le stock ne sera remis qu'apr\u00e8s leur validation.": "This request will be reviewed by the MCM or the SASSM of your Moughataa. Stock will only be restored after their approval.",
  "Motif de l'annulation (obligatoire)": "Reason for cancellation (required)",
  "Fermer": "Close",
  "Envoyer la demande": "Send the request",
  "stock": "stock",
  "insuffisant": "insufficient",
  "Annulation demand\u00e9e": "Cancellation requested",
  "Annulation refus\u00e9e": "Cancellation refused",
  "Redemander": "Ask again",
  "MRU": "MRU",
  "Impossible de charger le catalogue produits.": "Unable to load the product catalogue.",
  "Impossible de charger le rapport de dispensation.": "Unable to load the dispensation report.",
  "Connexion instable, r\u00e9essayez.": "Unstable connection, please try again.",
  "La dispensation n'a pas pu \u00eatre enregistr\u00e9e.": "The dispensation could not be recorded.",
  "La demande n'a pas pu \u00eatre envoy\u00e9e.": "The request could not be sent.",
  "Ajoute au moins un produit au panier.": "Add at least one product to the basket.",
  "Chaque produit du panier doit avoir une quantit\u00e9 valide.": "Each product in the basket must have a valid quantity.",
  "Pr\u00e9cise \u00e0 qui cette dispensation est destin\u00e9e.": "Specify who this dispensation is for.",
  "Pr\u00e9cise le nom, le t\u00e9l\u00e9phone ou le code du b\u00e9n\u00e9ficiaire.": "Enter the recipient's name, phone or code.",
  "Le motif est obligatoire (5 caract\u00e8res minimum).": "The reason is required (minimum 5 characters).",
  "Demande d'annulation envoy\u00e9e.": "Cancellation request sent.",
};

const AR = {
  "Agent formation sanitaire": "\u0645\u0648\u0638\u0641 \u0627\u0644\u0645\u0646\u0634\u0623\u0629 \u0627\u0644\u0635\u062d\u064a\u0629",
  "D\u00e9connexion": "\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062e\u0631\u0648\u062c",
  "Tableau de bord": "\u0644\u0648\u062d\u0629 \u0627\u0644\u0642\u064a\u0627\u062f\u0629",
  "Vue adapt\u00e9e \u00e0 ton r\u00f4le :": "\u0639\u0631\u0636 \u0645\u062e\u0635\u0635 \u0644\u062f\u0648\u0631\u0643:",
  "Chargement des donn\u00e9es...": "\u062c\u0627\u0631\u064d \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0628\u064a\u0627\u0646\u0627\u062a...",
  "Aucun contenu d\u00e9fini pour ce r\u00f4le pour l'instant.": "\u0644\u0627 \u064a\u0648\u062c\u062f \u0645\u062d\u062a\u0648\u0649 \u0644\u0647\u0630\u0627 \u0627\u0644\u062f\u0648\u0631 \u062d\u0627\u0644\u064a\u064b\u0627.",
  "Produits suivis": "\u0627\u0644\u0645\u0646\u062a\u062c\u0627\u062a \u0627\u0644\u0645\u062a\u0627\u0628\u064e\u0639\u0629",
  "Par produit et par lot": "\u062d\u0633\u0628 \u0627\u0644\u0645\u0646\u062a\u062c \u0648\u0627\u0644\u062f\u0641\u0639\u0629",
  "Alertes de rupture": "\u062a\u0646\u0628\u064a\u0647\u0627\u062a \u0646\u0641\u0627\u062f \u0627\u0644\u0645\u062e\u0632\u0648\u0646",
  "Ruptures et sous-seuils": "\u0646\u0641\u0627\u062f \u0627\u0644\u0645\u062e\u0632\u0648\u0646 \u0648\u0645\u0627 \u062f\u0648\u0646 \u0627\u0644\u062d\u062f \u0627\u0644\u0623\u062f\u0646\u0649",
  "Prochaine p\u00e9remption": "\u0623\u0642\u0631\u0628 \u0627\u0646\u062a\u0647\u0627\u0621 \u0635\u0644\u0627\u062d\u064a\u0629",
  "M\u00e9thode FEFO": "\u0637\u0631\u064a\u0642\u0629 \u0627\u0644\u0623\u0642\u062f\u0645 \u0627\u0646\u062a\u0647\u0627\u0621\u064b \u0623\u0648\u0644\u0627\u064b (FEFO)",
  "Aucun lot": "\u0644\u0627 \u062a\u0648\u062c\u062f \u062f\u0641\u0639\u0629",
  "Expir\u00e9": "\u0645\u0646\u062a\u0647\u064a \u0627\u0644\u0635\u0644\u0627\u062d\u064a\u0629",
  "j": "\u064a\u0648\u0645",
  "Nouvelle dispensation": "\u0635\u0631\u0641 \u062c\u062f\u064a\u062f",
  "Enregistrer ce que vous donnez aujourd'hui": "\u0633\u062c\u0651\u0644 \u0645\u0627 \u062a\u0635\u0631\u0641\u0647 \u0627\u0644\u064a\u0648\u0645",
  "R\u00e9quisitions": "\u0637\u0644\u0628\u0627\u062a \u0627\u0644\u062a\u0632\u0648\u064a\u062f",
  "Stock": "\u0627\u0644\u0645\u062e\u0632\u0648\u0646",
  "Offre de service": "\u0639\u0631\u0636 \u0627\u0644\u062e\u062f\u0645\u0627\u062a",
  "Compte": "\u0627\u0644\u062d\u0633\u0627\u0628",
  "Nouvelle r\u00e9quisition": "\u0637\u0644\u0628 \u062a\u0632\u0648\u064a\u062f \u062c\u062f\u064a\u062f",
  "Suivi de mes r\u00e9quisitions": "\u0645\u062a\u0627\u0628\u0639\u0629 \u0637\u0644\u0628\u0627\u062a\u064a",
  "Rechercher un dossier": "\u0627\u0644\u0628\u062d\u062b \u0639\u0646 \u0645\u0644\u0641",
  "Stock du r\u00e9seau": "\u0645\u062e\u0632\u0648\u0646 \u0627\u0644\u0634\u0628\u0643\u0629",
  "Saisie initiale de stock": "\u0625\u062f\u062e\u0627\u0644 \u0627\u0644\u0645\u062e\u0632\u0648\u0646 \u0627\u0644\u0623\u0648\u0644\u064a",
  "Inventaire physique": "\u0627\u0644\u062c\u0631\u062f \u0627\u0644\u0641\u0639\u0644\u064a",
  "Destructions": "\u0627\u0644\u0625\u062a\u0644\u0627\u0641",
  "Bordereaux \u00e0 confirmer": "\u0625\u0634\u0639\u0627\u0631\u0627\u062a \u0627\u0644\u062a\u0633\u0644\u064a\u0645 \u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u062a\u0623\u0643\u064a\u062f\u0647\u0627",
  "Mes services": "\u062e\u062f\u0645\u0627\u062a\u064a",
  "Notifications": "\u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062a",
  "Rapports": "\u0627\u0644\u062a\u0642\u0627\u0631\u064a\u0631",
  "Changer mon mot de passe": "\u062a\u063a\u064a\u064a\u0631 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631",
  "\u2190 Retour": "\u2192 \u0631\u062c\u0648\u0639",
  "Dispensation enregistr\u00e9e": "\u062a\u0645 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u0635\u0631\u0641",
  "Enregistrer une dispensation": "\u062a\u0633\u062c\u064a\u0644 \u0639\u0645\u0644\u064a\u0629 \u0635\u0631\u0641",
  "Bordereau de dispensation": "\u0625\u0634\u0639\u0627\u0631 \u0627\u0644\u0635\u0631\u0641",
  "N\u00b0": "\u0631\u0642\u0645",
  "Destinataire": "\u0627\u0644\u0645\u0633\u062a\u0644\u0645",
  "Produit": "\u0627\u0644\u0645\u0646\u062a\u062c",
  "Quantit\u00e9": "\u0627\u0644\u0643\u0645\u064a\u0629",
  "Prix unitaire": "\u0633\u0639\u0631 \u0627\u0644\u0648\u062d\u062f\u0629",
  "Montant": "\u0627\u0644\u0645\u0628\u0644\u063a",
  "Total": "\u0627\u0644\u0645\u062c\u0645\u0648\u0639",
  "Dispens\u00e9 par :": "\u062a\u0645 \u0627\u0644\u0635\u0631\u0641 \u0628\u0648\u0627\u0633\u0637\u0629:",
  "Cachet et signature": "\u0627\u0644\u062e\u062a\u0645 \u0648\u0627\u0644\u062a\u0648\u0642\u064a\u0639",
  "Retour au tableau de bord": "\u0627\u0644\u0639\u0648\u062f\u0629 \u0625\u0644\u0649 \u0644\u0648\u062d\u0629 \u0627\u0644\u0642\u064a\u0627\u062f\u0629",
  "Voir le panier": "\u0639\u0631\u0636 \u0627\u0644\u0633\u0644\u0629",
  "Produits": "\u0627\u0644\u0645\u0646\u062a\u062c\u0627\u062a",
  "Rechercher un produit (ex. amox, para...)": "\u0627\u0628\u062d\u062b \u0639\u0646 \u0645\u0646\u062a\u062c (\u0645\u062b\u0627\u0644: amox\u060c para...)",
  "Toutes": "\u0627\u0644\u0643\u0644",
  "Chargement du catalogue...": "\u062c\u0627\u0631\u064d \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0642\u0627\u0626\u0645\u0629...",
  "Aucun produit trouv\u00e9.": "\u0644\u0645 \u064a\u062a\u0645 \u0627\u0644\u0639\u062b\u0648\u0631 \u0639\u0644\u0649 \u0623\u064a \u0645\u0646\u062a\u062c.",
  "Retour aux produits": "\u0627\u0644\u0639\u0648\u062f\u0629 \u0625\u0644\u0649 \u0627\u0644\u0645\u0646\u062a\u062c\u0627\u062a",
  "Panier": "\u0627\u0644\u0633\u0644\u0629",
  "Clique sur un produit pour l'ajouter.": "\u0627\u0636\u063a\u0637 \u0639\u0644\u0649 \u0645\u0646\u062a\u062c \u0644\u0625\u0636\u0627\u0641\u062a\u0647.",
  "Retirer ce produit": "\u0625\u0632\u0627\u0644\u0629 \u0647\u0630\u0627 \u0627\u0644\u0645\u0646\u062a\u062c",
  "Calcul\u2026": "\u062c\u0627\u0631\u064d \u0627\u0644\u062d\u0633\u0627\u0628\u2026",
  "Stock insuffisant pour au moins un produit du panier.": "\u0627\u0644\u0645\u062e\u0632\u0648\u0646 \u063a\u064a\u0631 \u0643\u0627\u0641\u064d \u0644\u0645\u0646\u062a\u062c \u0648\u0627\u062d\u062f \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644 \u0641\u064a \u0627\u0644\u0633\u0644\u0629.",
  "Destin\u00e9 \u00e0": "\u0645\u0648\u062c\u0651\u0647 \u0625\u0644\u0649",
  "Choisir": "\u0627\u062e\u062a\u0631",
  "Patient": "\u0645\u0631\u064a\u0636",
  "Laboratoire": "\u0645\u062e\u062a\u0628\u0631",
  "Maternit\u00e9": "\u0642\u0633\u0645 \u0627\u0644\u0648\u0644\u0627\u062f\u0629",
  "Autre service": "\u0642\u0633\u0645 \u0622\u062e\u0631",
  "Responsable labo": "\u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0645\u062e\u062a\u0628\u0631",
  "Responsable maternit\u00e9": "\u0645\u0633\u0624\u0648\u0644 \u0642\u0633\u0645 \u0627\u0644\u0648\u0644\u0627\u062f\u0629",
  "Service": "\u0627\u0644\u0642\u0633\u0645",
  "Nom, t\u00e9l\u00e9phone ou code patient": "\u0627\u0644\u0627\u0633\u0645 \u0623\u0648 \u0627\u0644\u0647\u0627\u062a\u0641 \u0623\u0648 \u0631\u0645\u0632 \u0627\u0644\u0645\u0631\u064a\u0636",
  "Nom du responsable labo": "\u0627\u0633\u0645 \u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0645\u062e\u062a\u0628\u0631",
  "Nom du/de la responsable": "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u0624\u0648\u0644",
  "Nom du service": "\u0627\u0633\u0645 \u0627\u0644\u0642\u0633\u0645",
  "Enregistrer la dispensation": "\u062a\u0633\u062c\u064a\u0644 \u0639\u0645\u0644\u064a\u0629 \u0627\u0644\u0635\u0631\u0641",
  "Envoi\u2026": "\u062c\u0627\u0631\u064d \u0627\u0644\u0625\u0631\u0633\u0627\u0644\u2026",
  "Rapport de dispensation": "\u062a\u0642\u0631\u064a\u0631 \u0627\u0644\u0635\u0631\u0641",
  "R\u00e9partition de tes dispensations par type de b\u00e9n\u00e9ficiaire, sur la p\u00e9riode de ton choix.": "\u062a\u0648\u0632\u064a\u0639 \u0639\u0645\u0644\u064a\u0627\u062a \u0627\u0644\u0635\u0631\u0641 \u062d\u0633\u0628 \u0646\u0648\u0639 \u0627\u0644\u0645\u0633\u062a\u0641\u064a\u062f\u060c \u062e\u0644\u0627\u0644 \u0627\u0644\u0641\u062a\u0631\u0629 \u0627\u0644\u062a\u064a \u062a\u062e\u062a\u0627\u0631\u0647\u0627.",
  "Du": "\u0645\u0646",
  "Au": "\u0625\u0644\u0649",
  "G\u00e9n\u00e9rer le rapport": "\u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u062a\u0642\u0631\u064a\u0631",
  "Formation sanitaire": "\u0645\u0646\u0634\u0623\u0629 \u0635\u062d\u064a\u0629",
  "du": "\u0645\u0646",
  "au": "\u0625\u0644\u0649",
  "tout l'historique": "\u0643\u0644 \u0627\u0644\u0633\u062c\u0644",
  "G\u00e9n\u00e9r\u00e9 le": "\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u0625\u0646\u0634\u0627\u0621:",
  "Aucune dispensation sur cette p\u00e9riode.": "\u0644\u0627 \u062a\u0648\u062c\u062f \u0639\u0645\u0644\u064a\u0627\u062a \u0635\u0631\u0641 \u0641\u064a \u0647\u0630\u0647 \u0627\u0644\u0641\u062a\u0631\u0629.",
  "Date": "\u0627\u0644\u062a\u0627\u0631\u064a\u062e",
  "Type": "\u0627\u0644\u0646\u0648\u0639",
  "B\u00e9n\u00e9ficiaire": "\u0627\u0644\u0645\u0633\u062a\u0641\u064a\u062f",
  "Action": "\u0625\u062c\u0631\u0627\u0621",
  "\u2190 Pr\u00e9c\u00e9dent": "\u2192 \u0627\u0644\u0633\u0627\u0628\u0642",
  "Suivant \u2192": "\u0627\u0644\u062a\u0627\u0644\u064a \u2190",
  "Page": "\u0635\u0641\u062d\u0629",
  "Demander l'annulation": "\u0637\u0644\u0628 \u0627\u0644\u0625\u0644\u063a\u0627\u0621",
  "quantit\u00e9": "\u0627\u0644\u0643\u0645\u064a\u0629",
  "Cette demande sera examin\u00e9e par le MCM ou le SASSM de votre Moughataa. Le stock ne sera remis qu'apr\u00e8s leur validation.": "\u0633\u064a\u0642\u0648\u0645 \u0637\u0628\u064a\u0628 \u0631\u0626\u064a\u0633 \u0627\u0644\u0645\u0642\u0627\u0637\u0639\u0629 (MCM) \u0623\u0648 \u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0645\u062e\u0632\u0648\u0646 (SASSM) \u0628\u0645\u0631\u0627\u062c\u0639\u0629 \u0647\u0630\u0627 \u0627\u0644\u0637\u0644\u0628. \u0644\u0646 \u064a\u064f\u0639\u0627\u062f \u0627\u0644\u0645\u062e\u0632\u0648\u0646 \u0625\u0644\u0627 \u0628\u0639\u062f \u0645\u0648\u0627\u0641\u0642\u062a\u0647\u0645\u0627.",
  "Motif de l'annulation (obligatoire)": "\u0633\u0628\u0628 \u0627\u0644\u0625\u0644\u063a\u0627\u0621 (\u0625\u0644\u0632\u0627\u0645\u064a)",
  "Fermer": "\u0625\u063a\u0644\u0627\u0642",
  "Envoyer la demande": "\u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0637\u0644\u0628",
  "stock": "\u0627\u0644\u0645\u062e\u0632\u0648\u0646",
  "insuffisant": "\u063a\u064a\u0631 \u0643\u0627\u0641\u064d",
  "Annulation demand\u00e9e": "\u062a\u0645 \u0637\u0644\u0628 \u0627\u0644\u0625\u0644\u063a\u0627\u0621",
  "Annulation refus\u00e9e": "\u062a\u0645 \u0631\u0641\u0636 \u0627\u0644\u0625\u0644\u063a\u0627\u0621",
  "Redemander": "\u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u0637\u0644\u0628",
  "MRU": "\u0623\u0648\u0642\u064a\u0629",
  "Impossible de charger le catalogue produits.": "\u062a\u0639\u0630\u0651\u0631 \u062a\u062d\u0645\u064a\u0644 \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0645\u0646\u062a\u062c\u0627\u062a.",
  "Impossible de charger le rapport de dispensation.": "\u062a\u0639\u0630\u0651\u0631 \u062a\u062d\u0645\u064a\u0644 \u062a\u0642\u0631\u064a\u0631 \u0627\u0644\u0635\u0631\u0641.",
  "Connexion instable, r\u00e9essayez.": "\u0627\u0644\u0627\u062a\u0635\u0627\u0644 \u063a\u064a\u0631 \u0645\u0633\u062a\u0642\u0631\u060c \u0623\u0639\u062f \u0627\u0644\u0645\u062d\u0627\u0648\u0644\u0629.",
  "La dispensation n'a pas pu \u00eatre enregistr\u00e9e.": "\u062a\u0639\u0630\u0651\u0631 \u062a\u0633\u062c\u064a\u0644 \u0639\u0645\u0644\u064a\u0629 \u0627\u0644\u0635\u0631\u0641.",
  "La demande n'a pas pu \u00eatre envoy\u00e9e.": "\u062a\u0639\u0630\u0651\u0631 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0637\u0644\u0628.",
  "Ajoute au moins un produit au panier.": "\u0623\u0636\u0641 \u0645\u0646\u062a\u062c\u064b\u0627 \u0648\u0627\u062d\u062f\u064b\u0627 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644 \u0625\u0644\u0649 \u0627\u0644\u0633\u0644\u0629.",
  "Chaque produit du panier doit avoir une quantit\u00e9 valide.": "\u064a\u062c\u0628 \u0623\u0646 \u062a\u0643\u0648\u0646 \u0644\u0643\u0644 \u0645\u0646\u062a\u062c \u0641\u064a \u0627\u0644\u0633\u0644\u0629 \u0643\u0645\u064a\u0629 \u0635\u062d\u064a\u062d\u0629.",
  "Pr\u00e9cise \u00e0 qui cette dispensation est destin\u00e9e.": "\u062d\u062f\u0651\u062f \u0644\u0645\u0646 \u062a\u064f\u0635\u0631\u0641 \u0647\u0630\u0647 \u0627\u0644\u0645\u0648\u0627\u062f.",
  "Pr\u00e9cise le nom, le t\u00e9l\u00e9phone ou le code du b\u00e9n\u00e9ficiaire.": "\u0623\u062f\u062e\u0644 \u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062a\u0641\u064a\u062f \u0623\u0648 \u0647\u0627\u062a\u0641\u0647 \u0623\u0648 \u0631\u0645\u0632\u0647.",
  "Le motif est obligatoire (5 caract\u00e8res minimum).": "\u0627\u0644\u0633\u0628\u0628 \u0625\u0644\u0632\u0627\u0645\u064a (5 \u0623\u062d\u0631\u0641 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644).",
  "Demande d'annulation envoy\u00e9e.": "\u062a\u0645 \u0625\u0631\u0633\u0627\u0644 \u0637\u0644\u0628 \u0627\u0644\u0625\u0644\u063a\u0627\u0621.",
};

const DICTIONNAIRES = { en: EN, ar: AR };

const LangueContext = createContext({
  langue: "fr",
  peutChoisir: false,
  changerLangue: () => {},
  t: (texte) => texte,
});

function langueEnregistree() {
  try {
    const valeur = localStorage.getItem(CLE_LANGUE);
    return LANGUES.includes(valeur) ? valeur : "fr";
  } catch {
    return "fr";
  }
}

export function LangueProvider({ role, children }) {
  const peutChoisir = role === "FORMATION_SANITAIRE";
  const [choix, setChoix] = useState(langueEnregistree);
  const langue = peutChoisir ? choix : "fr";

  useEffect(() => {
    document.documentElement.lang = langue;
    // La direction (droite vers gauche pour l'arabe) est appliquee par chaque ecran traduit.
  }, [langue]);

  const changerLangue = useCallback((nouvelle) => {
    if (!LANGUES.includes(nouvelle)) return;
    setChoix(nouvelle);
    try {
      localStorage.setItem(CLE_LANGUE, nouvelle);
    } catch {
      // Pas bloquant : la langue reste valable pour la session en cours.
    }
  }, []);

  const t = useCallback(
    (texte) => {
      if (langue === "fr") return texte;
      const dico = DICTIONNAIRES[langue];
      if (dico && Object.prototype.hasOwnProperty.call(dico, texte)) return dico[texte];
      return texte;
    },
    [langue]
  );

  const valeur = useMemo(
    () => ({ langue, dir: langue === "ar" ? "rtl" : "ltr", peutChoisir, changerLangue, t }),
    [langue, peutChoisir, changerLangue, t]
  );

  return <LangueContext.Provider value={valeur}>{children}</LangueContext.Provider>;
}

export function useLangue() {
  return useContext(LangueContext);
}

const BOUTONS = [
  { code: "fr", libelle: "FR" },
  { code: "ar", libelle: "\u0639\u0631\u0628\u064a" },
  { code: "en", libelle: "EN" },
];

export function SelecteurLangue() {
  const { langue, peutChoisir, changerLangue } = useLangue();
  if (!peutChoisir) return null;
  return (
    <div
      dir="ltr"
      style={{ display: "inline-flex", gap: 4, padding: 3, borderRadius: 999, background: "rgba(0,0,0,0.06)" }}
    >
      {BOUTONS.map((b) => (
        <button
          key={b.code}
          type="button"
          onClick={() => changerLangue(b.code)}
          aria-pressed={langue === b.code}
          style={{
            border: "none",
            cursor: "pointer",
            padding: "4px 12px",
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 600,
            background: langue === b.code ? "#0f766e" : "transparent",
            color: langue === b.code ? "#fff" : "inherit",
          }}
        >
          {b.libelle}
        </button>
      ))}
    </div>
  );
}