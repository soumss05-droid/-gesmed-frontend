import { useEffect, useState } from "react";
import "./Dashboard.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const LIBELLES_ROLE = {
  ADMIN: "Administrateur",
  GESTIONNAIRE_CAMEC: "Gestionnaire CAMEC",
  GAS_PROGRAMME_NATIONAL: "Agent GAS Programme national",
  GESTIONNAIRE_DRS: "Gestionnaire DRS",
  DIRECTEUR_DRS: "Directeur DRS",
  GAS_MOUGHATAA: "Agent GAS Moughataa",
  FORMATION_SANITAIRE: "Agent formation sanitaire",
  AUDITEUR: "Auditeur",
};

const ROLES_AVEC_STOCK = ["GESTIONNAIRE_CAMEC", "GESTIONNAIRE_DRS", "GAS_MOUGHATAA", "FORMATION_SANITAIRE"];

const SECTIONS_PAR_ROLE = {
  ADMIN: [
    { titre: "Établissements", valeur: "—", description: "Vue globale sur tous les niveaux" },
    { titre: "Alertes de rupture", valeur: "—", description: "Tous établissements confondus" },
    { titre: "Réquisitions en cours", valeur: "—", description: "Tous circuits confondus" },
  ],
  GESTIONNAIRE_CAMEC: [
    { titre: "Produits suivis", valeur: "—", description: "Niveau de stock central actuel" },
    { titre: "Réquisitions validées à livrer", valeur: "—", description: "En attente d'expédition" },
    { titre: "BL envoyés", valeur: "—", description: "En attente de confirmation de réception" },
  ],
  GAS_PROGRAMME_NATIONAL: [
    { titre: "Réquisitions à valider", valeur: "—", description: "En attente de ton niveau" },
    { titre: "GAS DRS coordonnés", valeur: "—", description: "Établissements sous ta supervision" },
    { titre: "Écarts signalés", valeur: "—", description: "En attente de décision" },
  ],
  GESTIONNAIRE_DRS: [
    { titre: "Produits suivis", valeur: "—", description: "Niveau de stock actuel" },
    { titre: "Réquisitions à traiter", valeur: "—", description: "GAS Moughataa rattachés" },
    { titre: "Alertes seuils", valeur: "—", description: "Ruptures et surstocks" },
  ],
  DIRECTEUR_DRS: [
    { titre: "Vue régionale", valeur: "—", description: "Consultation, sans validation" },
  ],
  GAS_MOUGHATAA: [
    { titre: "Produits suivis", valeur: "—", description: "Niveau de stock actuel" },
    { titre: "Réquisitions à valider", valeur: "—", description: "Formations sanitaires rattachées" },
    { titre: "Bordereaux à confirmer", valeur: "—", description: "Réceptions en attente" },
  ],
  FORMATION_SANITAIRE: [
    { titre: "Produits suivis", valeur: "—", description: "Par produit et par lot" },
    { titre: "Alertes de rupture", valeur: "—", description: "Ruptures et sous-seuils" },
    { titre: "Prochaine péremption", valeur: "—", description: "Méthode FEFO" },
  ],
  AUDITEUR: [
    { titre: "Vue globale", valeur: "—", description: "Tous établissements et circuits" },
    { titre: "Écarts en attente", valeur: "—", description: "Déblocages possibles" },
  ],
};

function calculerValeursStock(stocks) {
  const nombreProduits = stocks.length;
  const nombreAlertes = stocks.filter((s) => s.statut === "RUPTURE" || s.statut === "SOUS_SEUIL").length;

  let prochaineLotLabel = "Aucun lot";
  let prochaineDate = null;
  for (const stock of stocks) {
    for (const lot of stock.lots) {
      const date = new Date(lot.datePeremption);
      if (!prochaineDate || date < prochaineDate) {
        prochaineDate = date;
        prochaineLotLabel = stock.produit;
      }
    }
  }

  let prochaineValeur = "—";
  if (prochaineDate) {
    const jours = Math.ceil((prochaineDate - new Date()) / (1000 * 60 * 60 * 24));
    prochaineValeur = jours >= 0 ? `${jours} j` : "Expiré";
  }

  return { nombreProduits, nombreAlertes, prochaineLotLabel, prochaineValeur };
}

export default function Dashboard({
  session,
  onLogout,
  onNouvelleRequisition,
  onValidationRequisitions,
  onStockReseau,
  onDispensation,
  onReception,
  onRentreeCamec,
  onInventairePhysique,
  onReapprovisionnement,
}) {
  const { utilisateur } = session;
  const libelleRole = LIBELLES_ROLE[utilisateur.role] || utilisateur.role;
  const [sections, setSections] = useState(SECTIONS_PAR_ROLE[utilisateur.role] || []);
  const [chargement, setChargement] = useState(ROLES_AVEC_STOCK.includes(utilisateur.role));

  useEffect(() => {
    if (!ROLES_AVEC_STOCK.includes(utilisateur.role)) return;

    async function chargerStocks() {
      try {
        const token = localStorage.getItem("gesmed_token");
        const res = await fetch(`${API_URL}/stocks`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Impossible de charger les stocks.");
        const stocks = await res.json();

        const { nombreProduits, nombreAlertes, prochaineLotLabel, prochaineValeur } = calculerValeursStock(stocks);
        const base = SECTIONS_PAR_ROLE[utilisateur.role].map((s) => ({ ...s }));

        base[0].valeur = String(nombreProduits);

        if (utilisateur.role === "FORMATION_SANITAIRE") {
          base[1].valeur = String(nombreAlertes);
          base[2].valeur = prochaineValeur;
          base[2].description = prochaineLotLabel !== "Aucun lot" ? prochaineLotLabel : base[2].description;
        }
        if (utilisateur.role === "GESTIONNAIRE_DRS") {
          base[2].valeur = String(nombreAlertes);
        }

        setSections(base);
      } catch (erreur) {
        console.error(erreur);
      } finally {
        setChargement(false);
      }
    }

    chargerStocks();
  }, [utilisateur.role]);

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <span className="dashboard-header__brand">GesMed</span>

        <div className="dashboard-header__user">
          <div className="dashboard-header__identity">
            <span className="dashboard-header__nom">{utilisateur.nomComplet}</span>
            <span className="dashboard-header__role">
              {utilisateur.etablissement ? `${libelleRole} — ${utilisateur.etablissement}` : libelleRole}
            </span>
          </div>
          <button className="dashboard-header__logout" onClick={onLogout}>
            Déconnexion
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        <h1>Tableau de bord</h1>
        <p className="dashboard-main__subtitle">
          Vue adaptée à ton rôle : {libelleRole}.
        </p>

        {chargement && <p className="dashboard-main__vide">Chargement des données...</p>}

        {!chargement && (
          <div className="dashboard-grid">
            {sections.map((section) => (
              <div className="dashboard-card" key={section.titre}>
                <span className="dashboard-card__valeur">{section.valeur}</span>
                <span className="dashboard-card__titre">{section.titre}</span>
                <span className="dashboard-card__description">{section.description}</span>
              </div>
            ))}
          </div>
        )}

        {utilisateur.role === "FORMATION_SANITAIRE" && (
          <button className="dashboard-bouton-action" onClick={onNouvelleRequisition}>
            + Nouvelle réquisition
          </button>
        )}

        {["GAS_MOUGHATAA", "GESTIONNAIRE_DRS", "GAS_PROGRAMME_NATIONAL", "GESTIONNAIRE_CAMEC"].includes(utilisateur.role) && (
          <button className="dashboard-bouton-action" onClick={onValidationRequisitions}>
            Voir les réquisitions à valider
          </button>
        )}
        {["GESTIONNAIRE_CAMEC", "GAS_PROGRAMME_NATIONAL", "GESTIONNAIRE_DRS", "GAS_MOUGHATAA"].includes(utilisateur.role) && (
          <button className="dashboard-bouton-action" onClick={onStockReseau}>
            Voir le stock du réseau
          </button>
        )}

        {["GESTIONNAIRE_CAMEC", "ADMIN"].includes(utilisateur.role) && (
          <button className="dashboard-bouton-action" onClick={onRentreeCamec}>
            Rentrée des produits
          </button>
        )}

        {["GESTIONNAIRE_CAMEC", "GESTIONNAIRE_DRS", "GAS_MOUGHATAA", "FORMATION_SANITAIRE"].includes(utilisateur.role) && (
          <button className="dashboard-bouton-action" onClick={onInventairePhysique}>
            Inventaire physique
          </button>
        )}

        {["GAS_MOUGHATAA", "GESTIONNAIRE_DRS"].includes(utilisateur.role) && (
          <button className="dashboard-bouton-action" onClick={onReapprovisionnement}>
            Commander un réapprovisionnement
          </button>
        )}

        {utilisateur.role === "FORMATION_SANITAIRE" && (
          <button className="dashboard-bouton-action" onClick={onDispensation}>
            Enregistrer une dispensation
          </button>
        )}

        {["FORMATION_SANITAIRE", "GAS_MOUGHATAA", "GESTIONNAIRE_DRS", "GAS_PROGRAMME_NATIONAL"].includes(utilisateur.role) && (
          <button className="dashboard-bouton-action" onClick={onReception}>
            Bordereaux à confirmer
          </button>
        )}

        {!chargement && sections.length === 0 && (
          <p className="dashboard-main__vide">
            Aucun contenu défini pour ce rôle pour l'instant.
          </p>
        )}
      </main>
    </div>
  );
}