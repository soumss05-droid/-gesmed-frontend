// CouvertureOffre.jsx - Couverture de l'offre de service (version 2 : synthese, barres, tri, export).
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import "./AdminPanel.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

function jeton() {
  return localStorage.getItem("SYGIMS_token") || localStorage.getItem("gesmed_token");
}

async function chargerCouverture(codeProgramme) {
  const parametre = codeProgramme ? `?programme=${encodeURIComponent(codeProgramme)}` : "";
  const res = await fetch(`${API_URL}/couverture-offre${parametre}`, {
    headers: { Authorization: `Bearer ${jeton()}` },
    cache: "no-store",
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    throw new Error(
      (data && data.erreur) || "Le serveur n'a pas r\u00e9pondu comme pr\u00e9vu. V\u00e9rifiez que le backend est d\u00e9marr\u00e9."
    );
  }
  return data;
}

const NIVEAUX = {
  HOPITAL: "H\u00f4pital",
  CS_MOUGHATAA: "CS de Moughataa",
  CS_SECONDAIRE: "CS secondaire",
  PS_PRINCIPAL: "PS principal",
  PS_SECONDAIRE: "PS secondaire",
  UPEC_COMMUNAUTAIRE: "UPEC communautaire",
  AUTRE: "Autre (cabinet, clinique)",
};

const PAS_FOSA = 300;
const VERT = "#1f7a3d";
const ORANGE = "#b86e00";
const ROUGE = "#b3261e";
const GRIS = "#6b7280";

const CSS_COUVERTURE = `
.couv-page { text-align: left; max-width: 1280px; box-sizing: border-box; overflow-x: hidden; }
.couv-page .admin-header { display: block; }
.couv-page .admin-header h1 { margin: 10px 0 6px; }
.couv-page .admin-message { margin: 4px 0; }
.couv-actions { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0 4px; }
.couv-bouton { padding: 8px 14px; border-radius: 8px; border: 1px solid #b5b5b5; background: #fff; cursor: pointer; font-size: 0.9rem; }
.couv-bouton:hover { background: #f3f4f6; }
.couv-bouton-plein { background: #1f7a3d; border-color: #1f7a3d; color: #fff; }
.couv-bouton-plein:hover { background: #17612f; }
.couv-meta { font-size: 0.85rem; color: #6b7280; margin: 4px 0 0; }
.couv-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin: 16px 0; }
.couv-kpi { border: 1px solid #e2e2e2; border-radius: 12px; padding: 12px 14px; background: #fff; }
.couv-kpi-titre { font-size: 0.8rem; color: #6b7280; text-transform: uppercase; letter-spacing: 0.03em; }
.couv-kpi-valeur { font-size: 1.7rem; font-weight: 700; line-height: 1.2; margin-top: 4px; }
.couv-kpi-detail { font-size: 0.8rem; color: #6b7280; margin-top: 2px; }
.couv-aide { font-size: 0.88rem; margin: 0 0 14px; border: 1px solid #e2e2e2; border-radius: 10px; padding: 8px 12px; background: #fafafa; }
.couv-aide summary { cursor: pointer; font-weight: 600; }
.couv-champs { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin: 0 0 12px; }
.couv-champ { padding: 8px 10px; border-radius: 8px; border: 1px solid #b5b5b5; max-width: 100%; background: #fff; }
.couv-onglets { display: flex; flex-wrap: wrap; gap: 4px; border-bottom: 1px solid #c9c9c9; margin-bottom: 16px; }
.couv-onglet { padding: 9px 16px; border: none; border-bottom: 3px solid transparent; background: transparent; cursor: pointer; font-size: 0.95rem; font-weight: 500; }
.couv-onglet-actif { border-bottom-color: #1f7a3d; font-weight: 700; }
.couv-tableau-cadre { overflow-x: auto; border: 1px solid #e2e2e2; border-radius: 12px; background: #fff; }
.couv-tableau { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
.couv-th { padding: 10px 12px; border-bottom: 2px solid #c9c9c9; text-align: center; font-size: 0.82rem; font-weight: 600; color: #4b5563; vertical-align: bottom; cursor: pointer; user-select: none; white-space: normal; line-height: 1.25; background: #fafafa; }
.couv-th:hover { color: #111827; }
.couv-gauche { text-align: left; }
.couv-fleche { margin-left: 4px; font-size: 0.7rem; opacity: 0.7; }
.couv-td { padding: 10px 12px; border-bottom: 1px solid #eee; text-align: center; vertical-align: middle; white-space: nowrap; }
.couv-td.couv-gauche { text-align: left; white-space: normal; min-width: 170px; }
.couv-total { font-weight: 700; background: rgba(0,0,0,0.04); }
.couv-sous { font-size: 0.78rem; color: #6b7280; }
.couv-barre { display: flex; align-items: center; justify-content: flex-end; gap: 8px; min-width: 120px; }
.couv-barre-piste { position: relative; flex: 1; height: 10px; border-radius: 6px; background: #e5e7eb; min-width: 50px; }
.couv-barre-rempli { height: 100%; border-radius: 6px; }
.couv-barre-cible { position: absolute; top: -3px; width: 2px; height: 16px; background: #111827; }
.couv-barre-valeur { font-weight: 700; min-width: 52px; text-align: right; }
.couv-badge { display: inline-block; padding: 1px 8px; border-radius: 10px; font-size: 0.78rem; background: #fff4e0; color: #b86e00; }
.couv-prio { border: 1px solid #f1d0cc; background: #fff7f6; border-radius: 12px; padding: 10px 14px; margin-bottom: 14px; }
.couv-prio h3 { margin: 0 0 8px; font-size: 0.95rem; }
.couv-prio-ligne { display: grid; grid-template-columns: minmax(120px, 1fr) minmax(160px, 2fr); gap: 10px; align-items: center; padding: 3px 0; font-size: 0.9rem; }
.couv-resume { border: 1px solid #e2e2e2; border-radius: 12px; padding: 12px 14px; margin-bottom: 14px; background: #fff; }
.couv-resume-titre { font-weight: 700; margin-bottom: 6px; }
.couv-cliquable { cursor: pointer; }
.couv-cliquable:hover td { background: #f1f5ee; }
.couv-td .couv-barre { width: 190px; min-width: 0; margin: 0 auto; justify-content: center; }
.couv-feuille .couv-fleche { display: none; }
.couv-feuille .couv-th { cursor: default; }
.couv-vide { padding: 18px; color: #6b7280; text-align: center; }
.couv-erreur-bloc { border: 1px solid #f1b5b0; background: #fdecea; border-radius: 10px; padding: 10px 14px; margin: 12px 0; }
@media (max-width: 640px) {
  .couv-prio-ligne { grid-template-columns: 1fr; }
  .couv-kpi-valeur { font-size: 1.4rem; }
}
@media print {
  .no-print { display: none !important; }
  .couv-tableau-cadre { overflow: visible; border: none; }
  .couv-tableau { font-size: 0.8rem; }
  .couv-barre-piste { border: 1px solid #999; }
}
`;

function formaterPct(valeur) {
  if (valeur === null || valeur === undefined) return "\u2014";
  return `${String(valeur).replace(".", ",")} %`;
}

// Etat d'une valeur de couverture : couleur + libelle (sans dependre de la seule couleur).
function etat(valeur, cible) {
  if (valeur === null || valeur === undefined) return { couleur: GRIS, libelle: "Non calculable" };
  if (cible !== null && cible !== undefined) {
    if (valeur >= cible) return { couleur: VERT, libelle: "Cible atteinte" };
    if (valeur >= cible * 0.7) return { couleur: ORANGE, libelle: "Proche de la cible" };
    return { couleur: ROUGE, libelle: "Loin de la cible" };
  }
  if (valeur >= 80) return { couleur: VERT, libelle: "Bon niveau" };
  if (valeur >= 50) return { couleur: ORANGE, libelle: "\u00c0 surveiller" };
  return { couleur: ROUGE, libelle: "Faible" };
}

function Barre({ valeur, cible }) {
  if (valeur === null || valeur === undefined) return <span style={{ color: GRIS }}>{"\u2014"}</span>;
  const e = etat(valeur, cible);
  const largeur = Math.max(0, Math.min(100, valeur));
  const aCible = cible !== null && cible !== undefined;
  return (
    <div className="couv-barre" title={e.libelle + (aCible ? " (cible " + formaterPct(cible) + ")" : "")}>
      <div className="couv-barre-piste">
        <div className="couv-barre-rempli" style={{ width: largeur + "%", background: e.couleur }} />
        {aCible && <div className="couv-barre-cible" style={{ left: Math.min(100, cible) + "%" }} />}
      </div>
      <span className="couv-barre-valeur" style={{ color: e.couleur }}>
        {formaterPct(valeur)}
        {aCible ? (valeur >= cible ? " \u2713" : " \u2717") : ""}
      </span>
    </div>
  );
}

function Kpi({ titre, valeur, detail, couleur }) {
  return (
    <div className="couv-kpi">
      <div className="couv-kpi-titre">{titre}</div>
      <div className="couv-kpi-valeur" style={couleur ? { color: couleur } : undefined}>{valeur}</div>
      {detail && <div className="couv-kpi-detail">{detail}</div>}
    </div>
  );
}

function trier(lignes, tri) {
  if (!tri.cle) return lignes;
  const sens = tri.sens === "desc" ? -1 : 1;
  return [...lignes].sort((a, b) => {
    const x = a[tri.cle];
    const y = b[tri.cle];
    const xv = x === null || x === undefined;
    const yv = y === null || y === undefined;
    if (xv && yv) return 0;
    if (xv) return 1;
    if (yv) return -1;
    if (typeof x === "string") return sens * x.localeCompare(y, "fr");
    return sens * (x - y);
  });
}

function EnTete({ cle, libelle, tri, setTri, gauche }) {
  const actif = tri.cle === cle;
  function basculer() {
    setTri(actif ? { cle, sens: tri.sens === "asc" ? "desc" : "asc" } : { cle, sens: "asc" });
  }
  return (
    <th
      className={"couv-th" + (gauche ? " couv-gauche" : "")}
      onClick={basculer}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") basculer();
      }}
      tabIndex={0}
      aria-sort={actif ? (tri.sens === "asc" ? "ascending" : "descending") : "none"}
      title={"Trier par cette colonne"}
    >
      {libelle}
      <span className="couv-fleche">{actif ? (tri.sens === "asc" ? "\u25b2" : "\u25bc") : "\u2195"}</span>
    </th>
  );
}

// Les 5 zones les moins couvertes (parmi celles qui ont des formations eligibles).
function Prioritaires({ lignes, cible, titre }) {
  const faibles = lignes
    .filter((l) => l.couvertureEligibles !== null && l.couvertureEligibles !== undefined && l.eligibles > 0)
    .sort((a, b) => a.couvertureEligibles - b.couvertureEligibles)
    .slice(0, 5);
  if (faibles.length < 2) return null;
  return (
    <div className="couv-prio">
      <h3>{titre}</h3>
      {faibles.map((l) => (
        <div className="couv-prio-ligne" key={`${l.drs || ""}|${l.nom}`}>
          <span>
            {l.nom}
            {l.drs ? <span className="couv-sous">{" \u2014 " + l.drs}</span> : null}
          </span>
          <Barre valeur={l.couvertureEligibles} cible={cible} />
        </div>
      ))}
    </div>
  );
}

// Tableau commun aux vues Par wilaya et Par moughataa.
function TableauZones({ titreColonne, lignes, total, cible, avecSousTitre, surClic }) {
  const [tri, setTri] = useState({ cle: null, sens: "asc" });
  const lignesTriees = useMemo(() => trier(lignes, tri), [lignes, tri]);
  const enTete = (cle, libelle, gauche) => (
    <EnTete cle={cle} libelle={libelle} tri={tri} setTri={setTri} gauche={gauche} />
  );
  return (
    <div className="couv-tableau-cadre">
      <table className="couv-tableau">
        <thead>
          <tr>
            {enTete("nom", titreColonne, true)}
            {enTete("totalFosa", "FOSA actives")}
            {enTete("eligibles", "FOSA \u00e9ligibles")}
            {enTete("offrent", "Offrent le service")}
            {enTete("nonRenseignes", "Non renseign\u00e9es")}
            {enTete("couvertureEligibles", "Couverture / \u00e9ligibles")}
            {enTete("couvertureTotale", "Couverture / total FOSA")}
          </tr>
        </thead>
        <tbody>
          {lignesTriees.length === 0 && (
            <tr>
              <td className="couv-vide" colSpan={7}>{"Aucune zone \u00e0 afficher avec ces filtres."}</td>
            </tr>
          )}
          {lignesTriees.map((l) => (
            <tr key={`${l.drs || ""}|${l.nom}`} className={surClic ? "couv-cliquable" : undefined} onClick={surClic ? () => surClic(l) : undefined} title={surClic ? "Cliquer pour voir le detail" : undefined}>
              <td className="couv-td couv-gauche">
                {l.nom}
                {avecSousTitre && l.drs && <div className="couv-sous">{l.drs}</div>}
              </td>
              <td className="couv-td">{l.totalFosa}</td>
              <td className="couv-td">{l.eligibles}</td>
              <td className="couv-td">{l.offrent}</td>
              <td className="couv-td">
                {l.nonRenseignes > 0 ? <span className="couv-badge">{l.nonRenseignes}</span> : l.nonRenseignes}
              </td>
              <td className="couv-td"><Barre valeur={l.couvertureEligibles} cible={cible} /></td>
              <td className="couv-td">{formaterPct(l.couvertureTotale)}</td>
            </tr>
          ))}
          {total && (
            <tr className="couv-total">
              <td className="couv-td couv-gauche couv-total">{"Ensemble du p\u00e9rim\u00e8tre"}</td>
              <td className="couv-td couv-total">{total.totalFosa}</td>
              <td className="couv-td couv-total">{total.eligibles}</td>
              <td className="couv-td couv-total">{total.offrent}</td>
              <td className="couv-td couv-total">{total.nonRenseignes}</td>
              <td className="couv-td couv-total"><Barre valeur={total.couvertureEligibles} cible={cible} /></td>
              <td className="couv-td couv-total">{formaterPct(total.couvertureTotale)}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function TableauFosas({ fosas, nbServices }) {
  const [tri, setTri] = useState({ cle: null, sens: "asc" });
  const [limite, setLimite] = useState(PAS_FOSA);
  const triees = useMemo(() => trier(fosas, tri), [fosas, tri]);
  useEffect(() => {
    setLimite(PAS_FOSA);
  }, [fosas]);
  const enTete = (cle, libelle, gauche) => (
    <EnTete cle={cle} libelle={libelle} tri={tri} setTri={setTri} gauche={gauche} />
  );
  return (
    <>
      <p className="couv-meta">
        {fosas.length + " FOSA"}
        {" \u2014 services offerts \u00f7 services \u00e9ligibles, et \u00f7 total des " + nbServices + " services."}
      </p>
      <div className="couv-tableau-cadre">
        <table className="couv-tableau">
          <thead>
            <tr>
              {enTete("nom", "FOSA", true)}
              {enTete("niveau", "Niveau", true)}
              {enTete("servicesEligibles", "Services \u00e9ligibles")}
              {enTete("servicesOfferts", "Services offerts")}
              {enTete("couvertureEligibles", "Couverture / \u00e9ligibles")}
              {enTete("couvertureTotale", "Couverture / total des services")}
            </tr>
          </thead>
          <tbody>
            {triees.length === 0 && (
              <tr>
                <td className="couv-vide" colSpan={6}>{"Aucune FOSA ne correspond \u00e0 ces filtres."}</td>
              </tr>
            )}
            {triees.slice(0, limite).map((f) => (
              <tr key={f.id}>
                <td className="couv-td couv-gauche">
                  {f.nom}
                  <div className="couv-sous">{[f.moughataa, f.drs].filter(Boolean).join(" \u2014 ")}</div>
                </td>
                <td className="couv-td couv-gauche">{f.niveau ? NIVEAUX[f.niveau] || f.niveau : "\u2014"}</td>
                <td className="couv-td">{f.servicesEligibles}</td>
                <td className="couv-td">{f.servicesOfferts}</td>
                <td className="couv-td"><Barre valeur={f.couvertureEligibles} /></td>
                <td className="couv-td">{formaterPct(f.couvertureTotale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {triees.length > limite && (
        <div className="couv-actions no-print">
          <button type="button" className="couv-bouton" onClick={() => setLimite((l) => l + PAS_FOSA)}>
            {"Afficher " + Math.min(PAS_FOSA, triees.length - limite) + " FOSA de plus (" + limite + " sur " + triees.length + ")"}
          </button>
        </div>
      )}
    </>
  );
}

// ---- Export PDF : meme methode que la Fiche de situation (html2canvas + jsPDF, A4 portrait) ----
function FeuillePdf({ donnees, services, service, synthese, programmeLibelle }) {
  const niveau = donnees.portee.niveau;
  const zones = niveau === "NATIONAL" ? service.parDrs : niveau === "DRS" ? service.parMoughataa : null;
  const fosasFaibles =
    niveau === "MOUGHATAA"
      ? donnees.fosas
          .filter((f) => f.couvertureEligibles !== null && f.couvertureEligibles !== undefined)
          .sort((a, b) => a.couvertureEligibles - b.couvertureEligibles)
          .slice(0, 40)
      : [];
  const dateEdition = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  const titreZones = niveau === "NATIONAL" ? "par wilaya" : "par Moughataa";
  return (
    <div
      className="couv-feuille"
      style={{ position: "fixed", left: 0, top: 0, width: "900px", visibility: "hidden", zIndex: -1, background: "#fff", color: "#1c2b28", boxSizing: "border-box" }}
    >
      <div className="couv-pdf-entete" style={{ borderBottom: "3px solid #1f7a3d", paddingBottom: "10px", marginBottom: "16px" }}>
        <div style={{ fontSize: "13px", letterSpacing: "0.08em", color: "#1f7a3d", fontWeight: 700 }}>SYGIMS</div>
        <h1 style={{ fontSize: "26px", margin: "6px 0 4px" }}>{"Couverture de l'offre de service"}</h1>
        <div style={{ fontSize: "14px" }}>{"P\u00e9rim\u00e8tre : " + donnees.portee.libelle + " \u2014 " + programmeLibelle}</div>
        <div style={{ fontSize: "13px", color: "#6b7280", marginTop: "2px" }}>
          {"\u00c9dit\u00e9 le " + dateEdition + " \u2014 " + donnees.totalFosa + " formation(s) sanitaire(s) active(s), " + donnees.nbServices + " service(s)"}
        </div>
      </div>

      {synthese && (
        <div className="couv-kpis couv-pdf-bloc">
          <Kpi titre={"Formations actives"} valeur={donnees.totalFosa} detail={donnees.nbServices + " service(s) suivi(s)"} />
          <Kpi
            titre={"Couverture moyenne"}
            valeur={formaterPct(synthese.moyenne)}
            detail={"moyenne des services (FOSA \u00e9ligibles)"}
            couleur={etat(synthese.moyenne).couleur}
          />
          <Kpi
            titre={"Cibles atteintes"}
            valeur={synthese.avecCible > 0 ? synthese.atteintes + " / " + synthese.avecCible : "\u2014"}
            detail={synthese.avecCible > 0 ? "services avec cible d\u00e9finie" : "aucune cible d\u00e9finie"}
            couleur={synthese.avecCible > 0 ? (synthese.atteintes === synthese.avecCible ? VERT : ORANGE) : undefined}
          />
          <Kpi
            titre={"R\u00e9ponses manquantes"}
            valeur={synthese.manquantes}
            detail={"FOSA \u00e9ligibles sans r\u00e9ponse"}
            couleur={synthese.manquantes > 0 ? ORANGE : VERT}
          />
        </div>
      )}

      <h3 className="couv-pdf-titre" style={{ fontSize: "16px", margin: "10px 0 8px" }}>Indicateurs par service</h3>
      <div className="couv-pdf-bloc couv-tableau-cadre">
        <table className="couv-tableau">
          <thead>
            <tr>
              <th className="couv-th couv-gauche">Service</th>
              <th className="couv-th">Cible</th>
              <th className="couv-th">{"FOSA \u00e9ligibles"}</th>
              <th className="couv-th">Offrent</th>
              <th className="couv-th">{"Non renseign\u00e9es"}</th>
              <th className="couv-th">{"Couverture / \u00e9ligibles"}</th>
            </tr>
          </thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.id}>
                <td className="couv-td couv-gauche">
                  {s.nom}
                  <div className="couv-sous">{s.groupe}</div>
                </td>
                <td className="couv-td">{formaterPct(s.ciblePct)}</td>
                <td className="couv-td">{s.national.eligibles}</td>
                <td className="couv-td">{s.national.offrent}</td>
                <td className="couv-td">{s.national.nonRenseignes}</td>
                <td className="couv-td"><Barre valeur={s.national.couvertureEligibles} cible={s.ciblePct} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {zones && (
        <>
          <h3 className="couv-pdf-titre" style={{ fontSize: "16px", margin: "18px 0 8px" }}>
            {"Service d\u00e9taill\u00e9 : " + service.nom + " (" + titreZones + ")"}
          </h3>
          <div className="couv-pdf-bloc">
            <Prioritaires lignes={zones} cible={service.ciblePct} titre={"Zones \u00e0 renforcer en priorit\u00e9"} />
          </div>
          <div className="couv-pdf-bloc couv-tableau-cadre">
            <TableauZones
              titreColonne={niveau === "NATIONAL" ? "Wilaya" : "Moughataa"}
              lignes={zones}
              total={service.national}
              cible={service.ciblePct}
              avecSousTitre={niveau === "DRS"}
            />
          </div>
        </>
      )}

      {niveau === "MOUGHATAA" && fosasFaibles.length > 0 && (
        <>
          <h3 className="couv-pdf-titre" style={{ fontSize: "16px", margin: "18px 0 8px" }}>{"FOSA les moins couvertes (40 maximum)"}</h3>
          <div className="couv-pdf-bloc couv-tableau-cadre">
            <table className="couv-tableau">
              <thead>
                <tr>
                  <th className="couv-th couv-gauche">FOSA</th>
                  <th className="couv-th">{"Services \u00e9ligibles"}</th>
                  <th className="couv-th">Services offerts</th>
                  <th className="couv-th">{"Couverture / \u00e9ligibles"}</th>
                </tr>
              </thead>
              <tbody>
                {fosasFaibles.map((f) => (
                  <tr key={f.id}>
                    <td className="couv-td couv-gauche">{f.nom}</td>
                    <td className="couv-td">{f.servicesEligibles}</td>
                    <td className="couv-td">{f.servicesOfferts}</td>
                    <td className="couv-td"><Barre valeur={f.couvertureEligibles} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="couv-pdf-bloc" style={{ fontSize: "12px", color: "#4b5563", marginTop: "14px", lineHeight: 1.5 }}>
        {"Couverture / \u00e9ligibles = FOSA qui offrent le service \u00f7 FOSA \u00e9ligibles. Une FOSA \u00e9ligible sans r\u00e9ponse compte comme \u00ab ne l'offre pas \u00bb. Le trait noir des barres marque la cible ; vert : cible atteinte, orange : au moins 70 % de la cible, rouge : en dessous."}
      </div>
    </div>
  );
}

async function genererPdf(nomFichier) {
  const modules = await Promise.all([import("html2canvas"), import("jspdf")]);
  const html2canvas = modules[0].default;
  const JsPdf = modules[1].jsPDF;
  const feuille = document.querySelector(".couv-feuille");
  if (!feuille) throw new Error("Feuille de rapport introuvable.");

  const SELECTEURS = ".couv-pdf-entete, .couv-pdf-titre, .couv-pdf-bloc, .couv-feuille tbody tr, .couv-prio-ligne";
  const ECHELLE = 1.8;
  let coupures = [];
  let largeurCss = 0;
  let hauteurCss = 0;

  const canvas = await html2canvas(feuille, {
    scale: ECHELLE,
    backgroundColor: "#ffffff",
    useCORS: true,
    logging: false,
    windowWidth: 1000,
    onclone: (docClone) => {
      const f = docClone.querySelector(".couv-feuille");
      if (!f) return;
      f.style.visibility = "visible";
      f.style.zIndex = "0";
      f.style.width = "900px";
      const rect = f.getBoundingClientRect();
      largeurCss = rect.width;
      hauteurCss = rect.height;
      coupures = Array.from(f.querySelectorAll(SELECTEURS))
        .filter((e) => {
          const prec = e.previousElementSibling;
          if (prec && /^H[23]$/.test(prec.tagName)) return false;
          if (e.tagName === "TR" && e.parentElement.firstElementChild === e) return false;
          return true;
        })
        .map((e) => e.getBoundingClientRect().top - rect.top);
    },
  });

  if (!largeurCss || !hauteurCss) {
    largeurCss = canvas.width / ECHELLE;
    hauteurCss = canvas.height / ECHELLE;
  }
  const ratio = canvas.width / largeurCss;
  const largeurMm = 190;
  const hauteurPageCss = (269 / largeurMm) * largeurCss;

  const pages = [];
  let debut = 0;
  while (debut < hauteurCss - 1) {
    const limite = debut + hauteurPageCss;
    let fin = hauteurCss;
    if (limite < hauteurCss) {
      const possibles = coupures.filter((c) => c > debut + hauteurPageCss * 0.4 && c <= limite);
      fin = possibles.length > 0 ? Math.max(...possibles) : limite;
    }
    pages.push([debut, fin]);
    debut = fin;
  }

  const pdf = new JsPdf({ unit: "mm", format: "a4", orientation: "portrait" });
  pages.forEach((p, i) => {
    if (i > 0) pdf.addPage();
    const sy = Math.round(p[0] * ratio);
    const sh = Math.max(1, Math.min(canvas.height - sy, Math.round((p[1] - p[0]) * ratio)));
    const tranche = document.createElement("canvas");
    tranche.width = canvas.width;
    tranche.height = sh;
    const ctx = tranche.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, tranche.width, tranche.height);
    ctx.drawImage(canvas, 0, sy, canvas.width, sh, 0, 0, canvas.width, sh);
    pdf.addImage(tranche.toDataURL("image/jpeg", 0.92), "JPEG", 10, 10, largeurMm, (sh * largeurMm) / canvas.width);
    pdf.setFontSize(8);
    pdf.setTextColor(110);
    pdf.text("SYGIMS - Couverture de l'offre de service", 10, 291);
    pdf.text("Page " + (i + 1) + " / " + pages.length, 200, 291, { align: "right" });
  });
  pdf.save(nomFichier);
}

export default function CouvertureOffre({ onRetour }) {
  const [donnees, setDonnees] = useState(null);
  const [programmes, setProgrammes] = useState([]);
  const [codeProgramme, setCodeProgramme] = useState("");
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(true);
  const [rechargement, setRechargement] = useState(0);
  const [onglet, setOnglet] = useState("national");
  const [serviceId, setServiceId] = useState("");
  const [filtreDrs, setFiltreDrs] = useState("");
  const [filtreMoughataa, setFiltreMoughataa] = useState("");
  const [filtreNiveau, setFiltreNiveau] = useState("");
  const [seulementFaibles, setSeulementFaibles] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [pdfEnCours, setPdfEnCours] = useState(false);

  useEffect(() => {
    let annule = false;
    setChargement(true);
    setErreur("");
    chargerCouverture(codeProgramme)
      .then((d) => {
        if (annule) return;
        setDonnees(d);
        if (!codeProgramme) {
          const vus = new Map();
          for (const s of d.services) vus.set(s.programme.code, s.programme.nom);
          setProgrammes([...vus].map(([code, nom]) => ({ code, nom })));
        }
      })
      .catch((e) => {
        if (!annule) setErreur(e.message);
      })
      .finally(() => {
        if (!annule) setChargement(false);
      });
    return () => {
      annule = true;
    };
  }, [codeProgramme, rechargement]);

  const services = donnees ? donnees.services : [];
  const service = services.find((s) => s.id === serviceId) || services[0] || null;

  const listeDrs = useMemo(() => {
    if (!donnees) return [];
    return [...new Set(donnees.fosas.map((f) => f.drs).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
  }, [donnees]);

  const listeMoughataas = useMemo(() => {
    if (!donnees) return [];
    return [
      ...new Set(
        donnees.fosas
          .filter((f) => !filtreDrs || f.drs === filtreDrs)
          .map((f) => f.moughataa)
          .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b, "fr"));
  }, [donnees, filtreDrs]);

  const niveauxPresents = useMemo(() => {
    if (!donnees) return [];
    return [...new Set(donnees.fosas.map((f) => f.niveau).filter(Boolean))];
  }, [donnees]);

  const fosasFiltrees = useMemo(() => {
    if (!donnees) return [];
    const texte = recherche.trim().toLowerCase();
    return donnees.fosas.filter(
      (f) =>
        (!filtreDrs || f.drs === filtreDrs) &&
        (!filtreMoughataa || f.moughataa === filtreMoughataa) &&
        (!filtreNiveau || f.niveau === filtreNiveau) &&
        (!seulementFaibles || f.couvertureEligibles === null || f.couvertureEligibles < 50) &&
        (!texte || f.nom.toLowerCase().includes(texte))
    );
  }, [donnees, filtreDrs, filtreMoughataa, filtreNiveau, seulementFaibles, recherche]);

  const lignesMoughataa = useMemo(() => {
    if (!service) return [];
    const texte = recherche.trim().toLowerCase();
    return service.parMoughataa.filter(
      (m) => (!filtreDrs || m.drs === filtreDrs) && (!texte || m.nom.toLowerCase().includes(texte))
    );
  }, [service, filtreDrs, recherche]);

  // Indicateurs de synthese en tete de page.
  const synthese = useMemo(() => {
    if (!donnees || services.length === 0) return null;
    const valeurs = services.map((s) => s.national.couvertureEligibles).filter((v) => v !== null && v !== undefined);
    const moyenne = valeurs.length ? Math.round((valeurs.reduce((a, b) => a + b, 0) * 10) / valeurs.length) / 10 : null;
    const avecCible = services.filter(
      (s) => s.ciblePct !== null && s.ciblePct !== undefined && s.national.couvertureEligibles !== null
    );
    const atteintes = avecCible.filter((s) => s.national.couvertureEligibles >= s.ciblePct).length;
    const manquantes = services.reduce((somme, s) => somme + (s.national.nonRenseignes || 0), 0);
    return { moyenne, avecCible: avecCible.length, atteintes, manquantes };
  }, [donnees, services]);

  function descendreService(s) {
    setServiceId(s.id);
    setOnglet(donnees.portee.niveau === "NATIONAL" ? "drs" : "moughataa");
  }

  function descendreWilaya(l) {
    setFiltreDrs(l.nom);
    setFiltreMoughataa("");
    setRecherche("");
    setOnglet("moughataa");
  }

  function descendreMoughataa(l) {
    setFiltreDrs(l.drs || "");
    setFiltreMoughataa(l.nom);
    setRecherche("");
    setOnglet("fosa");
  }

  function changerDrs(valeur) {
    setFiltreDrs(valeur);
    setFiltreMoughataa("");
  }

  async function exporterPdf() {
    if (!donnees || !service) return;
    setPdfEnCours(true);
    try {
      // Laisse a React le temps d'afficher la feuille de rapport cachee.
      await new Promise((resolve) => setTimeout(resolve, 300));
      const nom = String(donnees.portee.libelle).replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      await genererPdf("Couverture-offre-" + nom + "-" + new Date().toISOString().slice(0, 10) + ".pdf");
    } catch (e) {
      setErreur("Impossible de g\u00e9n\u00e9rer le PDF : " + (e && e.message ? e.message : e));
    } finally {
      setPdfEnCours(false);
    }
  }

  function exporterExcel() {
    if (!donnees || !service) return;
    const zone = (titre) => (l) => ({
      Service: service.nom,
      [titre]: l.nom,
      "Wilaya": l.drs || "",
      "FOSA actives": l.totalFosa,
      "FOSA \u00e9ligibles": l.eligibles,
      "Offrent le service": l.offrent,
      "Non renseign\u00e9es": l.nonRenseignes,
      "Couverture / \u00e9ligibles (%)": l.couvertureEligibles,
      "Couverture / total FOSA (%)": l.couvertureTotale,
    });
    let lignes = [];
    let nomFeuille = "Couverture";
    if (onglet === "national") {
      nomFeuille = "Services";
      lignes = services.map((s) => ({
        Programme: s.programme.nom,
        Service: s.nom,
        "Cible (%)": s.ciblePct === null || s.ciblePct === undefined ? "" : s.ciblePct,
        "FOSA \u00e9ligibles": s.national.eligibles,
        "Offrent le service": s.national.offrent,
        "Non renseign\u00e9es": s.national.nonRenseignes,
        "Hors \u00e9ligibilit\u00e9": s.national.offrentHorsEligibilite,
        "Couverture / \u00e9ligibles (%)": s.national.couvertureEligibles,
        "Couverture / total FOSA (%)": s.national.couvertureTotale,
      }));
    } else if (onglet === "drs") {
      nomFeuille = "Wilayas";
      lignes = service.parDrs.map(zone("Wilaya"));
    } else if (onglet === "moughataa") {
      nomFeuille = "Moughataas";
      lignes = lignesMoughataa.map(zone("Moughataa"));
    } else {
      nomFeuille = "FOSA";
      lignes = fosasFiltrees.map((f) => ({
        FOSA: f.nom,
        Moughataa: f.moughataa || "",
        Wilaya: f.drs || "",
        Niveau: f.niveau ? NIVEAUX[f.niveau] || f.niveau : "",
        "Services \u00e9ligibles": f.servicesEligibles,
        "Services offerts": f.servicesOfferts,
        "Couverture / \u00e9ligibles (%)": f.couvertureEligibles,
        "Couverture / total des services (%)": f.couvertureTotale,
      }));
    }
    if (lignes.length === 0) {
      alert("Aucune donn\u00e9e \u00e0 exporter pour les filtres actuels.");
      return;
    }
    const classeur = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(classeur, XLSX.utils.json_to_sheet(lignes), nomFeuille);
    XLSX.writeFile(classeur, "couverture-offre-" + nomFeuille.toLowerCase() + ".xlsx");
  }

  const selecteurService = (
    <label style={{ display: "block", marginBottom: "12px" }}>
      Service :{" "}
      <select
        className="couv-champ"
        value={service ? service.id : ""}
        onChange={(e) => setServiceId(e.target.value)}
      >
        {services.map((s) => (
          <option key={s.id} value={s.id}>
            {s.programme.nom + " \u2014 " + s.nom}
          </option>
        ))}
      </select>
    </label>
  );

  const resumeService = service && (
    <div className="couv-resume">
      <div className="couv-resume-titre">
        {service.nom}
        <span className="couv-sous">{" \u2014 " + service.groupe}</span>
      </div>
      <div className="couv-barre" style={{ justifyContent: "flex-start", maxWidth: "520px" }}>
        <Barre valeur={service.national.couvertureEligibles} cible={service.ciblePct} />
      </div>
      <div className="couv-sous" style={{ marginTop: "4px" }}>
        {service.national.offrent + " FOSA sur " + service.national.eligibles + " \u00e9ligibles offrent ce service"}
        {service.ciblePct !== null && service.ciblePct !== undefined ? " \u2014 cible : " + formaterPct(service.ciblePct) : ""}
        {service.national.nonRenseignes > 0 ? " \u2014 " + service.national.nonRenseignes + " r\u00e9ponse(s) manquante(s)" : ""}
      </div>
    </div>
  );

  const libelleOngletPremier =
    donnees && donnees.portee.niveau === "DRS"
      ? "Ma wilaya"
      : donnees && donnees.portee.niveau === "MOUGHATAA"
      ? "Ma Moughataa"
      : "National";

  return (
    <div className="admin-page couv-page">
      <style>{CSS_COUVERTURE}</style>
      {pdfEnCours && donnees && service && (
        <FeuillePdf
          donnees={donnees}
          services={services}
          service={service}
          synthese={synthese}
          programmeLibelle={codeProgramme ? ((programmes.find((p) => p.code === codeProgramme) || {}).nom || codeProgramme) : "Tous les programmes"}
        />
      )}
      <header className="admin-header">
        <button className="admin-retour no-print" onClick={onRetour}>{"\u2190 Retour"}</button>
        <h1>{"Couverture de l'offre de service"}</h1>
        {donnees && (
          <>
            <p className="admin-message">
              {"P\u00e9rim\u00e8tre : " + donnees.portee.libelle + " \u2014 " + donnees.totalFosa + " formation(s) sanitaire(s) active(s), " + donnees.nbServices + " service(s)."}
            </p>
            {donnees.genereLe && (
              <p className="couv-meta">
                {"Donn\u00e9es calcul\u00e9es le " + new Date(donnees.genereLe).toLocaleString("fr-FR")}
              </p>
            )}
          </>
        )}
        <div className="couv-actions no-print">
          <button type="button" className="couv-bouton" onClick={() => setRechargement((n) => n + 1)} disabled={chargement}>
            {chargement ? "Chargement\u2026" : "Actualiser"}
          </button>
          <button type="button" className="couv-bouton couv-bouton-plein" onClick={exporterPdf} disabled={!donnees || !service || pdfEnCours}>
            {pdfEnCours ? "G\u00e9n\u00e9ration du PDF\u2026" : "Exporter (PDF)"}
          </button>
          <button type="button" className="couv-bouton" onClick={exporterExcel} disabled={!donnees || !service}>
            {"Exporter (Excel)"}
          </button>
          <button type="button" className="couv-bouton" onClick={() => window.print()} disabled={!donnees}>
            Imprimer
          </button>
        </div>
      </header>

      {erreur && (
        <div className="couv-erreur-bloc" role="alert">
          <div>{erreur}</div>
          <div className="couv-actions no-print">
            <button type="button" className="couv-bouton" onClick={() => setRechargement((n) => n + 1)}>
              {"R\u00e9essayer"}
            </button>
          </div>
        </div>
      )}
      {chargement && !donnees && <p>{"Chargement des indicateurs\u2026"}</p>}

      {donnees && (
        <>
          {synthese && (
            <div className="couv-kpis">
              <Kpi
                titre={"Formations actives"}
                valeur={donnees.totalFosa}
                detail={donnees.nbServices + " service(s) suivi(s)"}
              />
              <Kpi
                titre={"Couverture moyenne"}
                valeur={formaterPct(synthese.moyenne)}
                detail={"moyenne des services, parmi les FOSA \u00e9ligibles"}
                couleur={etat(synthese.moyenne).couleur}
              />
              <Kpi
                titre={"Cibles atteintes"}
                valeur={synthese.avecCible > 0 ? synthese.atteintes + " / " + synthese.avecCible : "\u2014"}
                detail={synthese.avecCible > 0 ? "services ayant une cible d\u00e9finie" : "aucune cible d\u00e9finie"}
                couleur={synthese.avecCible > 0 ? (synthese.atteintes === synthese.avecCible ? VERT : ORANGE) : undefined}
              />
              <Kpi
                titre={"R\u00e9ponses manquantes"}
                valeur={synthese.manquantes}
                detail={"FOSA \u00e9ligibles qui n'ont pas encore r\u00e9pondu"}
                couleur={synthese.manquantes > 0 ? ORANGE : VERT}
              />
            </div>
          )}

          <details className="couv-aide no-print">
            <summary>{"Comment lire ces indicateurs ?"}</summary>
            <p style={{ margin: "8px 0 0" }}>
              {"Couverture / \u00e9ligibles = FOSA qui offrent le service \u00f7 FOSA \u00e9ligibles. Couverture / total FOSA = FOSA qui offrent le service \u00f7 total des FOSA actives. Une FOSA \u00e9ligible qui n'a pas encore r\u00e9pondu compte comme \u00ab ne l'offre pas \u00bb et figure dans \u00ab Non renseign\u00e9es \u00bb. Les FOSA d\u00e9sactiv\u00e9es sont exclues."}
            </p>
            <p style={{ margin: "8px 0 0" }}>
              {"Sur les barres, le trait noir marque la cible. Vert : cible atteinte. Orange : au moins 70 % de la cible. Rouge : en dessous. Sans cible d\u00e9finie : vert \u2265 80 %, orange \u2265 50 %, rouge en dessous. Cliquez sur un titre de colonne pour trier."}
            </p>
          </details>

          {programmes.length > 1 && (
            <label className="no-print" style={{ display: "block", marginBottom: "12px" }}>
              Programme :{" "}
              <select className="couv-champ" value={codeProgramme} onChange={(e) => setCodeProgramme(e.target.value)}>
                <option value="">Tous les programmes</option>
                {programmes.map((p) => (
                  <option key={p.code} value={p.code}>{p.nom}</option>
                ))}
              </select>
            </label>
          )}

          <div className="couv-onglets no-print">
            <button type="button" className={"couv-onglet" + (onglet === "national" ? " couv-onglet-actif" : "")} onClick={() => setOnglet("national")}>
              {libelleOngletPremier}
            </button>
            {donnees.portee.niveau === "NATIONAL" && (
              <button type="button" className={"couv-onglet" + (onglet === "drs" ? " couv-onglet-actif" : "")} onClick={() => setOnglet("drs")}>
                Par Wilaya
              </button>
            )}
            {donnees.portee.niveau !== "MOUGHATAA" && (
              <button type="button" className={"couv-onglet" + (onglet === "moughataa" ? " couv-onglet-actif" : "")} onClick={() => setOnglet("moughataa")}>
                Par Moughataa
              </button>
            )}
            <button type="button" className={"couv-onglet" + (onglet === "fosa" ? " couv-onglet-actif" : "")} onClick={() => setOnglet("fosa")}>
              Par FOSA
            </button>
          </div>

          {services.length > 0 && onglet !== "fosa" && (
            <p className="couv-meta no-print" style={{ margin: "0 0 8px" }}>
              {"Astuce : cliquez sur une ligne pour descendre au niveau suivant (service, wilaya, Moughataa, puis FOSA)."}
            </p>
          )}
          {services.length === 0 && <p>{"Aucun service actif \u00e0 afficher."}</p>}

          {services.length > 0 && onglet === "national" && (
            <div className="couv-tableau-cadre">
              <table className="couv-tableau">
                <thead>
                  <tr>
                    <th className="couv-th couv-gauche">Service</th>
                    <th className="couv-th">Cible</th>
                    <th className="couv-th">{"FOSA \u00e9ligibles"}</th>
                    <th className="couv-th">Offrent le service</th>
                    <th className="couv-th">{"Non renseign\u00e9es"}</th>
                    <th className="couv-th">{"Hors \u00e9ligibilit\u00e9"}</th>
                    <th className="couv-th">{"Couverture / \u00e9ligibles"}</th>
                    <th className="couv-th">Couverture / total FOSA</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((s) => (
                    <tr key={s.id} className="couv-cliquable" title="Cliquer pour voir le detail de ce service" onClick={() => descendreService(s)}>
                      <td className="couv-td couv-gauche">
                        {s.nom}
                        <div className="couv-sous">{s.groupe}</div>
                      </td>
                      <td className="couv-td">{formaterPct(s.ciblePct)}</td>
                      <td className="couv-td">{s.national.eligibles}</td>
                      <td className="couv-td">{s.national.offrent}</td>
                      <td className="couv-td">
                        {s.national.nonRenseignes > 0 ? <span className="couv-badge">{s.national.nonRenseignes}</span> : s.national.nonRenseignes}
                      </td>
                      <td className="couv-td">{s.national.offrentHorsEligibilite}</td>
                      <td className="couv-td"><Barre valeur={s.national.couvertureEligibles} cible={s.ciblePct} /></td>
                      <td className="couv-td">{formaterPct(s.national.couvertureTotale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {services.length > 0 && onglet === "drs" && service && (
            <>
              <div className="no-print">{selecteurService}</div>
              {resumeService}
              <Prioritaires lignes={service.parDrs} cible={service.ciblePct} titre={"Wilayas \u00e0 renforcer en priorit\u00e9"} />
              <TableauZones titreColonne="Wilaya" lignes={service.parDrs} total={service.national} cible={service.ciblePct} surClic={descendreWilaya} />
            </>
          )}

          {services.length > 0 && onglet === "moughataa" && service && (
            <>
              <div className="couv-champs no-print">
                {selecteurService}
                {listeDrs.length > 1 && (
                  <select className="couv-champ" value={filtreDrs} onChange={(e) => changerDrs(e.target.value)}>
                    <option value="">Toutes les wilayas</option>
                    {listeDrs.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                )}
                <input
                  className="couv-champ"
                  type="search"
                  placeholder={"Rechercher une Moughataa\u2026"}
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                />
              </div>
              {resumeService}
              <Prioritaires lignes={lignesMoughataa} cible={service.ciblePct} titre={"Moughataas \u00e0 renforcer en priorit\u00e9"} />
              <TableauZones titreColonne="Moughataa" lignes={lignesMoughataa} cible={service.ciblePct} avecSousTitre surClic={descendreMoughataa} />
            </>
          )}

          {services.length > 0 && onglet === "fosa" && (
            <>
              <div className="couv-champs no-print">
                {listeDrs.length > 1 && (
                  <select className="couv-champ" value={filtreDrs} onChange={(e) => changerDrs(e.target.value)}>
                    <option value="">Toutes les wilayas</option>
                    {listeDrs.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                )}
                {listeMoughataas.length > 1 && (
                  <select className="couv-champ" value={filtreMoughataa} onChange={(e) => setFiltreMoughataa(e.target.value)}>
                    <option value="">Toutes les Moughataas</option>
                    {listeMoughataas.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                )}
                {niveauxPresents.length > 1 && (
                  <select className="couv-champ" value={filtreNiveau} onChange={(e) => setFiltreNiveau(e.target.value)}>
                    <option value="">Tous les types</option>
                    {niveauxPresents.map((n) => (
                      <option key={n} value={n}>{NIVEAUX[n] || n}</option>
                    ))}
                  </select>
                )}
                <input
                  className="couv-champ"
                  type="search"
                  placeholder={"Rechercher une FOSA\u2026"}
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                />
                <label>
                  <input type="checkbox" checked={seulementFaibles} onChange={(e) => setSeulementFaibles(e.target.checked)} />
                  {" Couverture inf\u00e9rieure \u00e0 50 % ou non calculable"}
                </label>
              </div>
              <TableauFosas fosas={fosasFiltrees} nbServices={donnees.nbServices} />
            </>
          )}
        </>
      )}
    </div>
  );
}