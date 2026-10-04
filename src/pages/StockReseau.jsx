// StockReseau.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";
import "./StockReseau.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const LIBELLE_STATUT = {
  RUPTURE: "Rupture",
  SOUS_SEUIL: "Sous seuil",
  NORMAL: "Normal",
  SURSTOCK: "Surstock",
};

const LIBELLE_NIVEAU = {
  CAMEC: "CAMEC",
  GAS_DRS: "Dépôt DRS",
  GAS_MOUGHATAA: "Moughataa",
  FORMATION_SANITAIRE: "Formation sanitaire",
  GAS_PROGRAMME_NATIONAL: "GAS Programme national",
};

// Décode la partie "payload" d'un JWT sans vérifier sa signature — utilisé
// uniquement pour de l'affichage côté client (savoir si une ligne appartient
// à mon propre établissement) ; la vraie vérification d'autorisation est de
// toute façon refaite côté serveur à chaque appel.
function decoderToken(token) {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

// Construit une explication courte du statut, à partir des seuils min/max
// (calculés côté serveur à partir de la CMM/DMM de l'établissement) et de la
// quantité actuelle. Retourne null quand on ne dispose pas des seuils (ex. :
// ligne agrégée au niveau région, où le statut lui-même est déjà absent).
function raisonStatut(s) {
  if (s.seuilMin == null || s.seuilMax == null) return null;
  switch (s.statut) {
    case "RUPTURE":
      return "Stock épuisé (0 unité)";
    case "SOUS_SEUIL":
      return `${s.quantiteTotale} unité(s) — sous le seuil minimum de ${s.seuilMin}`;
    case "SURSTOCK":
      return `${s.quantiteTotale} unité(s) — au-dessus du seuil maximum de ${s.seuilMax}`;
    case "NORMAL":
      return `${s.quantiteTotale} unité(s) — entre les seuils ${s.seuilMin} et ${s.seuilMax}`;
    default:
      return null;
  }
}

// Construit le contenu HTML (corps + feuille de style) du rapport "Stock du
// réseau", à partir des DONNÉES (pas du DOM) : c'est ce qui permet d'inclure
// les établissements même quand leur carte est repliée à l'écran. Réutilisé
// par l'impression, l'export Word et l'export PDF (capture d'un conteneur
// hors écran construit à partir de ce même contenu).
function genererContenuStockReseau({ donneesFiltrees, resume, filtres }) {
  const ligneStock = (s) => {
    const raison = raisonStatut(s);
    const statutAffiche = LIBELLE_STATUT[s.statut] || s.statut || "—";
    return `<tr><td>${s.produit}</td><td>${s.numeroLot || "—"}</td><td>${
      s.datePeremption ? new Date(s.datePeremption).toLocaleDateString("fr-FR") : "—"
    }</td><td>${s.quantiteTotale}</td><td>${statutAffiche}${raison ? ` (${raison})` : ""}</td></tr>`;
  };
  const lignePerime = (l) =>
    `<tr><td>${l.produit}</td><td>${l.numeroLot}</td><td>${new Date(l.datePeremption).toLocaleDateString("fr-FR")}</td><td>${l.quantite}</td></tr>`;

  const blocEtablissement = (etab) => `
    <h2>${etab.etablissementNom}</h2>
    ${
      etab.stocks.length > 0
        ? `<table>
            <thead><tr><th>Produit</th><th>N° de lot</th><th>Péremption</th><th>Stock théorique</th><th>Statut</th></tr></thead>
            <tbody>${etab.stocks.map(ligneStock).join("")}</tbody>
          </table>`
        : `<p class="reseau-impression-vide">Aucun produit suivi à ce niveau.</p>`
    }
    ${
      etab.lotsPerimes && etab.lotsPerimes.length > 0
        ? `<h3>Lots périmés</h3>
           <table>
             <thead><tr><th>Produit</th><th>N° de lot</th><th>Périmé le</th><th>Quantité périmée</th></tr></thead>
             <tbody>${etab.lotsPerimes.map(lignePerime).join("")}</tbody>
           </table>`
        : ""
    }
  `;

  const filtresActifs = [
    filtres.niveau && `Niveau : ${LIBELLE_NIVEAU[filtres.niveau] || filtres.niveau}`,
    filtres.recherche && `Recherche : "${filtres.recherche}"`,
    filtres.seulementRuptures && "Alertes seulement (rupture / sous seuil)",
  ]
    .filter(Boolean)
    .join(" — ");

  const corps = `
    <h1>Stock du réseau — SYGIMS</h1>
    <p class="reseau-impression-meta">
      Généré le ${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR")}
    </p>
    ${filtresActifs ? `<p class="reseau-impression-meta">Filtres actifs : ${filtresActifs}</p>` : ""}
    <p class="reseau-impression-resume">
      ${resume.totalEtablissements} établissement(s) — ${resume.totalRuptures} en rupture —
      ${resume.totalSousSeuil} sous le seuil — ${resume.totalPerimes} lot(s) périmé(s)
    </p>
    ${donneesFiltrees.map(blocEtablissement).join("")}
  `;

  const style = `
    body { font-family: Arial, sans-serif; padding: 24px; color: #1c2b28; }
    h1 { font-size: 1.3rem; margin-bottom: 2px; }
    h2 { font-size: 1.05rem; margin-top: 24px; margin-bottom: 4px; border-bottom: 1px solid #e4e2d6; padding-bottom: 4px; }
    h3 { font-size: 0.95rem; margin-top: 12px; margin-bottom: 4px; }
    .reseau-impression-meta { color: #6b7873; font-size: 0.85rem; margin-bottom: 4px; }
    .reseau-impression-resume { font-size: 0.9rem; margin: 12px 0 20px; }
    .reseau-impression-vide { color: #6b7873; font-size: 0.85rem; font-style: italic; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th, td { border: 1px solid #ccc; padding: 5px 8px; text-align: left; font-size: 0.85rem; }
    th { background: #f0f0f0; }
  `;

  return { corps, style };
}

function imprimerStockReseau({ donneesFiltrees, resume, filtres }) {
  const { corps, style } = genererContenuStockReseau({ donneesFiltrees, resume, filtres });
  const fenetre = window.open("", "_blank");
  fenetre.document.write(`
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Stock du réseau — SYGIMS</title>
        <style>${style}</style>
      </head>
      <body>${corps}</body>
    </html>
  `);
  fenetre.document.close();
  fenetre.focus();
  setTimeout(() => fenetre.print(), 300);
}

function exporterStockReseauWord({ donneesFiltrees, resume, filtres }) {
  const { corps, style } = genererContenuStockReseau({ donneesFiltrees, resume, filtres });
  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="utf-8"><title>Stock du réseau</title><style>${style}</style></head>
    <body>${corps}</body>
    </html>`;

  const blob = new Blob(["\ufeff", html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = "stock-reseau.doc";
  document.body.appendChild(lien);
  lien.click();
  document.body.removeChild(lien);
  URL.revokeObjectURL(url);
}

async function exporterStockReseauPdf({ donneesFiltrees, resume, filtres }) {
  const { corps, style } = genererContenuStockReseau({ donneesFiltrees, resume, filtres });

  const conteneur = document.createElement("div");
  conteneur.style.position = "fixed";
  conteneur.style.top = "-99999px";
  conteneur.style.left = "0";
  conteneur.style.width = "800px";
  conteneur.innerHTML = `<style>${style}</style>${corps}`;
  document.body.appendChild(conteneur);

  try {
    const canvas = await html2canvas(conteneur, { scale: 2 });
    const image = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const largeurPage = pdf.internal.pageSize.getWidth();
    const hauteurImage = (canvas.height * largeurPage) / canvas.width;
    pdf.addImage(image, "PNG", 0, 0, largeurPage, hauteurImage);
    pdf.save("stock-reseau.pdf");
  } finally {
    document.body.removeChild(conteneur);
  }
}

function exporterStockReseauExcel({ donneesFiltrees }) {
  const lignesStock = [];
  const lignesPerimes = [];

  for (const etab of donneesFiltrees) {
    for (const s of etab.stocks) {
      lignesStock.push({
        Établissement: etab.etablissementNom,
        Produit: s.produit,
        "N° de lot": s.numeroLot || "—",
        Péremption: s.datePeremption ? new Date(s.datePeremption).toLocaleDateString("fr-FR") : "—",
        "Stock théorique": s.quantiteTotale,
        Statut: LIBELLE_STATUT[s.statut] || s.statut || "—",
      });
    }
    for (const l of etab.lotsPerimes || []) {
      lignesPerimes.push({
        Établissement: etab.etablissementNom,
        Produit: l.produit,
        "N° de lot": l.numeroLot,
        "Périmé le": new Date(l.datePeremption).toLocaleDateString("fr-FR"),
        "Quantité périmée": l.quantite,
      });
    }
  }

  if (lignesStock.length === 0 && lignesPerimes.length === 0) {
    alert("Aucune donnée à exporter pour les filtres actuels.");
    return;
  }

  const classeur = XLSX.utils.book_new();
  if (lignesStock.length > 0) {
    XLSX.utils.book_append_sheet(classeur, XLSX.utils.json_to_sheet(lignesStock), "Stock");
  }
  if (lignesPerimes.length > 0) {
    XLSX.utils.book_append_sheet(classeur, XLSX.utils.json_to_sheet(lignesPerimes), "Lots périmés");
  }
  XLSX.writeFile(classeur, "stock-reseau.xlsx");
}

export default function StockReseau({ onRetour }) {
  const [donnees, setDonnees] = useState([]);
  const [cmm, setCmm] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [recherche, setRecherche] = useState("");
  const [seulementRuptures, setSeulementRuptures] = useState(false);
  const [etablissementsOuverts, setEtablissementsOuverts] = useState({});
  const [filtreNiveau, setFiltreNiveau] = useState("");
  const [menuExportOuvert, setMenuExportOuvert] = useState(false);
  const menuExportRef = useRef(null);

  // Établissement de l'utilisateur connecté, déduit du token — sert à savoir
  // sur quelles lignes de lots périmés afficher le bouton de demande de
  // destruction (seul le gestionnaire du lot concerné peut la demander).
  const [monEtablissementId, setMonEtablissementId] = useState(null);

  // Produits de MON établissement en rupture/surstock qui attendent encore
  // une justification pour l'épisode en cours (voir /stocks/justifications-requises).
  const [produitsAJustifier, setProduitsAJustifier] = useState([]);
  const [texteJustifications, setTexteJustifications] = useState({});
  const [envoiEnCours, setEnvoiEnCours] = useState({});
  const [erreurJustification, setErreurJustification] = useState(null);

  // État de verrouillage de MON établissement (voir /verrouillage/mon-etat) —
  // purement informatif : explique à l'avance pourquoi /stocks/entree
  // refuserait une saisie, plutôt que de laisser l'utilisateur le découvrir
  // seulement après une tentative échouée.
  const [verrouillageEtat, setVerrouillageEtat] = useState(null);

  // Demandes de destruction de lots périmés.
  const [quantitesDestruction, setQuantitesDestruction] = useState({});
  const [motifsDestruction, setMotifsDestruction] = useState({});
  const [envoiDestructionEnCours, setEnvoiDestructionEnCours] = useState({});
  const [lotsDestructionDemandee, setLotsDestructionDemandee] = useState({});
  const [erreurDestruction, setErreurDestruction] = useState(null);
  const [messageDestruction, setMessageDestruction] = useState(null);

  useEffect(() => {
    function fermerSiExterieur(e) {
      if (menuExportRef.current && !menuExportRef.current.contains(e.target)) {
        setMenuExportOuvert(false);
      }
    }
    document.addEventListener("mousedown", fermerSiExterieur);
    return () => document.removeEventListener("mousedown", fermerSiExterieur);
  }, []);

  async function chargerJustificationsRequises() {
    try {
      const token = localStorage.getItem("SYGIMS_token");
      const res = await fetch(`${API_URL}/stocks/justifications-requises`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setProduitsAJustifier(await res.json());
    } catch {
      // Non bloquant pour le reste de l'écran si cet appel échoue.
    }
  }

  async function chargerVerrouillage() {
    try {
      const token = localStorage.getItem("SYGIMS_token");
      const res = await fetch(`${API_URL}/verrouillage/mon-etat`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setVerrouillageEtat(await res.json());
    } catch {
      // Non bloquant : l'absence d'info de verrouillage n'empêche pas de
      // consulter le reste de l'écran, et le serveur refuserait de toute
      // façon une saisie si l'établissement est réellement verrouillé.
    }
  }

  useEffect(() => {
    async function charger() {
      try {
        const token = localStorage.getItem("SYGIMS_token");
        if (token) {
          const payload = decoderToken(token);
          setMonEtablissementId(payload?.etablissementId || null);
        }
        const [resReseau, resCmm] = await Promise.all([
          fetch(`${API_URL}/stocks/reseau`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/stocks/cmm`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        const dataReseau = await resReseau.json();
        if (!resReseau.ok) throw new Error(dataReseau.erreur || "Impossible de charger le stock du réseau.");
        setDonnees(dataReseau);
        const ouverts = {};
        for (const e of dataReseau) ouverts[e.etablissementId] = true;
        setEtablissementsOuverts(ouverts);

        if (resCmm.ok) setCmm(await resCmm.json());
      } catch (err) {
        setErreur(err.message || "Connexion instable, réessayez.");
      } finally {
        setChargement(false);
      }
    }
    charger();
    chargerJustificationsRequises();
    chargerVerrouillage();
  }, []);

  async function soumettreJustification(produitId) {
    const texte = (texteJustifications[produitId] || "").trim();
    if (!texte) {
      setErreurJustification("Merci de décrire la raison avant d'enregistrer.");
      return;
    }
    setErreurJustification(null);
    setEnvoiEnCours((e) => ({ ...e, [produitId]: true }));
    try {
      const token = localStorage.getItem("SYGIMS_token");
      const res = await fetch(`${API_URL}/stocks/justification`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ produitId, texte }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erreur || "Impossible d'enregistrer la justification.");
      setTexteJustifications((t) => ({ ...t, [produitId]: "" }));
      await chargerJustificationsRequises();
    } catch (err) {
      setErreurJustification(err.message || "Connexion instable, réessayez.");
    } finally {
      setEnvoiEnCours((e) => ({ ...e, [produitId]: false }));
    }
  }

  async function demanderDestruction(lot) {
    const saisie = quantitesDestruction[lot.id];
    const quantite = saisie !== undefined && saisie !== "" ? Number(saisie) : lot.quantite;

    if (!quantite || quantite <= 0 || quantite > lot.quantite) {
      setErreurDestruction(`Quantité invalide pour ${lot.produit} (maximum ${lot.quantite}).`);
      return;
    }

    setErreurDestruction(null);
    setMessageDestruction(null);
    setEnvoiDestructionEnCours((e) => ({ ...e, [lot.id]: true }));
    try {
      const token = localStorage.getItem("SYGIMS_token");
      const res = await fetch(`${API_URL}/stocks/lots/${lot.id}/destruction`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          quantiteDemandee: quantite,
          motifDemande: motifsDestruction[lot.id]?.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erreur || "Impossible d'envoyer la demande de destruction.");
      setLotsDestructionDemandee((d) => ({ ...d, [lot.id]: true }));
      setMessageDestruction(`Demande de destruction envoyée pour ${lot.produit} (lot ${lot.numeroLot}).`);
    } catch (err) {
      setErreurDestruction(err.message || "Connexion instable, réessayez.");
    } finally {
      setEnvoiDestructionEnCours((e) => ({ ...e, [lot.id]: false }));
    }
  }

  function basculerEtablissement(id) {
    setEtablissementsOuverts((o) => ({ ...o, [id]: !o[id] }));
  }

  const niveauxDisponibles = useMemo(() => {
    const types = new Set(donnees.map((e) => e.type).filter(Boolean));
    return Array.from(types);
  }, [donnees]);

  const resume = useMemo(() => {
    let totalRuptures = 0;
    let totalSousSeuil = 0;
    let totalPerimes = 0;
    for (const etab of donnees) {
      totalRuptures += etab.stocks.filter((s) => s.statut === "RUPTURE").length;
      totalSousSeuil += etab.stocks.filter((s) => s.statut === "SOUS_SEUIL").length;
      totalPerimes += etab.lotsPerimes?.length || 0;
    }
    return { totalRuptures, totalSousSeuil, totalPerimes, totalEtablissements: donnees.length };
  }, [donnees]);

  const donneesFiltrees = useMemo(() => {
    const rechercheMin = recherche.trim().toLowerCase();
    return donnees
      .filter((etab) => !filtreNiveau || etab.type === filtreNiveau)
      .map((etab) => ({
        ...etab,
        stocks: etab.stocks.filter((s) => {
          const correspondNom = !rechercheMin || s.produit.toLowerCase().includes(rechercheMin);
          const correspondStatut = !seulementRuptures || s.statut === "RUPTURE" || s.statut === "SOUS_SEUIL";
          return correspondNom && correspondStatut;
        }),
      }))
      .filter((etab) => etab.stocks.length > 0 || (!rechercheMin && !seulementRuptures));
  }, [donnees, recherche, seulementRuptures, filtreNiveau]);

  const filtresActuels = {
    niveau: filtreNiveau,
    recherche,
    seulementRuptures,
  };

  function gererExport(format) {
    setMenuExportOuvert(false);
    if (format === "excel") exporterStockReseauExcel({ donneesFiltrees });
    if (format === "pdf") exporterStockReseauPdf({ donneesFiltrees, resume, filtres: filtresActuels });
    if (format === "word") exporterStockReseauWord({ donneesFiltrees, resume, filtres: filtresActuels });
  }

  return (
    <div className="reseau-page">
      <header className="reseau-header">
        <button className="reseau-retour" onClick={onRetour}>← Retour</button>
        <h1>Stock du réseau</h1>
      </header>

      {erreur && <p className="reseau-erreur" role="alert">{erreur}</p>}

      {verrouillageEtat?.verrouille && (
        <div className="reseau-verrouillage-bandeau" role="alert">
          <h2>🔒 Saisie manuelle verrouillée</h2>
          <p>
            {verrouillageEtat.verrouTotal
              ? "La saisie manuelle de stock (rentrée directe) est verrouillée pour ton établissement."
              : "La saisie manuelle de stock est verrouillée pour ton établissement, pour un ou plusieurs programmes."}
            {" "}Les entrées passent désormais par le circuit officiel réquisition / bordereau de livraison.
          </p>
          <ul className="reseau-verrouillage-liste">
            {verrouillageEtat.verrous.map((v) => (
              <li key={v.id}>
                {v.programme ? `Programme ${v.programme.nom}` : "Verrou total"} — posé par{" "}
                {v.posePar?.nomComplet || "—"} le {new Date(v.dateVerrouillage).toLocaleDateString("fr-FR")}
              </li>
            ))}
          </ul>
          <p className="reseau-verrouillage-note">Seul un administrateur peut lever ce verrou.</p>
        </div>
      )}

      {produitsAJustifier.length > 0 && (
        <div className="reseau-justification-bandeau" role="alert">
          <h2>⚠ Justification obligatoire</h2>
          <p>
            {produitsAJustifier.length} produit(s) de ton établissement sont en rupture ou en surstock et attendent
            une explication avant de pouvoir continuer normalement.
          </p>
          {erreurJustification && <p className="reseau-erreur">{erreurJustification}</p>}
          {produitsAJustifier.map((p) => (
            <div className="reseau-justification-ligne" key={p.produitId}>
              <div className="reseau-justification-entete">
                <span className="reseau-justification-produit">{p.produit}</span>
                <span className={`reseau-badge-statut reseau-badge-statut--${p.statut.toLowerCase()}`}>
                  {LIBELLE_STATUT[p.statut] || p.statut}
                </span>
                <span className="reseau-justification-quantite">{p.quantiteTotale} unité(s)</span>
              </div>
              <textarea
                className="reseau-justification-texte"
                rows={2}
                placeholder="Explique la raison (ex : retard de livraison, pic de consommation, erreur de saisie...)"
                value={texteJustifications[p.produitId] || ""}
                onChange={(e) =>
                  setTexteJustifications((t) => ({ ...t, [p.produitId]: e.target.value }))
                }
              />
              <button
                className="reseau-bouton-export"
                disabled={envoiEnCours[p.produitId]}
                onClick={() => soumettreJustification(p.produitId)}
              >
                {envoiEnCours[p.produitId] ? "Enregistrement..." : "Enregistrer la justification"}
              </button>
            </div>
          ))}
        </div>
      )}

      {chargement ? (
        <p>Chargement...</p>
      ) : (
        <>
          <div className="reseau-section-entete">
            <div className="reseau-resume">
              <div className="reseau-resume-carte">
                <span className="reseau-resume-valeur">{resume.totalEtablissements}</span>
                <span className="reseau-resume-titre">Établissements</span>
              </div>
              <div className="reseau-resume-carte reseau-resume-carte--rouge">
                <span className="reseau-resume-valeur">{resume.totalRuptures}</span>
                <span className="reseau-resume-titre">En rupture</span>
              </div>
              <div className="reseau-resume-carte reseau-resume-carte--dore">
                <span className="reseau-resume-valeur">{resume.totalSousSeuil}</span>
                <span className="reseau-resume-titre">Sous le seuil</span>
              </div>
              <div className="reseau-resume-carte reseau-resume-carte--dore">
                <span className="reseau-resume-valeur">{resume.totalPerimes}</span>
                <span className="reseau-resume-titre">Lots périmés</span>
              </div>
            </div>

            <div className="reseau-export-actions">
              <div className="reseau-export-conteneur" ref={menuExportRef}>
                <button type="button" className="reseau-bouton-export" onClick={() => setMenuExportOuvert((o) => !o)}>
                  📤 Exporter ▾
                </button>
                {menuExportOuvert && (
                  <div className="reseau-export-menu">
                    <button type="button" onClick={() => gererExport("excel")}>Excel (.xlsx)</button>
                    <button type="button" onClick={() => gererExport("pdf")}>PDF</button>
                    <button type="button" onClick={() => gererExport("word")}>Word (.doc)</button>
                  </div>
                )}
              </div>
              <button
                type="button"
                className="reseau-bouton-export"
                onClick={() => imprimerStockReseau({ donneesFiltrees, resume, filtres: filtresActuels })}
              >
                🖨 Imprimer
              </button>
            </div>
          </div>

          <div className="reseau-filtres">
            <input
              type="text"
              className="reseau-recherche"
              placeholder="Rechercher un produit..."
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
            />
            <label className="reseau-case">
              <input
                type="checkbox"
                checked={seulementRuptures}
                onChange={(e) => setSeulementRuptures(e.target.checked)}
              />
              Alertes seulement (rupture / sous seuil)
            </label>
          </div>

          {niveauxDisponibles.length > 1 && (
            <div className="reseau-filtres reseau-filtres-cascade">
              <select value={filtreNiveau} onChange={(e) => setFiltreNiveau(e.target.value)}>
                <option value="">Tous les niveaux</option>
                {niveauxDisponibles.map((t) => (
                  <option key={t} value={t}>{LIBELLE_NIVEAU[t] || t}</option>
                ))}
              </select>
            </div>
          )}

          {cmm.length > 0 && (
            <details className="reseau-carte reseau-cmm">
              <summary>CMM — période glissante (consommation réelle du réseau)</summary>
              <table className="reseau-table">
                <thead>
                  <tr>
                    <th>Produit</th>
                    <th>CMM (unités/mois)</th>
                  </tr>
                </thead>
                <tbody>
                  {cmm.map((c) => (
                    <tr key={c.produit}>
                      <td className="reseau-nom-produit">{c.produit}</td>
                      <td>{c.cmm}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}

          {donneesFiltrees.length === 0 ? (
            <p className="reseau-vide">Aucun résultat pour cette recherche.</p>
          ) : (
            donneesFiltrees.map((etab) => {
              const ouvert = etablissementsOuverts[etab.etablissementId];
              const nbAlertes = etab.stocks.filter((s) => s.statut === "RUPTURE" || s.statut === "SOUS_SEUIL").length;
              const estMonEtablissement = etab.etablissementId === monEtablissementId;
              return (
                <div className="reseau-carte" key={etab.etablissementId}>
                  <button className="reseau-carte-entete" onClick={() => basculerEtablissement(etab.etablissementId)}>
                    <span className="reseau-carte-titre">
                      {etab.etablissementNom}
                      {nbAlertes > 0 && <span className="reseau-badge-alerte">{nbAlertes}</span>}
                    </span>
                    <span className={`reseau-chevron ${ouvert ? "reseau-chevron--ouvert" : ""}`}>▾</span>
                  </button>

                  {ouvert && (
                    <>
                      {etab.stocks.length === 0 ? (
                        <p className="reseau-vide">Aucun produit suivi à ce niveau.</p>
                      ) : (
                        <table className="reseau-table">
                          <thead>
                            <tr>
                              <th>Produit</th>
                              <th title="Prochain lot à sortir (FEFO) : celui qui périme le plus tôt">N° de lot</th>
                              <th title="Date de péremption du prochain lot à sortir (FEFO)">Péremption</th>
                              <th>Stock théorique</th>
                              <th>Statut</th>
                            </tr>
                          </thead>
                          <tbody>
                            {etab.stocks.map((s) => (
                              <tr key={s.produitId}>
                                <td className="reseau-nom-produit" title={s.produit}>{s.produit}</td>
                                <td>{s.numeroLot || "—"}</td>
                                <td>{s.datePeremption ? new Date(s.datePeremption).toLocaleDateString("fr-FR") : "—"}</td>
                                <td>{s.quantiteTotale}</td>
                                <td>
                                  {s.statut ? (
                                    <span
                                      className={`reseau-badge-statut reseau-badge-statut--${s.statut.toLowerCase()}`}
                                      title={
                                        [raisonStatut(s), s.derniereJustification ? `Justification : ${s.derniereJustification.texte}` : null]
                                          .filter(Boolean)
                                          .join(" — ") || undefined
                                      }
                                    >
                                      {LIBELLE_STATUT[s.statut] || s.statut}
                                      {s.justificationRequise && " ⚠"}
                                    </span>
                                  ) : (
                                    <span className="reseau-badge-statut">—</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}

                      {etab.lotsPerimes && etab.lotsPerimes.length > 0 && (
                        <div className="reseau-perimes">
                          <h3>⚠ Lots périmés</h3>
                          {estMonEtablissement && messageDestruction && (
                            <p className="reseau-perimes-message">{messageDestruction}</p>
                          )}
                          {estMonEtablissement && erreurDestruction && (
                            <p className="reseau-erreur">{erreurDestruction}</p>
                          )}
                          <table className="reseau-table">
                            <thead>
                              <tr>
                                <th>Produit</th>
                                <th>N° de lot</th>
                                <th>Périmé le</th>
                                <th>Quantité périmée</th>
                                {estMonEtablissement && <th>Destruction</th>}
                              </tr>
                            </thead>
                            <tbody>
                              {etab.lotsPerimes.map((l) => (
                                <tr key={l.id || `${l.numeroLot}_${l.produit}`}>
                                  <td className="reseau-nom-produit" title={l.produit}>{l.produit}</td>
                                  <td>{l.numeroLot}</td>
                                  <td>{new Date(l.datePeremption).toLocaleDateString("fr-FR")}</td>
                                  <td>{l.quantite}</td>
                                  {estMonEtablissement && (
                                    <td className="reseau-destruction-cellule">
                                      {lotsDestructionDemandee[l.id] ? (
                                        <span className="reseau-destruction-envoyee">Demande envoyée</span>
                                      ) : (
                                        <div className="reseau-destruction-form">
                                          <input
                                            type="number"
                                            min="1"
                                            max={l.quantite}
                                            className="reseau-destruction-quantite"
                                            placeholder={`${l.quantite}`}
                                            value={quantitesDestruction[l.id] ?? ""}
                                            onChange={(e) =>
                                              setQuantitesDestruction((q) => ({ ...q, [l.id]: e.target.value }))
                                            }
                                          />
                                          <input
                                            type="text"
                                            className="reseau-destruction-motif"
                                            placeholder="Motif (optionnel)"
                                            value={motifsDestruction[l.id] || ""}
                                            onChange={(e) =>
                                              setMotifsDestruction((m) => ({ ...m, [l.id]: e.target.value }))
                                            }
                                          />
                                          <button
                                            className="reseau-bouton-export reseau-bouton-destruction"
                                            disabled={envoiDestructionEnCours[l.id] || !l.id}
                                            onClick={() => demanderDestruction(l)}
                                          >
                                            {envoiDestructionEnCours[l.id] ? "Envoi..." : "Demander la destruction"}
                                          </button>
                                        </div>
                                      )}
                                    </td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })
          )}
        </>
      )}
    </div>
  );
}