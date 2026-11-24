// ExpeditionsAxes.jsx - Expeditions par axe pour le CAMEC : planning, wilayas, commandes en attente, depart.
import { useCallback, useEffect, useState } from "react";
import "./AdminPanel.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

function jeton() {
  return localStorage.getItem("SYGIMS_token") || localStorage.getItem("gesmed_token");
}

async function appeler(chemin, options) {
  const res = await fetch(`${API_URL}${chemin}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${jeton()}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    throw new Error((data && data.erreur) || "Le serveur n'a pas r\u00e9pondu comme pr\u00e9vu.");
  }
  return data;
}

const CSS_EXPEDITIONS = `
.exp-page { text-align: left; }
.exp-actions { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0 4px; }
.exp-bouton { padding: 8px 14px; border-radius: 8px; border: 1px solid #b5b5b5; background: #fff; cursor: pointer; font-size: 0.9rem; }
.exp-bouton:hover { background: #f3f4f6; }
.exp-bouton:disabled { opacity: 0.55; cursor: not-allowed; }
.exp-bouton-plein { background: #1f7a3d; border-color: #1f7a3d; color: #fff; }
.exp-bouton-plein:hover { background: #17612f; }
.exp-aide { font-size: 0.88rem; margin: 10px 0 14px; color: #4b5563; }
.exp-grille { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 16px; align-items: start; }
.exp-carte { border: 1px solid #e2e2e2; border-radius: 14px; background: #fff; padding: 16px; box-sizing: border-box; min-width: 0; }
.exp-carte-titre { display: flex; flex-wrap: wrap; gap: 8px; align-items: baseline; justify-content: space-between; margin: 0 0 4px; }
.exp-carte-titre h2 { margin: 0; font-size: 1.15rem; }
.exp-pastille { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 0.78rem; font-weight: 600; border: 1px solid #c9c9c9; background: #f3f4f6; color: #374151; }
.exp-pastille-ok { background: #e7f4ec; border-color: #9fd0b0; color: #17612f; }
.exp-pastille-alerte { background: #fdecea; border-color: #f1b0aa; color: #b3261e; }
.exp-pastille-attente { background: #fff4e0; border-color: #f0cf94; color: #8a5200; }
.exp-wilayas { margin: 2px 0 12px; font-size: 0.9rem; color: #4b5563; }
.exp-infos { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 14px; margin: 0 0 12px; }
.exp-info-etiquette { font-size: 0.75rem; color: #6b7280; text-transform: uppercase; letter-spacing: 0.03em; }
.exp-info-valeur { font-size: 0.97rem; font-weight: 600; }
.exp-formulaire { border: 1px dashed #b5b5b5; border-radius: 10px; padding: 10px 12px; margin: 0 0 12px; background: #fafafa; }
.exp-formulaire label { display: block; font-size: 0.82rem; color: #4b5563; margin: 6px 0 2px; }
.exp-champ { padding: 7px 9px; border-radius: 8px; border: 1px solid #b5b5b5; width: 100%; box-sizing: border-box; background: #fff; }
.exp-ligne-boutons { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.exp-section { font-size: 0.82rem; font-weight: 700; color: #4b5563; text-transform: uppercase; letter-spacing: 0.03em; margin: 12px 0 6px; }
.exp-vide { font-size: 0.9rem; color: #6b7280; margin: 6px 0; }
.exp-tableau-cadre { overflow-x: auto; border: 1px solid #eee; border-radius: 10px; }
.exp-tableau { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
.exp-th { padding: 7px 8px; border-bottom: 2px solid #d4d4d4; text-align: right; font-size: 0.78rem; color: #4b5563; background: #fafafa; white-space: nowrap; }
.exp-td { padding: 6px 8px; border-bottom: 1px solid #f0f0f0; text-align: right; }
.exp-gauche { text-align: left; }
.exp-insuffisant { color: #b3261e; font-weight: 700; }
.exp-liste { margin: 4px 0 0; padding-left: 18px; font-size: 0.88rem; }
.exp-message { margin: 10px 0; padding: 8px 12px; border-radius: 8px; font-size: 0.9rem; }
.exp-message-ok { background: #e7f4ec; border: 1px solid #9fd0b0; color: #17612f; }
.exp-message-erreur { background: #fdecea; border: 1px solid #f1b0aa; color: #b3261e; }
@media (max-width: 640px) { .exp-grille { grid-template-columns: 1fr; } .exp-infos { grid-template-columns: 1fr; } }
`;

const LIBELLE_VEHICULE = { MINIBUS: "Minibus", CAMION: "Camion", AMBULANCE: "Ambulance", AUTRE: "Autre" };

function formaterDate(valeur) {
  if (!valeur) return null;
  const d = new Date(valeur);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function versChampDate(valeur) {
  if (!valeur) return "";
  const d = new Date(valeur);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function ajouterJours(valeur, jours) {
  const d = new Date(valeur);
  d.setUTCDate(d.getUTCDate() + Number(jours));
  return d;
}

function libelleFrequence(jours) {
  if (!jours) return "Non d\u00e9finie";
  if (jours % 30 === 0) return "Tous les " + jours / 30 + " mois (" + jours + " j)";
  return "Tous les " + jours + " jours";
}

function nomWilaya(drs) {
  return String(drs.nom || drs.code).replace(/^DRS\s+/i, "");
}

const PARTENAIRES = { ZOUERAT: "NDB", NDB: "ZOUERAT" };

function CarteAxe({ ligne, partenaire, onChange }) {
  const axe = ligne.axe;
  const [edition, setEdition] = useState(false);
  const [frequence, setFrequence] = useState("");
  const [duree, setDuree] = useState("");
  const [vehicule, setVehicule] = useState("");
  const [depart, setDepart] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState(null);
  const [voirCommandes, setVoirCommandes] = useState(false);

  function ouvrirEdition() {
    setFrequence(axe.frequenceJours ? String(axe.frequenceJours) : "");
    setDuree(axe.dureeLivraisonJours ? String(axe.dureeLivraisonJours) : "");
    setVehicule(axe.vehicule || "");
    setDepart(versChampDate(axe.prochainDepartPrevu));
    setMessage(null);
    setEdition(true);
  }

  async function enregistrer() {
    setEnCours(true);
    setMessage(null);
    try {
      await appeler(`/distribution/axes/${axe.id}/planning`, {
        method: "PUT",
        body: JSON.stringify({
          frequenceJours: frequence === "" ? null : Number(frequence),
          dureeLivraisonJours: duree === "" ? null : Number(duree),
          vehicule: vehicule === "" ? null : vehicule,
          prochainDepartPrevu: depart === "" ? null : depart,
        }),
      });
      setEdition(false);
      setMessage({ type: "ok", texte: "Planning enregistr\u00e9." });
      await onChange();
    } catch (e) {
      setMessage({ type: "erreur", texte: e.message });
    } finally {
      setEnCours(false);
    }
  }

  async function expedier() {
    const question =
      "Exp\u00e9dier l'axe " + axe.nom + " ?\n\n" +
      ligne.nombreCommandes + " commande(s) pour " + ligne.nombreDestinataires +
      " destinataire(s). Les bordereaux de livraison seront g\u00e9n\u00e9r\u00e9s et le stock du CAMEC sera d\u00e9bit\u00e9.";
    const manques = ligne.totauxParProduit.filter((t) => !t.suffisant);
    let alerte = "";
    if (manques.length > 0) {
      alerte = "\n\nATTENTION - stock insuffisant au CAMEC pour " + manques.length + " produit(s) :\n" +
        manques.map((t) => "- " + t.produit + " : demand\u00e9 " + t.quantite + ", en stock " + t.stockDisponible + ", manque " + (t.quantite - t.stockDisponible)).join("\n") +
        "\n\nLes commandes seront livr\u00e9es partiellement, dans l'ordre des num\u00e9ros ; le manque restera en reliquat.";
    }
    if (!window.confirm(question + alerte)) return;
    setEnCours(true);
    setMessage(null);
    try {
      const data = await appeler(`/distribution/axes/${axe.id}/expedier`, { method: "POST", body: "{}" });
      const rapport = data.rapport || [];
      const expediees = rapport.filter((x) => x.expedie).length;
      const reliquats = rapport.filter((x) => x.reliquat).length;
      const erreurs = rapport.filter((x) => x.erreur);
      let texte = expediees + " commande(s) exp\u00e9di\u00e9e(s).";
      if (reliquats > 0) texte += " " + reliquats + " reliquat(s) remis en attente de validation.";
      if (erreurs.length > 0) {
        texte += " Probl\u00e8mes : " + erreurs.map((x) => "n\u00b0 " + x.numero + " (" + x.erreur + ")").join(" ; ");
      }
      setMessage({ type: erreurs.length > 0 ? "erreur" : "ok", texte });
      await onChange();
    } catch (e) {
      setMessage({ type: "erreur", texte: e.message });
    } finally {
      setEnCours(false);
    }
  }

  async function expedierAvecPartenaire() {
    const groupe = [ligne, partenaire];
    const totaux = new Map();
    for (const g of groupe) {
      for (const t of g.totauxParProduit) {
        const c = totaux.get(t.produitId) || { produit: t.produit, quantite: 0, stock: t.stockDisponible };
        c.quantite += t.quantite;
        totaux.set(t.produitId, c);
      }
    }
    const manques = Array.from(totaux.values()).filter((t) => t.quantite > t.stock);
    let alerte = "";
    if (manques.length > 0) {
      alerte = "\n\nATTENTION - stock insuffisant au CAMEC pour " + manques.length + " produit(s) (les deux axes ensemble) :\n" +
        manques.map((t) => "- " + t.produit + " : demand\u00e9 " + t.quantite + ", en stock " + t.stock + ", manque " + (t.quantite - t.stock)).join("\n") +
        "\n\nLes commandes seront livr\u00e9es partiellement, dans l'ordre des num\u00e9ros ; le manque restera en reliquat.";
    }
    const nbCommandes = groupe.reduce((n, g) => n + g.nombreCommandes, 0);
    const question =
      "Exp\u00e9dier ensemble les axes " + ligne.axe.nom + " et " + partenaire.axe.nom + " (d\u00e9part commun) ?\n\n" +
      nbCommandes + " commande(s) au total. Les bordereaux de livraison seront g\u00e9n\u00e9r\u00e9s et le stock du CAMEC sera d\u00e9bit\u00e9." + alerte;
    if (!window.confirm(question)) return;
    setEnCours(true);
    setMessage(null);
    try {
      let expediees = 0;
      let reliquats = 0;
      const erreurs = [];
      for (const g of groupe) {
        if (g.nombreCommandes === 0) continue;
        const data = await appeler("/distribution/axes/" + g.axe.id + "/expedier", { method: "POST", body: "{}" });
        const rapport = data.rapport || [];
        expediees += rapport.filter((x) => x.expedie).length;
        reliquats += rapport.filter((x) => x.reliquat).length;
        rapport.filter((x) => x.erreur).forEach((x) => erreurs.push("n\u00b0 " + x.numero + " (" + x.erreur + ")"));
      }
      let texte = "D\u00e9part commun : " + expediees + " commande(s) exp\u00e9di\u00e9e(s).";
      if (reliquats > 0) texte += " " + reliquats + " reliquat(s) remis en attente de validation.";
      if (erreurs.length > 0) texte += " Probl\u00e8mes : " + erreurs.join(" ; ");
      setMessage({ type: erreurs.length > 0 ? "erreur" : "ok", texte });
      await onChange();
    } catch (e) {
      setMessage({ type: "erreur", texte: e.message + " Un des deux axes a peut-\u00eatre d\u00e9j\u00e0 \u00e9t\u00e9 exp\u00e9di\u00e9 : actualisez la page." });
      await onChange();
    } finally {
      setEnCours(false);
    }
  }

  const depart_ = axe.prochainDepartPrevu || axe.prochainDepart;
  const enRetard = depart_ && new Date(depart_).getTime() < Date.now() && ligne.nombreCommandes > 0;
  let pastille = { classe: "exp-pastille exp-pastille-attente", texte: "D\u00e9part \u00e0 planifier" };
  if (depart_) pastille = { classe: "exp-pastille exp-pastille-ok", texte: "D\u00e9part pr\u00e9vu le " + formaterDate(depart_) };
  if (enRetard) pastille = { classe: "exp-pastille exp-pastille-alerte", texte: "D\u00e9part en retard (pr\u00e9vu le " + formaterDate(depart_) + ")" };

  const arrivee = depart_ && axe.dureeLivraisonJours ? ajouterJours(depart_, axe.dureeLivraisonJours) : null;
  const wilayas = (ligne.wilayas || []).map(nomWilaya).join("  \u203a  ");

  return (
    <section className="exp-carte">
      <div className="exp-carte-titre">
        <h2>{axe.nom}</h2>
        <span className={pastille.classe}>{pastille.texte}</span>
      </div>
      <p className="exp-wilayas">
        {wilayas ? "Wilayas desservies, dans l'ordre : " + wilayas : "Aucune wilaya rattach\u00e9e \u00e0 cet axe."}
      </p>

      <div className="exp-infos">
        <div>
          <div className="exp-info-etiquette">{"Fr\u00e9quence"}</div>
          <div className="exp-info-valeur">{libelleFrequence(axe.frequenceJours)}</div>
        </div>
        <div>
          <div className="exp-info-etiquette">{"Dur\u00e9e de la tourn\u00e9e"}</div>
          <div className="exp-info-valeur">{axe.dureeLivraisonJours ? axe.dureeLivraisonJours + " jours" : "Non d\u00e9finie"}</div>
        </div>
        <div>
          <div className="exp-info-etiquette">{"V\u00e9hicule"}</div>
          <div className="exp-info-valeur">{axe.vehicule ? LIBELLE_VEHICULE[axe.vehicule] : "\u00c0 choisir"}</div>
        </div>
        <div>
          <div className="exp-info-etiquette">{"Dernier d\u00e9part"}</div>
          <div className="exp-info-valeur">{formaterDate(axe.dernierDepartAt) || "Aucun"}</div>
        </div>
        <div>
          <div className="exp-info-etiquette">{"Arriv\u00e9e estim\u00e9e (fin de tourn\u00e9e)"}</div>
          <div className="exp-info-valeur">{arrivee ? formaterDate(arrivee) : "\u2014"}</div>
        </div>
        <div>
          <div className="exp-info-etiquette">Commandes en attente</div>
          <div className="exp-info-valeur">
            {ligne.nombreCommandes + " (" + ligne.nombreDestinataires + " destinataire" + (ligne.nombreDestinataires > 1 ? "s" : "") + ")"}
          </div>
        </div>
      </div>

      {edition ? (
        <div className="exp-formulaire">
          <label>{"Fr\u00e9quence (jours entre deux d\u00e9parts, ex. 90 = 3 mois)"}</label>
          <input className="exp-champ" type="number" min="1" max="366" value={frequence} onChange={(e) => setFrequence(e.target.value)} />
          <label>{"Dur\u00e9e de la tourn\u00e9e (jours)"}</label>
          <input className="exp-champ" type="number" min="1" max="90" value={duree} onChange={(e) => setDuree(e.target.value)} />
          <label>{"V\u00e9hicule"}</label>
          <select className="exp-champ" value={vehicule} onChange={(e) => setVehicule(e.target.value)}>
            <option value="">{"\u00c0 choisir"}</option>
            <option value="MINIBUS">Minibus</option>
            <option value="CAMION">Camion</option>
            <option value="AMBULANCE">Ambulance</option>
            <option value="AUTRE">Autre</option>
          </select>
          <label>{"Prochain d\u00e9part pr\u00e9vu"}</label>
          <input className="exp-champ" type="date" value={depart} onChange={(e) => setDepart(e.target.value)} />
          <div className="exp-ligne-boutons">
            <button type="button" className="exp-bouton exp-bouton-plein" onClick={enregistrer} disabled={enCours}>
              {enCours ? "Enregistrement\u2026" : "Enregistrer"}
            </button>
            <button type="button" className="exp-bouton" onClick={() => setEdition(false)} disabled={enCours}>
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <div className="exp-ligne-boutons" style={{ marginTop: 0, marginBottom: 8 }}>
          <button type="button" className="exp-bouton" onClick={ouvrirEdition} disabled={enCours}>
            Modifier le planning
          </button>
        </div>
      )}

      {message && (
        <div className={"exp-message " + (message.type === "ok" ? "exp-message-ok" : "exp-message-erreur")}>{message.texte}</div>
      )}

      {ligne.totauxParProduit.some((t) => !t.suffisant) && (
        <div className="exp-message exp-message-erreur">
          {"Stock insuffisant au CAMEC pour : " + ligne.totauxParProduit.filter((t) => !t.suffisant).map((t) => t.produit).join(", ") + ". Les commandes partiront partielles ; le manque restera en reliquat."}
        </div>
      )}
      <div className="exp-section">{"Produits \u00e0 charger"}</div>
      {ligne.totauxParProduit.length === 0 ? (
        <p className="exp-vide">{"Aucune commande associ\u00e9e \u00e0 cet axe pour le moment."}</p>
      ) : (
        <div className="exp-tableau-cadre">
          <table className="exp-tableau">
            <thead>
              <tr>
                <th className="exp-th exp-gauche">Produit</th>
                <th className="exp-th">{"\u00c0 livrer"}</th>
                <th className="exp-th">Stock CAMEC</th>
              </tr>
            </thead>
            <tbody>
              {ligne.totauxParProduit.map((t) => (
                <tr key={t.produitId}>
                  <td className="exp-td exp-gauche">{t.produit}</td>
                  <td className="exp-td">{t.quantite.toLocaleString("fr-FR")}</td>
                  <td className={"exp-td" + (t.suffisant ? "" : " exp-insuffisant")}>
                    {t.stockDisponible.toLocaleString("fr-FR") + (t.suffisant ? "" : " (insuffisant)")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ligne.nombreCommandes > 0 && (
        <>
          <div className="exp-section">
            <button type="button" className="exp-bouton" onClick={() => setVoirCommandes((v) => !v)}>
              {(voirCommandes ? "Masquer" : "Voir") + " les " + ligne.nombreCommandes + " commande(s)"}
            </button>
          </div>
          {voirCommandes && (
            <ul className="exp-liste">
              {ligne.commandes.map((c) => (
                <li key={c.id}>{"n\u00b0 " + c.numero + " \u2014 " + (c.destinataire || "destinataire inconnu")}</li>
              ))}
            </ul>
          )}
          <div className="exp-ligne-boutons">
            <button type="button" className="exp-bouton exp-bouton-plein" onClick={expedier} disabled={enCours}>
              {enCours ? "Traitement\u2026" : "Exp\u00e9dier l'axe " + axe.nom}
            </button>
            {partenaire && partenaire.nombreCommandes > 0 && (
              <button type="button" className="exp-bouton" onClick={expedierAvecPartenaire} disabled={enCours}>
                {"Exp\u00e9dier avec l'axe " + partenaire.axe.nom + " (d\u00e9part commun)"}
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}

export default function ExpeditionsAxes({ onRetour }) {
  const [lignes, setLignes] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur("");
    try {
      setLignes(await appeler("/distribution/axes/resume"));
    } catch (e) {
      setErreur(e.message);
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  return (
    <div className="admin-page exp-page">
      <style>{CSS_EXPEDITIONS}</style>
      <header className="admin-header">
        <button className="admin-retour" onClick={onRetour}>{"\u2190 Retour"}</button>
        <h1>{"Exp\u00e9ditions par axe"}</h1>
        <p className="admin-message">
          {"Une carte par axe : wilayas desservies, planning des d\u00e9parts, commandes valid\u00e9es en attente et produits \u00e0 charger."}
        </p>
        <div className="exp-actions">
          <button type="button" className="exp-bouton" onClick={charger} disabled={chargement}>
            {chargement ? "Chargement\u2026" : "Actualiser"}
          </button>
        </div>
      </header>
      {erreur && <div className="exp-message exp-message-erreur">{erreur}</div>}
      {!erreur && lignes.length === 0 && !chargement && <p className="exp-vide">{"Aucun axe d'exp\u00e9dition actif."}</p>}
      <div className="exp-grille">
        {lignes.map((l) => (
          <CarteAxe key={l.axe.id} ligne={l} partenaire={lignes.find((x) => x.axe.code === PARTENAIRES[l.axe.code]) || null} onChange={charger} />
        ))}
      </div>
    </div>
  );
}