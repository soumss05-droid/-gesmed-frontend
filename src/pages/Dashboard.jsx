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
  MEDECIN_CHEF_MOUGHATAA: "Médecin Chef de Moughataa",
  FORMATION_SANITAIRE: "Agent formation sanitaire",
  AUDITEUR: "Auditeur",
};

const ROLES_AVEC_STOCK = ["GESTIONNAIRE_CAMEC", "GESTIONNAIRE_DRS", "GAS_MOUGHATAA", "FORMATION_SANITAIRE"];

const SECTIONS_PAR_ROLE = {
  ADMIN: [
    { titre: "Établissements actifs", valeur: "—", description: "Tous niveaux confondus" },
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
  MEDECIN_CHEF_MOUGHATAA: [
    { titre: "Vue de la Moughataa", valeur: "—", description: "Consultation, sans validation" },
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

// ---------------------------------------------------------------------------
// Petites icônes SVG monochromes, sans dépendance externe.
// ---------------------------------------------------------------------------
const tracesIcones = {
  plus: "M12 5v14M5 12h14",
  liste: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  boite: "M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8",
  camion: "M3 7h11v8H3zM14 10h4l3 3v2h-7zM6 19a2 2 0 100-4 2 2 0 000 4zM17 19a2 2 0 100-4 2 2 0 000 4z",
  cloche: "M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0",
  graphique: "M3 3v18h18M7 15l4-4 3 3 5-6",
  reglage: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.6 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z",
  document: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM14 2v6h6M9 13h6M9 17h6",
  personnes: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75",
  chariot: "M9 22a1 1 0 100-2 1 1 0 000 2zM20 22a1 1 0 100-2 1 1 0 000 2zM1 1h4l2.7 13.4a2 2 0 002 1.6h9.7a2 2 0 002-1.6L23 6H6",
  balance: "M12 3v18M5 7l-3 7a3 3 0 006 0zM19 7l-3 7a3 3 0 006 0zM5 7h14M12 3l-4 4h8z",
};

function Icone({ nom }) {
  const trace = tracesIcones[nom];
  if (!trace) return null;
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={trace} />
    </svg>
  );
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
  onNotifications,
  onSuiviRequisitions,
  onAdmin,
  onRapports,
  onEcarts,
}) {
  const { utilisateur } = session;
  const libelleRole = LIBELLES_ROLE[utilisateur.role] || utilisateur.role;
  const [sections, setSections] = useState(SECTIONS_PAR_ROLE[utilisateur.role] || []);
  const [chargement, setChargement] = useState(
    ROLES_AVEC_STOCK.includes(utilisateur.role) ||
      utilisateur.role === "ADMIN" ||
      utilisateur.role === "GAS_PROGRAMME_NATIONAL"
  );

  useEffect(() => {
    const token = localStorage.getItem("gesmed_token");

    async function chargerStocks() {
      try {
        const res = await fetch(`${API_URL}/stocks`, { headers: { Authorization: `Bearer ${token}` } });
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
        if (utilisateur.role === "GESTIONNAIRE_CAMEC") {
          try {
            const resAValider = await fetch(`${API_URL}/requisitions/a-valider`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (resAValider.ok) base[1].valeur = String((await resAValider.json()).length);
          } catch {
            // Reste à "—" si l'appel échoue — pas bloquant pour le reste de l'écran.
          }
        }
        setSections(base);
      } catch (erreur) {
        console.error(erreur);
      } finally {
        setChargement(false);
      }
    }

    async function chargerKpisAdmin() {
      try {
        const [resKpis, resEtabs] = await Promise.all([
          fetch(`${API_URL}/rapports/tableau-de-bord`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/admin/etablissements`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        const base = SECTIONS_PAR_ROLE.ADMIN.map((s) => ({ ...s }));
        if (resEtabs.ok) {
          const etabs = await resEtabs.json();
          base[0].valeur = String(etabs.filter((e) => e.actif).length);
        }
        if (resKpis.ok) {
          const kpis = await resKpis.json();
          base[1].valeur = String(kpis.ruptures);
          base[2].valeur = String(kpis.requisitionsEnAttente);
        }
        setSections(base);
      } catch (erreur) {
        console.error(erreur);
      } finally {
        setChargement(false);
      }
    }

    async function chargerKpisGasProgramme() {
      try {
        const [resAValider, resReseau, resEcartsBl, resEcartsInv] = await Promise.all([
          fetch(`${API_URL}/requisitions/a-valider`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/stocks/reseau`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/ecarts/en-attente`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/inventaires/ecarts-en-attente`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        const base = SECTIONS_PAR_ROLE.GAS_PROGRAMME_NATIONAL.map((s) => ({ ...s }));
        if (resAValider.ok) base[0].valeur = String((await resAValider.json()).length);
        if (resReseau.ok) base[1].valeur = String((await resReseau.json()).length);
        if (resEcartsBl.ok && resEcartsInv.ok) {
          const totalEcarts = (await resEcartsBl.json()).length + (await resEcartsInv.json()).length;
          base[2].valeur = String(totalEcarts);
        }
        setSections(base);
      } catch (erreur) {
        console.error(erreur);
      } finally {
        setChargement(false);
      }
    }

    if (ROLES_AVEC_STOCK.includes(utilisateur.role)) chargerStocks();
    else if (utilisateur.role === "ADMIN") chargerKpisAdmin();
    else if (utilisateur.role === "GAS_PROGRAMME_NATIONAL") chargerKpisGasProgramme();
    else setChargement(false);
  }, [utilisateur.role]);

  const peutSuivreRequisitions = ["FORMATION_SANITAIRE", "GAS_MOUGHATAA", "GESTIONNAIRE_DRS"].includes(utilisateur.role);

  // -------------------------------------------------------------------------
  // Cible de navigation pour chaque carte (même ordre que SECTIONS_PAR_ROLE),
  // quand un écran existant correspond clairement à cette carte. `null`
  // laisse la carte non cliquable plutôt que de pointer vers un écran qui ne
  // correspond pas vraiment à l'information affichée.
  // -------------------------------------------------------------------------
  const ciblesCartes = {
    ADMIN: [onAdmin, onRapports, onRapports],
    GESTIONNAIRE_CAMEC: [onStockReseau, onValidationRequisitions, null],
    GAS_PROGRAMME_NATIONAL: [onValidationRequisitions, onStockReseau, onEcarts],
    GESTIONNAIRE_DRS: [onStockReseau, onValidationRequisitions, onStockReseau],
    DIRECTEUR_DRS: [onStockReseau],
    MEDECIN_CHEF_MOUGHATAA: [onStockReseau],
    GAS_MOUGHATAA: [onStockReseau, onValidationRequisitions, onReception],
    FORMATION_SANITAIRE: [onInventairePhysique, onInventairePhysique, onInventairePhysique],
    AUDITEUR: [onRapports, onEcarts],
  };
  const ciblesRole = ciblesCartes[utilisateur.role] || [];

  // -------------------------------------------------------------------------
  // Actions regroupées par catégorie — chaque bouton ne s'affiche que si son
  // rôle y a accès, exactement comme avant, mais organisées visuellement.
  // -------------------------------------------------------------------------
  const categories = [
    {
      titre: "Réquisitions",
      actions: [
        { roles: ["FORMATION_SANITAIRE"], icone: "plus", libelle: "Nouvelle réquisition", onClick: onNouvelleRequisition },
        { roles: ["GAS_MOUGHATAA", "GESTIONNAIRE_DRS", "GAS_PROGRAMME_NATIONAL"], icone: "liste", libelle: "Réquisitions à valider", onClick: onValidationRequisitions },
        { roles: ["GESTIONNAIRE_CAMEC"], icone: "liste", libelle: "Réquisitions à livrer", onClick: onValidationRequisitions },
        { roles: ["GAS_MOUGHATAA", "GESTIONNAIRE_DRS"], icone: "chariot", libelle: "Commander un réapprovisionnement", onClick: onReapprovisionnement },
        { roles: peutSuivreRequisitions ? [utilisateur.role] : [], icone: "document", libelle: "Suivi de mes réquisitions", onClick: onSuiviRequisitions },
      ],
    },
    {
      titre: "Stock",
      actions: [
        { roles: ["GESTIONNAIRE_CAMEC", "GAS_PROGRAMME_NATIONAL", "GESTIONNAIRE_DRS", "GAS_MOUGHATAA", "DIRECTEUR_DRS", "MEDECIN_CHEF_MOUGHATAA"], icone: "boite", libelle: "Stock du réseau", onClick: onStockReseau },
        { roles: ["GESTIONNAIRE_CAMEC", "ADMIN"], icone: "camion", libelle: "Rentrée des produits", onClick: onRentreeCamec },
        { roles: ["GESTIONNAIRE_CAMEC", "GESTIONNAIRE_DRS", "GAS_MOUGHATAA", "FORMATION_SANITAIRE"], icone: "liste", libelle: "Inventaire physique", onClick: onInventairePhysique },
        { roles: ["FORMATION_SANITAIRE"], icone: "boite", libelle: "Enregistrer une dispensation", onClick: onDispensation },
        { roles: ["FORMATION_SANITAIRE", "GAS_MOUGHATAA", "GESTIONNAIRE_DRS", "GAS_PROGRAMME_NATIONAL"], icone: "camion", libelle: "Bordereaux à confirmer", onClick: onReception },
        { roles: ["GAS_PROGRAMME_NATIONAL", "AUDITEUR"], icone: "balance", libelle: "Écarts en attente", onClick: onEcarts },
      ],
    },
    {
      titre: "Compte",
      actions: [
        { roles: utilisateur.role !== "ADMIN" ? [utilisateur.role] : [], icone: "cloche", libelle: "Notifications", onClick: onNotifications },
        { roles: ["ADMIN"], icone: "reglage", libelle: "Administration", onClick: onAdmin },
        { roles: [utilisateur.role], icone: "graphique", libelle: "Rapports", onClick: onRapports },
      ],
    },
  ];

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
          <button className="dashboard-header__logout" onClick={onLogout}>Déconnexion</button>
        </div>
      </header>

      <main className="dashboard-main">
        <h1>Tableau de bord</h1>
        <p className="dashboard-main__subtitle">Vue adaptée à ton rôle : {libelleRole}.</p>

        {chargement ? (
          <p className="dashboard-main__vide">Chargement des données...</p>
        ) : (
          <div className="dashboard-grid">
            {sections.map((section, index) => {
              const cible = ciblesRole[index];
              const Composant = cible ? "button" : "div";
              return (
                <Composant
                  className={`dashboard-card${cible ? " dashboard-card--cliquable" : ""}`}
                  key={section.titre}
                  onClick={cible || undefined}
                >
                  <span className="dashboard-card__valeur">{section.valeur}</span>
                  <span className="dashboard-card__titre">{section.titre}</span>
                  <span className="dashboard-card__description">{section.description}</span>
                </Composant>
              );
            })}
          </div>
        )}

        {categories.map((cat) => {
          const actionsVisibles = cat.actions.filter((a) => a.roles.includes(utilisateur.role));
          if (actionsVisibles.length === 0) return null;
          return (
            <section className="dashboard-categorie" key={cat.titre}>
              <h2 className="dashboard-categorie__titre">{cat.titre}</h2>
              <div className="dashboard-categorie__actions">
                {actionsVisibles.map((a) => (
                  <button key={a.libelle} className="dashboard-bouton-action" onClick={a.onClick}>
                    <Icone nom={a.icone} />
                    {a.libelle}
                  </button>
                ))}
              </div>
            </section>
          );
        })}

        {!chargement && sections.length === 0 && (
          <p className="dashboard-main__vide">Aucun contenu défini pour ce rôle pour l'instant.</p>
        )}
      </main>
    </div>
  );
}