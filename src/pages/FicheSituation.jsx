import { useEffect, useState } from "react";
import "./FicheSituation.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const PERIODES = [
  { valeur: "30", libelle: "30 derniers jours" },
  { valeur: "90", libelle: "3 derniers mois" },
  { valeur: "180", libelle: "6 derniers mois" },
  { valeur: "365", libelle: "12 derniers mois" },
  { valeur: "perso", libelle: "Période personnalisée" },
];

const LIBELLE_NIVEAU = {
  CAMEC: "CAMEC",
  GAS_DRS: "Région (DRS)",
  GAS_MOUGHATAA: "Moughataa",
  FORMATION_SANITAIRE: "Formation sanitaire",
  GAS_PROGRAMME_NATIONAL: "GAS Programme national",
};

const LIBELLE_STATUT_REQ = {
  EN_ATTENTE: "En attente",
  MODIFIEE_EN_ATTENTE_CONFIRMATION: "Modifiée, en attente",
  REJETEE_POUR_CORRECTION: "Rejetée, à corriger",
  VALIDEE: "Validée",
  EXPEDIEE: "Expédiée",
  CLOTUREE: "Clôturée",
  SCINDEE: "Scindée",
  REJETEE: "Rejetée",
  BROUILLON: "Brouillon",
};

const LIBELLE_STATUT_STOCK = {
  RUPTURE: "Rupture",
  RUPTURE_PARTIELLE: "Rupture partielle",
  SOUS_SEUIL: "Sous le seuil",
  NORMAL: "Normal",
};

const LIBELLE_FEU = {
  VERT: "Satisfaisant",
  ORANGE: "À surveiller",
  ROUGE: "Critique",
  GRIS: "Non évalué",
};

const LIBELLE_GRAVITE = {
  CRITIQUE: "Critique",
  ATTENTION: "À surveiller",
};

const MOIS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

function nombre(valeur) {
  if (valeur === null || valeur === undefined) return "—";
  return Number(valeur).toLocaleString("fr-FR");
}

function pct(valeur) {
  if (valeur === null || valeur === undefined) return "—";
  return String(valeur).replace(".", ",") + " %";
}

function dateCourte(iso) {
  return new Date(iso).toLocaleDateString("fr-FR");
}

function dateHeure(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR") + " à " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function etiquettePeriode(cle, pas) {
  const morceaux = cle.split("-");
  if (pas === "MOIS") return MOIS_COURTS[Number(morceaux[1]) - 1] + " " + morceaux[0].slice(2);
  return morceaux[2] + "/" + morceaux[1];
}

function texteVariation(indicateur) {
  if (indicateur.variationPct === null || indicateur.variationPct === undefined) {
    return indicateur.precedente === 0 ? "Aucune donnée sur la période précédente" : "—";
  }
  const signe = indicateur.variationPct > 0 ? "+" : "";
  return signe + String(indicateur.variationPct).replace(".", ",") + " % par rapport à la période précédente";
}

function Indicateur({ titre, valeur, detail, ton }) {
  return (
    <div className={"fiche-indicateur" + (ton ? " fiche-indicateur--" + ton : "")}>
      <span className="fiche-indicateur-titre">{titre}</span>
      <span className="fiche-indicateur-valeur">{valeur}</span>
      {detail && <span className="fiche-indicateur-detail">{detail}</span>}
    </div>
  );
}

function BarresVerticales({ points, cle, couleur, pas }) {
  const max = Math.max(1, ...points.map((p) => p[cle]));
  const total = points.reduce((t, p) => t + p[cle], 0);
  if (points.length === 0 || total === 0) {
    return <p className="fiche-vide">Aucun mouvement sur la période.</p>;
  }
  const pasEtiquette = Math.ceil(points.length / 8);
  return (
    <div className="fiche-barres-v">
      {points.map((p, i) => (
        <div className="fiche-barre-v-col" key={p.periode}>
          <span className="fiche-barre-v-valeur">{p[cle] > 0 ? nombre(p[cle]) : ""}</span>
          <div className="fiche-barre-v-zone">
            <div className="fiche-barre-v" style={{ height: (p[cle] / max) * 100 + "%", background: couleur }} />
          </div>
          <span className="fiche-barre-v-etiquette">{i % pasEtiquette === 0 ? etiquettePeriode(p.periode, pas) : ""}</span>
        </div>
      ))}
    </div>
  );
}

function BarresMoisStock({ produits }) {
  const lignes = produits.slice(0, 12);
  if (lignes.length === 0) return <p className="fiche-vide">Aucun produit suivi.</p>;
  const MAX_MOIS = 6;
  return (
    <div className="fiche-barres-h">
      {lignes.map((p) => {
        const mois = p.moisStock;
        const largeur = mois === null ? 0 : (Math.min(mois, MAX_MOIS) / MAX_MOIS) * 100;
        const couleur = p.statut === "RUPTURE" ? "#b3492f" : mois === null ? "#9aa5b1" : mois < 1 ? "#b3492f" : mois < 3 ? "#c99a4b" : "#2f7a4f";
        return (
          <div className="fiche-barre-h-ligne" key={p.produitId}>
            <span className="fiche-barre-h-nom" title={p.produit}>{p.produit}</span>
            <div className="fiche-barre-h-piste">
              <span className="fiche-repere" style={{ left: (1 / MAX_MOIS) * 100 + "%" }} />
              <span className="fiche-repere" style={{ left: (3 / MAX_MOIS) * 100 + "%" }} />
              <div className="fiche-barre-h" style={{ width: largeur + "%", background: couleur }} />
            </div>
            <span className="fiche-barre-h-valeur">
              {p.statut === "RUPTURE" ? "Rupture" : mois === null ? "Pas de consommation" : (mois > 99 ? "> 99" : String(mois).replace(".", ",")) + " mois"}
            </span>
          </div>
        );
      })}
      <p className="fiche-legende">Repères verticaux : 1 mois et 3 mois de stock. Au-delà de 6 mois, la barre est plafonnée.</p>
    </div>
  );
}

function BarresStatutReq({ parStatut }) {
  const entrees = Object.entries(parStatut || {});
  if (entrees.length === 0) return <p className="fiche-vide">Aucune réquisition.</p>;
  const max = Math.max(1, ...entrees.map(([, n]) => n));
  return (
    <div className="fiche-barres-h">
      {entrees.map(([statut, n]) => (
        <div className="fiche-barre-h-ligne" key={statut}>
          <span className="fiche-barre-h-nom">{LIBELLE_STATUT_REQ[statut] || statut}</span>
          <div className="fiche-barre-h-piste">
            <div className="fiche-barre-h" style={{ width: (n / max) * 100 + "%", background: "#3f6b8f" }} />
          </div>
          <span className="fiche-barre-h-valeur">{n}</span>
        </div>
      ))}
    </div>
  );
}

export default function FicheSituation({ session }) {
  const [periode, setPeriode] = useState("90");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [fiche, setFiche] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [pdfEnCours, setPdfEnCours] = useState(false);

  async function charger() {
    if (periode === "perso" && (!dateDebut || !dateFin)) {
      setChargement(false);
      return;
    }
    setChargement(true);
    setErreur(null);
    try {
      const token = localStorage.getItem("SYGIMS_token") || localStorage.getItem("gesmed_token");
      const requete = periode === "perso" ? `dateDebut=${dateDebut}&dateFin=${dateFin}` : `jours=${periode}`;
      const reponse = await fetch(`${API_URL}/rapports/fiche-situation?${requete}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const donnees = await reponse.json();
      if (!reponse.ok) throw new Error(donnees.erreur || "Erreur de chargement.");
      setFiche(donnees);
    } catch (e) {
      setErreur(e.message || "Impossible de charger la fiche de situation.");
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    charger();
  }, [periode]);

  async function telechargerPdf() {
    const feuille = document.querySelector('.fiche-feuille');
    if (!feuille || !fiche || pdfEnCours) return;
    setPdfEnCours(true);
    setErreur(null);
    try {
      const modules = await Promise.all([import('html2canvas'), import('jspdf')]);
      const html2canvas = modules[0].default;
      const JsPdf = modules[1].jsPDF;

      const SELECTEURS = '.fiche-section, .fiche-section > h3, .fiche-feux, .fiche-indicateurs, .fiche-graphique, .fiche-table tbody tr, .fiche-point, .fiche-pied';
      const ECHELLE = 1.8;
      let coupures = [];
      let largeurCss = 0;
      let hauteurCss = 0;

      const canvas = await html2canvas(feuille, {
        scale: ECHELLE,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        windowWidth: 1000,
        onclone: (docClone) => {
          const f = docClone.querySelector('.fiche-feuille');
          if (!f) return;
          f.style.boxShadow = 'none';
          f.style.border = 'none';
          f.style.borderRadius = '0';
          f.style.margin = '0';
          f.style.padding = '0';
          f.style.maxWidth = 'none';
          f.style.width = '900px';
          Array.from(f.querySelectorAll('.fiche-table-wrap')).forEach((w) => { w.style.overflow = 'visible'; });
          const rect = f.getBoundingClientRect();
          largeurCss = rect.width;
          hauteurCss = rect.height;
          coupures = Array.from(f.querySelectorAll(SELECTEURS))
            .filter((e) => {
              const prec = e.previousElementSibling;
              if (prec && /^H[23]$/.test(prec.tagName)) return false;
              if (e.tagName === 'TR' && e.parentElement.firstElementChild === e) return false;
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

      const pdf = new JsPdf({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      pages.forEach((p, i) => {
        if (i > 0) pdf.addPage();
        const sy = Math.round(p[0] * ratio);
        const sh = Math.max(1, Math.min(canvas.height - sy, Math.round((p[1] - p[0]) * ratio)));
        const tranche = document.createElement('canvas');
        tranche.width = canvas.width;
        tranche.height = sh;
        const ctx = tranche.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, tranche.width, tranche.height);
        ctx.drawImage(canvas, 0, sy, canvas.width, sh, 0, 0, canvas.width, sh);
        pdf.addImage(tranche.toDataURL('image/jpeg', 0.92), 'JPEG', 10, 10, largeurMm, (sh * largeurMm) / canvas.width);
        pdf.setFontSize(8);
        pdf.setTextColor(110);
        pdf.text('SYGIMS - Fiche de situation', 10, 291);
        pdf.text('Page ' + (i + 1) + ' / ' + pages.length, 200, 291, { align: 'right' });
      });

      const nom = String(fiche.entete.structure).replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      pdf.save('Fiche-situation-' + nom + '-' + new Date().toISOString().slice(0, 10) + '.pdf');
    } catch (e) {
      setErreur('Impossible de générer le PDF : ' + (e && e.message ? e.message : e));
    } finally {
      setPdfEnCours(false);
    }
  }

  function imprimer() {
    const feuille = document.querySelector('.fiche-feuille');
    if (!feuille || !fiche) return;

    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map((n) => (n.tagName === 'LINK' ? '<link rel="stylesheet" href="' + n.href + '">' : n.outerHTML))
      .join('\n');
    const titre = 'Fiche de situation - ' + fiche.entete.structure;

    const cadre = document.createElement('iframe');
    cadre.style.position = 'fixed';
    cadre.style.right = '0';
    cadre.style.bottom = '0';
    cadre.style.width = '0';
    cadre.style.height = '0';
    cadre.style.border = '0';
    document.body.appendChild(cadre);

    const doc = cadre.contentWindow.document;
    doc.open();
    doc.write(
      '<!doctype html><html lang="fr"><head><meta charset="utf-8"><title></title>' +
        styles +
        '<style>html,body{background:#fff !important;margin:0;padding:0;height:auto !important;overflow:visible !important;}' +
        '.fiche-feuille{box-shadow:none;border:none;border-radius:0;padding:0;max-width:none;margin:0;}</style>' +
        '</head><body><div class="fiche-page">' +
        feuille.outerHTML +
        '</div></body></html>'
    );
    doc.close();
    doc.title = titre;

    const ancienTitre = document.title;
    document.title = titre;

    cadre.contentWindow.onafterprint = () => {
      document.title = ancienTitre;
      if (cadre.parentNode) cadre.parentNode.removeChild(cadre);
    };

    setTimeout(() => {
      cadre.contentWindow.focus();
      cadre.contentWindow.print();
    }, 800);
  }

  const ind = fiche ? fiche.indicateurs : null;
  const plusieursStructures = fiche ? fiche.entete.nbStructures > 1 : false;
  const niveauLibelle = fiche ? LIBELLE_NIVEAU[fiche.entete.niveau] || fiche.entete.niveau : "";

  return (
    <div className="fiche-page">
      <div className="fiche-outils">
        <label>
          Période
          <select value={periode} onChange={(e) => setPeriode(e.target.value)}>
            {PERIODES.map((p) => (
              <option key={p.valeur} value={p.valeur}>{p.libelle}</option>
            ))}
          </select>
        </label>
        {periode === "perso" && (
          <>
            <label>
              Du
              <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} />
            </label>
            <label>
              Au
              <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} />
            </label>
            <button type="button" onClick={charger}>Appliquer</button>
          </>
        )}
        <button type="button" onClick={charger}>Actualiser</button>
        <button type="button" className="fiche-bouton-principal" onClick={telechargerPdf} disabled={!fiche || pdfEnCours}>
          {pdfEnCours ? 'Génération du PDF…' : 'Télécharger le PDF'}
        </button>
        <button type="button" onClick={imprimer} disabled={!fiche}>
          Imprimer
        </button>
        {chargement && fiche && <span className="fiche-actualisation">Actualisation…</span>}
      </div>

      {erreur && <p className="fiche-erreur" role="alert">{erreur}</p>}
      {!fiche && chargement && <p>Chargement de la fiche…</p>}
      {!fiche && !chargement && !erreur && periode === "perso" && <p>Choisissez les deux dates puis cliquez sur « Appliquer ».</p>}

      {fiche && (
        <article className="fiche-feuille">
          <header className="fiche-entete-officiel">
            <div className="fiche-entete-col">
              <strong>République Islamique de Mauritanie</strong>
              <span>Honneur – Fraternité – Justice</span>
            </div>
            <div className="fiche-entete-col fiche-entete-col--centre">
              <strong>Ministère de la Santé</strong>
            </div>
            <div className="fiche-entete-col fiche-entete-col--droite">
              <strong>SYGIMS</strong>
              <span>Fiche générée automatiquement</span>
            </div>
          </header>

          <div className="fiche-titre">
            <h1>Fiche de situation</h1>
            <p className="fiche-titre-structure">{fiche.entete.structure} — {niveauLibelle}</p>
            <p className="fiche-titre-meta">
              Période du {dateCourte(fiche.entete.debut)} au {dateCourte(fiche.entete.fin)} · Édité le {dateHeure(fiche.entete.editeLe)}
            </p>
          </div>

          <section className="fiche-section">
            <h2>1. Synthèse</h2>
            <div className="fiche-feux">
              {fiche.synthese.feux.map((feu) => (
                <div className={"fiche-feu fiche-feu--" + feu.etat.toLowerCase()} key={feu.domaine}>
                  <span className="fiche-feu-pastille" />
                  <div>
                    <strong>{feu.domaine}</strong>
                    <span className="fiche-feu-etat">{LIBELLE_FEU[feu.etat]}</span>
                    {feu.valeur && <span className="fiche-feu-valeur">{feu.valeur}</span>}
                  </div>
                </div>
              ))}
            </div>
            <p className="fiche-conclusion">{fiche.synthese.conclusion}</p>
          </section>

          <section className="fiche-section">
            <h2>2. Indicateurs clés</h2>
            <div className="fiche-indicateurs">
              <Indicateur
                titre="Disponibilité des produits"
                valeur={ind.tauxDisponibilite === null ? "—" : String(ind.tauxDisponibilite).replace(".", ",") + " %"}
                detail={`${ind.lignesRupture} rupture(s) sur ${ind.lignesTotal} lignes de stock`}
                ton={fiche.synthese.feux[0].etat.toLowerCase()}
              />
              <Indicateur
                titre="Produits suivis"
                valeur={nombre(ind.produitsSuivis)}
                detail={`${ind.lignesSousSeuil} ligne(s) sous le seuil minimum`}
              />
              <Indicateur titre="Quantités dispensées" valeur={nombre(ind.consommation.valeur)} detail={texteVariation(ind.consommation)} />
              <Indicateur titre="Quantités reçues" valeur={nombre(ind.entrees.valeur)} detail={texteVariation(ind.entrees)} />
              <Indicateur
                titre="Pertes (destructions)"
                valeur={nombre(ind.pertes.valeur)}
                detail={ind.pertes.valeurMonetaire > 0 ? "Valeur estimée : " + nombre(ind.pertes.valeurMonetaire) : texteVariation(ind.pertes)}
              />
              <Indicateur
                titre="Durée de rupture (la plus longue)"
                valeur={ind.rupture && ind.rupture.joursMax !== null ? ind.rupture.joursMax + " j" : ind.lignesRupture > 0 ? "n.d." : "Aucune"}
                detail={ind.rupture ? ind.rupture.produitsEnRupture + " produit(s) en rupture · " + ind.rupture.plusDe30Jours + " de plus de 30 jours" : undefined}
                ton={ind.rupture && ind.rupture.plusDe30Jours > 0 ? "rouge" : undefined}
              />
              <Indicateur
                titre="Réquisitions en cours"
                valeur={nombre(fiche.requisitions.ouvertes)}
                detail={`${fiche.requisitions.nbEnRetard} en retard (plus de ${fiche.requisitions.seuilRetardJours} jours)`}
                ton={fiche.synthese.feux[2].etat.toLowerCase()}
              />
            </div>
            <p className="fiche-legende">
              Le stock et la disponibilité sont ceux d'aujourd'hui. Les quantités sont comparées à la période précédente de même durée.
            </p>
          </section>

          {fiche.offreService && (
            <section className="fiche-section">
              <h2>3. Offre de service</h2>
              {fiche.offreService.nbFosa === 0 || fiche.offreService.nbServices === 0 ? (
                <p className="fiche-vide">Aucune donnée d'offre de service pour ce périmètre.</p>
              ) : (
                <>
                  <div className="fiche-indicateurs">
                    <Indicateur
                      titre="Score officiel · services éligibles"
                      valeur={pct(fiche.offreService.officiel.couvertureEligibles)}
                      detail={fiche.offreService.officiel.points + " / " + fiche.offreService.officiel.pointsEligibles + " points"}
                      ton={fiche.synthese.feux[3] ? fiche.synthese.feux[3].etat.toLowerCase() : undefined}
                    />
                    <Indicateur
                      titre="Score officiel · tous les services"
                      valeur={pct(fiche.offreService.officiel.couvertureTotale)}
                      detail={fiche.offreService.officiel.points + " / " + fiche.offreService.officiel.pointsTotal + " points"}
                    />
                    {fiche.offreService.nbFosa === 1 && (
                      <Indicateur
                        titre="Score provisoire · services éligibles"
                        valeur={pct(fiche.offreService.provisoire.couvertureEligibles)}
                        detail="Avec les réponses en attente de validation"
                      />
                    )}
                    <Indicateur
                      titre="Réponses en attente de validation"
                      valeur={nombre(fiche.offreService.reponsesEnAttente)}
                      detail={fiche.offreService.servicesNonRenseignes + " service(s) éligible(s) non renseigné(s)"}
                    />
                  </div>
                  {fiche.offreService.parProgramme.length > 0 && (
                    <>
                      <h3 className="fiche-sous-titre">Couverture par programme (score officiel)</h3>
                      <div className="fiche-table-wrap">
                        <table className="fiche-table">
                          <thead>
                            <tr>
                              <th>Programme</th>
                              <th className="fiche-num">Services éligibles</th>
                              <th className="fiche-num">Tous les services</th>
                            </tr>
                          </thead>
                          <tbody>
                            {fiche.offreService.parProgramme.map((p) => (
                              <tr key={p.code}>
                                <td>{p.nom}</td>
                                <td className="fiche-num">{pct(p.couvertureEligibles)}</td>
                                <td className="fiche-num">{pct(p.couvertureTotale)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                  {fiche.offreService.fosasFaibles.length > 0 && (
                    <>
                      <h3 className="fiche-sous-titre">Structures les moins couvertes (services éligibles)</h3>
                      <div className="fiche-table-wrap">
                        <table className="fiche-table">
                          <thead>
                            <tr>
                              <th>Structure</th>
                              <th className="fiche-num">Couverture officielle</th>
                              <th className="fiche-num">Points</th>
                            </tr>
                          </thead>
                          <tbody>
                            {fiche.offreService.fosasFaibles.map((f) => (
                              <tr key={f.etablissementId}>
                                <td>{f.nom}</td>
                                <td className="fiche-num">{pct(f.couverture)}</td>
                                <td className="fiche-num">{f.points + " / " + f.pointsEligibles}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </>
              )}
              <p className="fiche-legende">
                Seules les réponses validées par le Médecin chef de moughataa comptent dans le score officiel. Chaque service compte selon son poids ; seuls les services éligibles à la structure sont pris en compte.
              </p>
            </section>
          )}

          {fiche.performanceGestion && (
            <section className="fiche-section">
              <h2>4. Performance de gestion</h2>
              <div className="fiche-performance">
                <div
                  className={
                    "fiche-indice " +
                    (fiche.performanceGestion.indice === null
                      ? ""
                      : fiche.performanceGestion.indice >= 75
                      ? "fiche-indice--vert"
                      : fiche.performanceGestion.indice >= 50
                      ? "fiche-indice--orange"
                      : "fiche-indice--rouge")
                  }
                >
                  <span className="fiche-indice-valeur">
                    {fiche.performanceGestion.indice === null ? "—" : String(fiche.performanceGestion.indice).replace(".", ",")}
                  </span>
                  <span className="fiche-indice-sur">sur 100</span>
                </div>
                <div className="fiche-barres-h">
                  {fiche.performanceGestion.composantes.map((c) => (
                    <div className="fiche-barre-h-ligne" key={c.code}>
                      <span className="fiche-barre-h-nom" title={c.libelle}>{c.libelle + " (" + c.poids + " %)"}</span>
                      <div className="fiche-barre-h-piste">
                        <div
                          className="fiche-barre-h"
                          style={{
                            width: (c.score === null ? 0 : c.score) + "%",
                            background: c.score === null ? "#9aa5b1" : c.score >= 75 ? "#2f7a4f" : c.score >= 50 ? "#c99a4b" : "#b3492f",
                          }}
                        />
                      </div>
                      <span className="fiche-barre-h-valeur">{c.score === null ? "Non évalué" : String(c.score).replace(".", ",") + " / 100"}</span>
                    </div>
                  ))}
                </div>
              </div>
              <p className="fiche-legende">
                L'indice est la moyenne pondérée des quatre composantes ci-dessus (poids entre parenthèses). Il permet de comparer les structures entre elles.
              </p>
            </section>
          )}

          <section className="fiche-section">
            <h2>5. Graphiques</h2>
            <div className="fiche-graphiques">
              <div className="fiche-graphique">
                <h3>Quantités dispensées</h3>
                <BarresVerticales points={fiche.serie.points} cle="dispensations" couleur="#2f7a4f" pas={fiche.serie.pas} />
              </div>
              <div className="fiche-graphique">
                <h3>Quantités reçues</h3>
                <BarresVerticales points={fiche.serie.points} cle="entrees" couleur="#3f6b8f" pas={fiche.serie.pas} />
              </div>
              <div className="fiche-graphique">
                <h3>Mois de stock par produit</h3>
                <BarresMoisStock produits={fiche.produits} />
              </div>
              <div className="fiche-graphique">
                <h3>Réquisitions par statut</h3>
                <BarresStatutReq parStatut={fiche.requisitions.parStatut} />
              </div>
            </div>
          </section>

          <section className="fiche-section">
            <h2>6. Situation du stock par produit</h2>
            {fiche.produits.length === 0 ? (
              <p className="fiche-vide">Aucun produit suivi.</p>
            ) : (
              <div className="fiche-table-wrap">
                <table className="fiche-table">
                  <thead>
                    <tr>
                      <th>Produit</th>
                      <th className="fiche-num">Stock actuel</th>
                      <th className="fiche-num">Seuil min.</th>
                      <th className="fiche-num">Dispensé / mois</th>
                      <th className="fiche-num">Mois de stock</th>
                      <th className="fiche-num">Jours de rupture</th>
                      {plusieursStructures && <th className="fiche-num">Structures en rupture</th>}
                      <th>Situation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fiche.produits.map((p) => (
                      <tr key={p.produitId}>
                        <td>{p.produit}</td>
                        <td className="fiche-num">{nombre(p.stock)}</td>
                        <td className="fiche-num">{nombre(p.seuilMin)}</td>
                        <td className="fiche-num">{nombre(p.consoMensuelle)}</td>
                        <td className="fiche-num">{p.moisStock === null ? "—" : (p.moisStock > 99 ? "> 99" : String(p.moisStock).replace(".", ","))}</td>
                        <td className="fiche-num">{p.enRupture === 0 ? "—" : p.joursRuptureMax === null ? "n.d." : p.joursRuptureMax > 0 ? p.joursRuptureMax + " j" : "< 1 j"}</td>
                        {plusieursStructures && <td className="fiche-num">{p.enRupture} / {p.structures}</td>}
                        <td>
                          <span className={"fiche-pastille-texte fiche-pastille-texte--" + p.alerte.toLowerCase()}>
                            {LIBELLE_STATUT_STOCK[p.statut]}
                            {p.alerte === "CRITIQUE" && p.statut !== "RUPTURE" ? " · stock très bas" : ""}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {fiche.etablissementsARisque.length > 0 && (
            <section className="fiche-section">
              <h2>7. Structures à risque</h2>
              <div className="fiche-table-wrap">
                <table className="fiche-table">
                  <thead>
                    <tr>
                      <th>Structure</th>
                      <th>Niveau</th>
                      <th className="fiche-num">Ruptures</th>
                      <th className="fiche-num">Sous le seuil</th>
                      <th className="fiche-num">Disponibilité</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fiche.etablissementsARisque.map((e) => (
                      <tr key={e.etablissementId}>
                        <td>{e.nom}</td>
                        <td>{LIBELLE_NIVEAU[e.type] || e.type}</td>
                        <td className="fiche-num">{e.ruptures}</td>
                        <td className="fiche-num">{e.sousSeuil}</td>
                        <td className="fiche-num">{String(e.tauxDisponibilite).replace(".", ",")} %</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="fiche-section">
            <h2>{fiche.etablissementsARisque.length > 0 ? "8" : "7"}. Péremptions</h2>
            <h3 className="fiche-sous-titre">
              Lots périmés encore en stock, à détruire ({fiche.peremptions.perimesNonDetruits.nbLots} lot(s), {nombre(fiche.peremptions.perimesNonDetruits.quantite)} unités)
            </h3>
            {fiche.peremptions.perimesNonDetruits.lots.length === 0 ? (
              <p className="fiche-vide">Aucun lot périmé en stock.</p>
            ) : (
              <div className="fiche-table-wrap">
                <table className="fiche-table">
                  <thead>
                    <tr>
                      <th>Produit</th>
                      <th>Lot</th>
                      {plusieursStructures && <th>Structure</th>}
                      <th className="fiche-num">Quantité</th>
                      <th>Péremption</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fiche.peremptions.perimesNonDetruits.lots.map((l, i) => (
                      <tr key={"p" + i}>
                        <td>{l.produit}</td>
                        <td>{l.numeroLot}</td>
                        {plusieursStructures && <td>{l.etablissement}</td>}
                        <td className="fiche-num">{nombre(l.quantite)}</td>
                        <td>{dateCourte(l.datePeremption)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <h3 className="fiche-sous-titre">
              Lots qui périment sous 3 mois ({fiche.peremptions.sousTroisMois.nbLots} lot(s), {nombre(fiche.peremptions.sousTroisMois.quantite)} unités)
            </h3>
            {fiche.peremptions.sousTroisMois.lots.length === 0 ? (
              <p className="fiche-vide">Aucun lot ne périme dans les 3 prochains mois.</p>
            ) : (
              <div className="fiche-table-wrap">
                <table className="fiche-table">
                  <thead>
                    <tr>
                      <th>Produit</th>
                      <th>Lot</th>
                      {plusieursStructures && <th>Structure</th>}
                      <th className="fiche-num">Quantité</th>
                      <th>Péremption</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fiche.peremptions.sousTroisMois.lots.map((l, i) => (
                      <tr key={"a" + i}>
                        <td>{l.produit}</td>
                        <td>{l.numeroLot}</td>
                        {plusieursStructures && <td>{l.etablissement}</td>}
                        <td className="fiche-num">{nombre(l.quantite)}</td>
                        <td>{dateCourte(l.datePeremption)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="fiche-section">
            <h2>{fiche.etablissementsARisque.length > 0 ? "9" : "8"}. Réquisitions en retard</h2>
            {fiche.requisitions.enRetard.length === 0 ? (
              <p className="fiche-vide">Aucune réquisition en retard.</p>
            ) : (
              <div className="fiche-table-wrap">
                <table className="fiche-table">
                  <thead>
                    <tr>
                      <th>N°</th>
                      {plusieursStructures && <th>Demandeur</th>}
                      <th>Statut</th>
                      <th>Bloquée chez</th>
                      <th className="fiche-num">Ancienneté (jours)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fiche.requisitions.enRetard.map((r) => (
                      <tr key={r.numero}>
                        <td>{r.numero}</td>
                        {plusieursStructures && <td>{r.demandeur}</td>}
                        <td>{LIBELLE_STATUT_REQ[r.statut] || r.statut}</td>
                        <td>{r.niveauActuel || "—"}</td>
                        <td className="fiche-num">{r.ageJours}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {fiche.requisitions.nbEnRetard > fiche.requisitions.enRetard.length && (
              <p className="fiche-legende">Les {fiche.requisitions.enRetard.length} plus anciennes sont affichées sur {fiche.requisitions.nbEnRetard}.</p>
            )}
          </section>

          <section className="fiche-section">
            <h2>{fiche.etablissementsARisque.length > 0 ? "10" : "9"}. Points à traiter</h2>
            {fiche.pointsATraiter.length === 0 ? (
              <p className="fiche-vide">Aucun point critique à signaler.</p>
            ) : (
              <ul className="fiche-points">
                {fiche.pointsATraiter.map((p, i) => (
                  <li key={i} className={"fiche-point fiche-point--" + p.gravite.toLowerCase()}>
                    <span className="fiche-point-badge">{LIBELLE_GRAVITE[p.gravite]}</span>
                    <div>
                      <strong>{p.domaine} — {p.texte}</strong>
                      {p.detail && <span className="fiche-point-detail">{p.detail}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <footer className="fiche-pied">
            <div className="fiche-signatures">
              <div className="fiche-signature">Établi par<br /><br /><br />Nom, fonction et date</div>
              <div className="fiche-signature">Visa du responsable<br /><br /><br />Signature et cachet</div>
            </div>
            <p className="fiche-legende">
              Document généré par SYGIMS le {dateHeure(fiche.entete.editeLe)}. L'état des stocks est celui de cette date ; les flux portent sur la période indiquée.
            </p>
          </footer>
        </article>
      )}
    </div>
  );
}