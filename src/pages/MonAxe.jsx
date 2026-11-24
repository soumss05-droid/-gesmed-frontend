// MonAxe.jsx - Vue en lecture seule pour la DRS et la SAMEC : l'axe de livraison de leur region a la CAMEC.
import { useCallback, useEffect, useState } from "react";
import "./AdminPanel.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

function jeton() {
  return localStorage.getItem("SYGIMS_token") || localStorage.getItem("gesmed_token");
}

async function appeler(chemin) {
  const res = await fetch(API_URL + chemin, {
    headers: {
      Authorization: "Bearer " + jeton(),
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

const CSS_MON_AXE = [
  ".ax-page { text-align: left; }",
  ".ax-actions { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0 14px; }",
  ".ax-bouton { padding: 8px 14px; border-radius: 8px; border: 1px solid #b5b5b5; background: #fff; cursor: pointer; font-size: 0.9rem; }",
  ".ax-bouton:hover { background: #f3f4f6; }",
  ".ax-bouton:disabled { opacity: 0.55; cursor: not-allowed; }",
  ".ax-carte { border: 1px solid #e2e2e2; border-radius: 14px; background: #fff; padding: 16px; box-sizing: border-box; margin: 0 0 16px; max-width: 900px; }",
  ".ax-titre { display: flex; flex-wrap: wrap; gap: 8px; align-items: baseline; justify-content: space-between; margin: 0 0 8px; }",
  ".ax-titre h2 { margin: 0; font-size: 1.15rem; }",
  ".ax-pastille { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 0.78rem; font-weight: 600; border: 1px solid #c9c9c9; background: #f3f4f6; color: #374151; }",
  ".ax-pastille-ok { background: #e7f4ec; border-color: #9fd0b0; color: #17612f; }",
  ".ax-pastille-attente { background: #fff4e0; border-color: #f0cf94; color: #8a5200; }",
  ".ax-infos { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px 16px; margin: 0 0 12px; }",
  ".ax-etiquette { font-size: 0.75rem; color: #6b7280; text-transform: uppercase; letter-spacing: 0.03em; }",
  ".ax-valeur { font-size: 0.97rem; font-weight: 600; }",
  ".ax-section { font-size: 0.82rem; font-weight: 700; color: #4b5563; text-transform: uppercase; letter-spacing: 0.03em; margin: 14px 0 6px; }",
  ".ax-vide { font-size: 0.9rem; color: #6b7280; margin: 6px 0; }",
  ".ax-erreur { color: #b3261e; font-size: 0.92rem; margin: 8px 0; }",
  ".ax-ordre { list-style: none; padding: 0; margin: 0; }",
  ".ax-ordre li { padding: 6px 10px; border: 1px solid #eee; border-radius: 8px; margin: 0 0 6px; font-size: 0.92rem; }",
  ".ax-ordre li.ax-moi { border-color: #9fd0b0; background: #e7f4ec; font-weight: 700; }",
  ".ax-tableau-cadre { overflow-x: auto; border: 1px solid #eee; border-radius: 10px; }",
  ".ax-tableau { width: 100%; border-collapse: collapse; font-size: 0.88rem; }",
  ".ax-tableau th, .ax-tableau td { text-align: left; padding: 7px 10px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }",
  ".ax-tableau th { background: #f7f7f8; font-size: 0.78rem; text-transform: uppercase; color: #4b5563; }",
].join("\n");

function formaterDate(valeur) {
  if (!valeur) return "\u2014";
  const d = new Date(valeur);
  if (isNaN(d.getTime())) return "\u2014";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function texteVehicule(v) {
  if (v === null || v === undefined || v === "") return "\u2014";
  if (typeof v === "object") return v.nom || v.libelle || v.immatriculation || "\u2014";
  return String(v);
}

function avecUnite(v, unite) {
  if (v === null || v === undefined || v === "") return "\u2014";
  return v + " " + unite;
}

export default function MonAxe({ onRetour }) {
  const [donnees, setDonnees] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur("");
    try {
      setDonnees(await appeler("/distribution/axes/ma-region"));
    } catch (e) {
      setErreur(e.message);
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  const axe = donnees ? donnees.axe : null;
  const commandes = donnees ? donnees.commandes : [];

  return (
    <div className="admin-page ax-page">
      <style>{CSS_MON_AXE}</style>
      <header className="admin-header">
        <button className="admin-retour" onClick={onRetour}>{"\u2190 Retour"}</button>
        <h1>{"Mon axe de livraison"}</h1>
        <p className="admin-message">
          {"Lecture seule : l'axe de la CAMEC qui dessert votre r\u00e9gion, son planning et vos commandes valid\u00e9es en attente de d\u00e9part."}
        </p>
        <div className="ax-actions">
          <button type="button" className="ax-bouton" onClick={charger} disabled={chargement}>
            {chargement ? "Chargement..." : "Actualiser"}
          </button>
        </div>
      </header>

      {erreur && <p className="ax-erreur">{erreur}</p>}
      {!erreur && chargement && !donnees && <p className="ax-vide">{"Chargement..."}</p>}

      {donnees && !axe && (
        <div className="ax-carte">
          <div className="ax-titre">
            <h2>{donnees.region.nom}</h2>
            <span className="ax-pastille">{"Livraison directe"}</span>
          </div>
          <p className="ax-vide">
            {"Votre r\u00e9gion n'est rattach\u00e9e \u00e0 aucun axe de livraison : elle est desservie directement."}
          </p>
        </div>
      )}

      {donnees && axe && (
        <div className="ax-carte">
          <div className="ax-titre">
            <h2>{axe.nom}</h2>
            {axe.code && <span className="ax-pastille">{axe.code}</span>}
          </div>
          <div className="ax-infos">
            <div>
              <div className="ax-etiquette">{"Votre r\u00e9gion"}</div>
              <div className="ax-valeur">{donnees.region.nom}</div>
            </div>
            <div>
              <div className="ax-etiquette">{"V\u00e9hicule"}</div>
              <div className="ax-valeur">{texteVehicule(axe.vehicule)}</div>
            </div>
            <div>
              <div className="ax-etiquette">{"Fr\u00e9quence"}</div>
              <div className="ax-valeur">{axe.frequenceJours ? "Tous les " + axe.frequenceJours + " jours" : "\u2014"}</div>
            </div>
            <div>
              <div className="ax-etiquette">{"Dur\u00e9e de livraison"}</div>
              <div className="ax-valeur">{avecUnite(axe.dureeLivraisonJours, "jours")}</div>
            </div>
            <div>
              <div className="ax-etiquette">{"Dernier d\u00e9part"}</div>
              <div className="ax-valeur">{formaterDate(axe.dernierDepartAt)}</div>
            </div>
            <div>
              <div className="ax-etiquette">{"Prochain d\u00e9part pr\u00e9vu"}</div>
              <div className="ax-valeur">{formaterDate(axe.prochainDepart)}</div>
            </div>
          </div>

          <div className="ax-section">{"Ordre de passage des wilayas"}</div>
          {donnees.wilayas.length === 0 ? (
            <p className="ax-vide">{"Aucune wilaya enregistr\u00e9e sur cet axe."}</p>
          ) : (
            <ol className="ax-ordre">
              {donnees.wilayas.map((w) => (
                <li key={w.id} className={w.maRegion ? "ax-moi" : ""}>
                  {(w.ordreAxe ? w.ordreAxe + ". " : "") + w.nom + (w.maRegion ? " (votre r\u00e9gion)" : "")}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {donnees && (
        <div className="ax-carte">
          <div className="ax-titre">
            <h2>{"Mes commandes valid\u00e9es \u00e0 la CAMEC"}</h2>
            {donnees.enAttenteSansAxe > 0 && (
              <span className="ax-pastille ax-pastille-attente">
                {donnees.enAttenteSansAxe + " en attente d'affectation \u00e0 un axe"}
              </span>
            )}
          </div>
          {commandes.length === 0 ? (
            <p className="ax-vide">{"Aucune commande valid\u00e9e en attente de d\u00e9part pour votre r\u00e9gion."}</p>
          ) : (
            <div className="ax-tableau-cadre">
              <table className="ax-tableau">
                <thead>
                  <tr>
                    <th>{"N\u00b0"}</th>
                    <th>{"Destinataire"}</th>
                    <th>{"Situation"}</th>
                    <th>{"Produits"}</th>
                  </tr>
                </thead>
                <tbody>
                  {commandes.map((c) => (
                    <tr key={c.id}>
                      <td>{c.numero}</td>
                      <td>{c.destinataire || "\u2014"}</td>
                      <td>
                        {c.sur_cet_axe ? (
                          <span className="ax-pastille ax-pastille-ok">{"Sur l'axe"}</span>
                        ) : c.sans_axe ? (
                          <span className="ax-pastille ax-pastille-attente">{"En attente d'affectation"}</span>
                        ) : (
                          <span className="ax-pastille">{"Sur un autre axe"}</span>
                        )}
                      </td>
                      <td>{c.lignes.map((l) => l.produit + " : " + l.quantite).join(" ; ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
