import { useEffect, useState } from "react";
import "./Rapports.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const COULEUR_STATUT_STOCK = {
  RUPTURE: "#b3492f",
  SOUS_SEUIL: "#c99a4b",
  NORMAL: "#2f7a4f",
  SURSTOCK: "#3f6b8f",
};

const LIBELLES_STATUT_REQ = {
  BROUILLON: "Brouillon",
  EN_ATTENTE: "En attente",
  MODIFIEE_EN_ATTENTE_CONFIRMATION: "Modifiée",
  REJETEE_POUR_CORRECTION: "Rejetée — à corriger",
  VALIDEE: "Validée",
  EXPEDIEE: "Expédiée",
  CLOTUREE: "Clôturée",
  REJETEE: "Rejetée",
  SCINDEE: "Scindée",
};

const ORDRE_COLONNES_KANBAN = [
  "EN_ATTENTE",
  "MODIFIEE_EN_ATTENTE_CONFIRMATION",
  "REJETEE_POUR_CORRECTION",
  "VALIDEE",
  "EXPEDIEE",
  "CLOTUREE",
  "SCINDEE",
  "REJETEE",
];

// ---------------------------------------------------------------------------
// Petits graphiques SVG faits main — pas de dépendance externe à installer.
// ---------------------------------------------------------------------------

function DiagrammeStocks({ stocks }) {
  if (stocks.length === 0) return <p className="rapports-vide">Aucun stock à afficher.</p>;

  const largeurBarre = 42;
  const espace = 18;
  const hauteurMax = 160;
  const max = Math.max(1, ...stocks.map((s) => s.quantiteTotale));
  const largeurTotale = stocks.length * (largeurBarre + espace) + espace;

  return (
    <div className="rapports-svg-scroll">
      <svg width={largeurTotale} height={hauteurMax + 70} className="rapports-svg">
        {stocks.map((s, i) => {
          const hauteur = Math.max(2, (s.quantiteTotale / max) * hauteurMax);
          const x = espace + i * (largeurBarre + espace);
          const y = hauteurMax - hauteur + 20;
          return (
            <g key={s.produitId || s.produit}>
              <rect
                x={x}
                y={y}
                width={largeurBarre}
                height={hauteur}
                fill={COULEUR_STATUT_STOCK[s.statut] || "#12302c"}
                rx="3"
              />
              <text x={x + largeurBarre / 2} y={y - 6} textAnchor="middle" fontSize="11" fill="#1c2b28">
                {s.quantiteTotale}
              </text>
              <text
                x={x + largeurBarre / 2}
                y={hauteurMax + 36}
                textAnchor="end"
                fontSize="10"
                fill="#6b7873"
                transform={`rotate(-40 ${x + largeurBarre / 2} ${hauteurMax + 36})`}
              >
                {s.produit.length > 16 ? s.produit.slice(0, 16) + "…" : s.produit}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function CourbeMouvements({ data }) {
  if (data.length === 0) return <p className="rapports-vide">Aucun mouvement sur les 30 derniers jours.</p>;

  const largeur = 640;
  const hauteur = 200;
  const marge = 30;
  const max = Math.max(1, ...data.map((d) => Math.max(d.entrees, d.sorties)));

  function pointsPour(cle) {
    return data
      .map((d, i) => {
        const x = marge + (i / Math.max(1, data.length - 1)) * (largeur - marge * 2);
        const y = hauteur - marge - (d[cle] / max) * (hauteur - marge * 2);
        return `${x},${y}`;
      })
      .join(" ");
  }

  return (
    <div>
      <svg width={largeur} height={hauteur} className="rapports-svg">
        <line x1={marge} y1={hauteur - marge} x2={largeur - marge} y2={hauteur - marge} stroke="#dedcd0" />
        <polyline points={pointsPour("entrees")} fill="none" stroke="#2f7a4f" strokeWidth="2" />
        <polyline points={pointsPour("sorties")} fill="none" stroke="#b3492f" strokeWidth="2" />
        <text x={marge} y={16} fontSize="11" fill="#6b7873">{data[0].date}</text>
        <text x={largeur - marge} y={16} fontSize="11" fill="#6b7873" textAnchor="end">
          {data[data.length - 1].date}
        </text>
      </svg>
      <div className="rapports-legende">
        <span><span className="rapports-legende-puce" style={{ background: "#2f7a4f" }}></span> Entrées</span>
        <span><span className="rapports-legende-puce" style={{ background: "#b3492f" }}></span> Sorties</span>
      </div>
    </div>
  );
}

export default function Rapports({ onRetour }) {
  const [onglet, setOnglet] = useState("apercu");

  const [kpis, setKpis] = useState(null);
  const [produitsRupture, setProduitsRupture] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [evolution, setEvolution] = useState([]);
  const [kanban, setKanban] = useState([]);

  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);

  async function charger() {
    setChargement(true);
    setErreur(null);
    try {
      const token = localStorage.getItem("gesmed_token");
      const entetes = { Authorization: `Bearer ${token}` };
      const [resKpis, resRupture, resStocks, resEvolution, resKanban] = await Promise.all([
        fetch(`${API_URL}/rapports/tableau-de-bord`, { headers: entetes }),
        fetch(`${API_URL}/rapports/produits-en-rupture`, { headers: entetes }),
        fetch(`${API_URL}/stocks`, { headers: entetes }),
        fetch(`${API_URL}/rapports/evolution-mouvements`, { headers: entetes }),
        fetch(`${API_URL}/rapports/requisitions-kanban`, { headers: entetes }),
      ]);
      if (!resKpis.ok) throw new Error("Impossible de charger le tableau de bord.");
      if (!resRupture.ok) throw new Error("Impossible de charger les produits en rupture.");
      setKpis(await resKpis.json());
      setProduitsRupture(await resRupture.json());
      if (resStocks.ok) setStocks(await resStocks.json());
      if (resEvolution.ok) setEvolution(await resEvolution.json());
      if (resKanban.ok) setKanban(await resKanban.json());
    } catch (err) {
      setErreur(err.message || "Connexion instable, réessayez.");
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    charger();
  }, []);

  function exporterCsv() {
    const lignes = [
      ["Produit", "Structures touchées"],
      ...produitsRupture.map((p) => [p.produit, p.structuresTouchees]),
    ];
    const contenu = lignes.map((ligne) => ligne.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([contenu], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const lien = document.createElement("a");
    lien.href = url;
    lien.download = `produits-en-rupture-${new Date().toISOString().slice(0, 10)}.csv`;
    lien.click();
    URL.revokeObjectURL(url);
  }

  const colonnesKanban = ORDRE_COLONNES_KANBAN.map((statut) => ({
    statut,
    items: kanban.filter((r) => r.statut === statut),
  })).filter((c) => c.items.length > 0 || ["EN_ATTENTE", "VALIDEE", "CLOTUREE"].includes(c.statut));

  return (
    <div className="rapports-page">
      <header className="rapports-header">
        <button className="rapports-retour" onClick={onRetour}>← Retour</button>
        <h1>Rapports</h1>
      </header>

      {erreur && <p className="rapports-erreur" role="alert">{erreur}</p>}

      <div className="rapports-onglets">
        <button className={onglet === "apercu" ? "rapports-onglet-actif" : "rapports-onglet"} onClick={() => setOnglet("apercu")}>
          Vue d'ensemble
        </button>
        <button className={onglet === "graphiques" ? "rapports-onglet-actif" : "rapports-onglet"} onClick={() => setOnglet("graphiques")}>
          Graphiques
        </button>
        <button className={onglet === "kanban" ? "rapports-onglet-actif" : "rapports-onglet"} onClick={() => setOnglet("kanban")}>
          Kanban
        </button>
      </div>

      {chargement ? (
        <p>Chargement...</p>
      ) : onglet === "apercu" ? (
        <>
          <div className="rapports-grid">
            <div className="rapports-carte">
              <span className="rapports-carte-valeur">{kpis.referencesEnStock}</span>
              <span className="rapports-carte-titre">Références en stock</span>
            </div>
            <div className="rapports-carte rapports-carte-rouge">
              <span className="rapports-carte-valeur">{kpis.ruptures}</span>
              <span className="rapports-carte-titre">En rupture</span>
            </div>
            <div className="rapports-carte rapports-carte-dore">
              <span className="rapports-carte-valeur">{kpis.sousSeuil}</span>
              <span className="rapports-carte-titre">Sous le seuil</span>
            </div>
            <div className="rapports-carte rapports-carte-dore">
              <span className="rapports-carte-valeur">{kpis.lotsBientotPerimes}</span>
              <span className="rapports-carte-titre">Lots périmant sous 3 mois</span>
            </div>
            <button
              className="rapports-carte rapports-carte--cliquable"
              onClick={() => setOnglet("kanban")}
            >
              <span className="rapports-carte-valeur">{kpis.requisitionsEnAttente}</span>
              <span className="rapports-carte-titre">Réquisitions en attente</span>
            </button>
            {kpis.ecartsEnAttente !== undefined && (
              <div className="rapports-carte">
                <span className="rapports-carte-valeur">{kpis.ecartsEnAttente}</span>
                <span className="rapports-carte-titre">Écarts en attente (national)</span>
              </div>
            )}
          </div>

          <div className="rapports-section-entete">
            <h2>Produits les plus souvent en rupture</h2>
            {produitsRupture.length > 0 && (
              <button className="rapports-bouton-export" onClick={exporterCsv}>
                Exporter en CSV
              </button>
            )}
          </div>

          {produitsRupture.length === 0 ? (
            <p className="rapports-vide">Aucun produit en rupture pour l'instant — bonne nouvelle.</p>
          ) : (
            <table className="rapports-table">
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Structures touchées</th>
                </tr>
              </thead>
              <tbody>
                {produitsRupture.map((p) => (
                  <tr key={p.produit}>
                    <td>{p.produit}</td>
                    <td>{p.structuresTouchees}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      ) : onglet === "graphiques" ? (
        <>
          <h2 className="rapports-sous-section">Stock par produit</h2>
          <DiagrammeStocks stocks={stocks} />

          <h2 className="rapports-sous-section">Mouvements des 30 derniers jours</h2>
          <CourbeMouvements data={evolution} />
        </>
      ) : (
        <div className="rapports-kanban">
          {colonnesKanban.map((col) => (
            <div className="rapports-kanban-colonne" key={col.statut}>
              <div className="rapports-kanban-entete">
                {LIBELLES_STATUT_REQ[col.statut] || col.statut}
                <span className="rapports-kanban-compte">{col.items.length}</span>
              </div>
              <div className="rapports-kanban-cartes">
                {col.items.map((r) => (
                  <div className="rapports-kanban-carte" key={r.id}>
                    <strong>{r.demandeur}</strong>
                    <span>
                      {r.premierProduit}
                      {r.nbLignes > 1 ? ` +${r.nbLignes - 1}` : ""}
                    </span>
                    <span className="rapports-kanban-date">
                      {new Date(r.dateDerniereMaj).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                ))}
                {col.items.length === 0 && <p className="rapports-kanban-vide">—</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}