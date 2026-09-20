import { useEffect, useRef, useState } from "react";
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
// Convertit un élément <svg> en image PNG téléchargeable — entièrement côté
// navigateur, sans dépendance externe (SVG → Blob → Image → Canvas → PNG).
// ---------------------------------------------------------------------------
function telechargerSvgEnPng(svgElement, nomFichier) {
  if (!svgElement) return;
  const serializer = new XMLSerializer();
  let source = serializer.serializeToString(svgElement);
  if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
    source = source.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  const svgBlob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();
  img.onload = () => {
    const largeur = svgElement.width.baseVal.value || svgElement.getBoundingClientRect().width;
    const hauteur = svgElement.height.baseVal.value || svgElement.getBoundingClientRect().height;
    const echelle = 2; // Image plus nette au téléchargement.
    const canvas = document.createElement("canvas");
    canvas.width = largeur * echelle;
    canvas.height = hauteur * echelle;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(echelle, echelle);
    ctx.drawImage(img, 0, 0, largeur, hauteur);
    URL.revokeObjectURL(url);
    canvas.toBlob((blob) => {
      const lienUrl = URL.createObjectURL(blob);
      const lien = document.createElement("a");
      lien.href = lienUrl;
      lien.download = nomFichier;
      lien.click();
      URL.revokeObjectURL(lienUrl);
    }, "image/png");
  };
  img.src = url;
}

function DiagrammeStocks({ stocks, svgRef }) {
  if (stocks.length === 0) return <p className="rapports-vide">Aucun stock à afficher.</p>;

  const largeurBarre = 42;
  const espace = 18;
  const hauteurMax = 160;
  const max = Math.max(1, ...stocks.map((s) => s.quantiteTotale));
  const largeurTotale = stocks.length * (largeurBarre + espace) + espace;

  return (
    <div className="rapports-svg-scroll">
      <svg ref={svgRef} width={largeurTotale} height={hauteurMax + 70} className="rapports-svg">
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

function CourbeMouvements({ data, svgRef }) {
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
      <svg ref={svgRef} width={largeur} height={hauteur} className="rapports-svg">
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

// ---------------------------------------------------------------------------
// Graphique générique pour le croisement (DRS, Moughataa ou formation
// sanitaire, toute zone confondue) — un simple diagramme en barres, réutilisé
// quel que soit le regroupement choisi.
// ---------------------------------------------------------------------------
function GraphiqueCroisement({ lignes, svgRef }) {
  if (lignes.length === 0) return <p className="rapports-vide">Aucune donnée pour ce produit.</p>;

  const largeurBarre = 42;
  const espace = 18;
  const hauteurMax = 160;
  const max = Math.max(1, ...lignes.map((l) => l.quantite));
  const largeurTotale = lignes.length * (largeurBarre + espace) + espace;

  return (
    <div className="rapports-svg-scroll">
      <svg ref={svgRef} width={largeurTotale} height={hauteurMax + 70} className="rapports-svg">
        {lignes.map((l, i) => {
          const hauteur = Math.max(2, (l.quantite / max) * hauteurMax);
          const x = espace + i * (largeurBarre + espace);
          const y = hauteurMax - hauteur + 20;
          return (
            <g key={l.nom}>
              <rect x={x} y={y} width={largeurBarre} height={hauteur} fill="#12302c" rx="3" />
              <text x={x + largeurBarre / 2} y={y - 6} textAnchor="middle" fontSize="11" fill="#1c2b28">
                {l.quantite}
              </text>
              <text
                x={x + largeurBarre / 2}
                y={hauteurMax + 36}
                textAnchor="end"
                fontSize="10"
                fill="#6b7873"
                transform={`rotate(-40 ${x + largeurBarre / 2} ${hauteurMax + 36})`}
              >
                {l.nom.length > 16 ? l.nom.slice(0, 16) + "…" : l.nom}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function Rapports({ session, onRetour }) {
  const [onglet, setOnglet] = useState("apercu");
  const estAdmin = session?.utilisateur?.role === "ADMIN";

  const refCourbe = useRef(null);
  const refCroisement = useRef(null);
  const refDiagrammePropre = useRef(null);

  const [produitsListe, setProduitsListe] = useState([]);
  const [produitCroise, setProduitCroise] = useState("");

  const peutCroiserRegion = ["GESTIONNAIRE_DRS", "DIRECTEUR_DRS"].includes(session?.utilisateur?.role);
  const peutCroiserMoughataa = ["GAS_MOUGHATAA", "MEDECIN_CHEF_MOUGHATAA"].includes(session?.utilisateur?.role);
  const peutCroiserProgramme = session?.utilisateur?.role === "GAS_PROGRAMME_NATIONAL";
  const peutCroiser = estAdmin || peutCroiserRegion || peutCroiserMoughataa || peutCroiserProgramme;

  const regroupementsDisponibles = estAdmin
    ? [
        { valeur: "drs", libelle: "Par DRS" },
        { valeur: "moughataa", libelle: "Par Moughataa" },
        { valeur: "formationsanitaire", libelle: "Par formation sanitaire" },
      ]
    : peutCroiserProgramme
    ? [
        { valeur: "drs", libelle: "Par DRS" },
        { valeur: "moughataa", libelle: "Par Moughataa" },
      ]
    : peutCroiserRegion
    ? [
        { valeur: "moughataa", libelle: "Par Moughataa" },
        { valeur: "formationsanitaire", libelle: "Par formation sanitaire" },
      ]
    : [{ valeur: "formationsanitaire", libelle: "Par formation sanitaire" }];

  const [regroupementNiveau, setRegroupementNiveau] = useState(regroupementsDisponibles[0]?.valeur || "moughataa");
  const [croisementNiveau, setCroisementNiveau] = useState(null);
  const [chargementCroisement, setChargementCroisement] = useState(false);

  const peutVoirPerformance = estAdmin || peutCroiserRegion;
  const [produitPerformance, setProduitPerformance] = useState("");
  const [performance, setPerformance] = useState(null);
  const [chargementPerformance, setChargementPerformance] = useState(false);

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

      if (peutCroiser) {
        const resProduits = await fetch(`${API_URL}/produits`, { headers: entetes });
        if (resProduits.ok) setProduitsListe(await resProduits.json());
      }
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

  // ---------------------------------------------------------------------------
  // Export Excel : un tableau HTML enregistré avec le type MIME Excel — Excel
  // l'ouvre nativement comme un vrai classeur, sans aucune bibliothèque à
  // installer.
  // ---------------------------------------------------------------------------
  function exporterExcel() {
    const ligneKpi = (label, valeur) => `<tr><td>${label}</td><td>${valeur}</td></tr>`;
    const contenuHtml = `
      <html>
        <head><meta charset="utf-8" /></head>
        <body>
          <h2>Rapport GesMed — ${new Date().toLocaleDateString("fr-FR")}</h2>
          <table border="1">
            <tr><th colspan="2">Indicateurs</th></tr>
            ${ligneKpi("Références en stock", kpis.referencesEnStock)}
            ${ligneKpi("En rupture", kpis.ruptures)}
            ${ligneKpi("Sous le seuil", kpis.sousSeuil)}
            ${ligneKpi("Lots périmant sous 3 mois", kpis.lotsBientotPerimes)}
            ${ligneKpi("Réquisitions en attente", kpis.requisitionsEnAttente)}
          </table>
          <br />
          <table border="1">
            <tr><th>Produit</th><th>Structures touchées</th></tr>
            ${produitsRupture.map((p) => `<tr><td>${p.produit}</td><td>${p.structuresTouchees}</td></tr>`).join("")}
          </table>
        </body>
      </html>
    `;
    const blob = new Blob([contenuHtml], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const lien = document.createElement("a");
    lien.href = url;
    lien.download = `rapport-gesmed-${new Date().toISOString().slice(0, 10)}.xls`;
    lien.click();
    URL.revokeObjectURL(url);
  }

  // ---------------------------------------------------------------------------
  // Export PDF : ouvre une vue imprimable dans un nouvel onglet et déclenche
  // l'impression — l'utilisateur choisit "Enregistrer au format PDF" dans la
  // boîte de dialogue native du navigateur. Aucune bibliothèque nécessaire.
  // ---------------------------------------------------------------------------
  function exporterPdf() {
    const fenetre = window.open("", "_blank");
    const ligneKpi = (label, valeur) => `<tr><td>${label}</td><td>${valeur}</td></tr>`;
    fenetre.document.write(`
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Rapport GesMed</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #1c2b28; }
            h1 { font-size: 1.3rem; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; font-size: 0.9rem; }
            th { background: #f0f0f0; }
          </style>
        </head>
        <body>
          <h1>Rapport GesMed — ${new Date().toLocaleDateString("fr-FR")}</h1>
          <table>
            <tr><th colspan="2">Indicateurs</th></tr>
            ${ligneKpi("Références en stock", kpis.referencesEnStock)}
            ${ligneKpi("En rupture", kpis.ruptures)}
            ${ligneKpi("Sous le seuil", kpis.sousSeuil)}
            ${ligneKpi("Lots périmant sous 3 mois", kpis.lotsBientotPerimes)}
            ${ligneKpi("Réquisitions en attente", kpis.requisitionsEnAttente)}
          </table>
          <table>
            <tr><th>Produit</th><th>Structures touchées</th></tr>
            ${produitsRupture.map((p) => `<tr><td>${p.produit}</td><td>${p.structuresTouchees}</td></tr>`).join("")}
          </table>
        </body>
      </html>
    `);
    fenetre.document.close();
    fenetre.focus();
    setTimeout(() => fenetre.print(), 300);
  }

  // ---------------------------------------------------------------------------
  // Croisement : pour un produit choisi, calcule le total et la répartition
  // via le backend, selon le regroupement disponible pour le rôle connecté.
  // ---------------------------------------------------------------------------
  async function chargerCroisementNiveau(produitId, regroupement) {
    if (!produitId) {
      setCroisementNiveau(null);
      return;
    }
    setChargementCroisement(true);
    try {
      const token = localStorage.getItem("gesmed_token");
      const res = await fetch(
        `${API_URL}/stocks/croisement?produitId=${produitId}&regroupement=${regroupement}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) setCroisementNiveau(await res.json());
    } catch {
      // Reste à l'état précédent si l'appel échoue.
    } finally {
      setChargementCroisement(false);
    }
  }

  useEffect(() => {
    if (peutCroiser && produitCroise) {
      chargerCroisementNiveau(produitCroise, regroupementNiveau);
    }
  }, [produitCroise, regroupementNiveau]);

  // ---------------------------------------------------------------------------
  // Performance : compare le DMM de chaque Moughataa à la somme des CMM de
  // ses formations sanitaires — un écart persistant signale un problème de
  // distribution ou de dimensionnement.
  // ---------------------------------------------------------------------------
  async function chargerPerformance(produitId) {
    if (!produitId) {
      setPerformance(null);
      return;
    }
    setChargementPerformance(true);
    try {
      const token = localStorage.getItem("gesmed_token");
      const res = await fetch(`${API_URL}/stocks/performance-moughataa?produitId=${produitId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setPerformance(await res.json());
    } catch {
      // Reste à l'état précédent si l'appel échoue.
    } finally {
      setChargementPerformance(false);
    }
  }

  useEffect(() => {
    if (peutVoirPerformance && produitPerformance) {
      chargerPerformance(produitPerformance);
    }
  }, [produitPerformance]);

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
        {peutVoirPerformance && (
          <button className={onglet === "performance" ? "rapports-onglet-actif" : "rapports-onglet"} onClick={() => setOnglet("performance")}>
            Performance
          </button>
        )}
      </div>

      {chargement ? (
        <p>Chargement...</p>
      ) : !kpis ? (
        <p className="rapports-erreur" role="alert">
          Impossible de charger les données du rapport pour l'instant. Réessaie dans quelques secondes.
        </p>
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
            <div className="rapports-boutons-export">
              <button className="rapports-bouton-export" onClick={exporterCsv}>CSV</button>
              <button className="rapports-bouton-export" onClick={exporterExcel}>Excel</button>
              <button className="rapports-bouton-export" onClick={exporterPdf}>PDF</button>
            </div>
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
          <div className="rapports-section-entete">
            <h2 className="rapports-sous-section">Stock par produit</h2>
            {peutCroiser && croisementNiveau && (
              <button
                className="rapports-bouton-export"
                onClick={() => telechargerSvgEnPng(refCroisement.current, "stock-par-produit.png")}
              >
                Télécharger en image
              </button>
            )}
          </div>

          {peutCroiser ? (
            <>
              <div className="rapports-filtres-croisement">
                <select value={produitCroise} onChange={(e) => setProduitCroise(e.target.value)}>
                  <option value="">Choisir un produit…</option>
                  {produitsListe.map((p) => (
                    <option key={p.id} value={p.id}>{p.nom}</option>
                  ))}
                </select>
                {regroupementsDisponibles.length > 1 && (
                  <select value={regroupementNiveau} onChange={(e) => setRegroupementNiveau(e.target.value)}>
                    {regroupementsDisponibles.map((r) => (
                      <option key={r.valeur} value={r.valeur}>{r.libelle}</option>
                    ))}
                  </select>
                )}
              </div>

              {!produitCroise ? (
                <p className="rapports-vide">Choisis un produit pour voir sa répartition — toute zone confondue.</p>
              ) : chargementCroisement ? (
                <p>Chargement...</p>
              ) : !croisementNiveau ? (
                <p className="rapports-vide">Aucune donnée pour ce produit.</p>
              ) : (
                <>
                  <p className="rapports-total-croisement">
                    Stock total : <strong>{croisementNiveau.total}</strong>
                  </p>
                  <GraphiqueCroisement lignes={croisementNiveau.lignes} svgRef={refCroisement} />
                  <table className="rapports-table">
                    <thead>
                      <tr>
                        <th>
                          {croisementNiveau.regroupement === "drs"
                            ? "DRS"
                            : croisementNiveau.regroupement === "moughataa"
                            ? "Moughataa"
                            : "Établissement"}
                        </th>
                        <th>Quantité</th>
                      </tr>
                    </thead>
                    <tbody>
                      {croisementNiveau.lignes.map((l) => (
                        <tr key={l.nom}>
                          <td>{l.nom}</td>
                          <td>{l.quantite}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </>
          ) : (
            <DiagrammeStocks stocks={stocks} svgRef={refDiagrammePropre} />
          )}

          <div className="rapports-section-entete">
            <h2 className="rapports-sous-section">Mouvements des 30 derniers jours</h2>
            <button
              className="rapports-bouton-export"
              onClick={() => telechargerSvgEnPng(refCourbe.current, "mouvements-30-jours.png")}
            >
              Télécharger en image
            </button>
          </div>
          <CourbeMouvements data={evolution} svgRef={refCourbe} />
        </>
      ) : onglet === "performance" ? (
        <>
          <p className="rapports-sous-titre-info">
            Compare ce que chaque Moughataa a distribué (son DMM) à ce que ses formations sanitaires ont
            réellement consommé (somme de leurs CMM). Un grand écart signale un problème de distribution.
          </p>
          <div className="rapports-filtres-croisement">
            <select value={produitPerformance} onChange={(e) => setProduitPerformance(e.target.value)}>
              <option value="">Choisir un produit…</option>
              {produitsListe.map((p) => (
                <option key={p.id} value={p.id}>{p.nom}</option>
              ))}
            </select>
          </div>

          {!produitPerformance ? (
            <p className="rapports-vide">Choisis un produit pour comparer les Moughataa.</p>
          ) : chargementPerformance ? (
            <p>Chargement...</p>
          ) : !performance || performance.length === 0 ? (
            <p className="rapports-vide">Aucune donnée pour ce produit.</p>
          ) : (
            <table className="rapports-table">
              <thead>
                <tr>
                  <th>Moughataa</th>
                  <th>DMM (distribué)</th>
                  <th>Σ CMM des FS (consommé)</th>
                  <th>Écart</th>
                </tr>
              </thead>
              <tbody>
                {performance.map((p) => (
                  <tr key={p.nom}>
                    <td>{p.nom}</td>
                    <td>{p.dmm}</td>
                    <td>{p.sommeCmmFs}</td>
                    <td className={p.ecart < 0 ? "rapports-ecart-negatif" : "rapports-ecart-positif"}>
                      {p.ecart > 0 ? `+${p.ecart}` : p.ecart}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
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