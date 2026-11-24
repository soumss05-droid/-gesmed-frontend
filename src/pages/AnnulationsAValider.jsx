import { useEffect, useState } from "react";
import "./AnnulationsAValider.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

function formaterMontant(valeur) {
  const n = Number(valeur || 0);
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 2 }) + " MRU";
}

function formaterDate(valeur) {
  if (!valeur) return "";
  const d = new Date(valeur);
  return d.toLocaleDateString("fr-FR") + " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export default function AnnulationsAValider({ onRetour }) {
  const [demandes, setDemandes] = useState([]);
  const [commentaires, setCommentaires] = useState({});
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [message, setMessage] = useState(null);
  const [enCours, setEnCours] = useState(null);

  async function charger() {
    setChargement(true);
    setErreur(null);
    try {
      const token = localStorage.getItem("SYGIMS_token");
      const res = await fetch(API_URL + "/stocks/annulations/a-valider", {
        headers: { Authorization: "Bearer " + token },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erreur || "Impossible de charger les demandes.");
      setDemandes(data);
    } catch (err) {
      setErreur(err.message || "Connexion instable, r\u00e9essayez.");
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    charger();
  }, []);

  function changerCommentaire(id, valeur) {
    setCommentaires((prev) => ({ ...prev, [id]: valeur }));
  }

  async function decider(demande, approuve) {
    const commentaire = (commentaires[demande.id] || "").trim();
    setErreur(null);
    setMessage(null);

    if (!approuve && commentaire.length < 3) {
      setErreur("Un commentaire est obligatoire pour refuser une annulation.");
      return;
    }
    if (approuve) {
      const ok = window.confirm(
        "Valider l'annulation de la dispensation N\u00b0" + demande.numero + " ? Le stock sera remis dans les m\u00eames lots."
      );
      if (!ok) return;
    }

    setEnCours(demande.id);
    try {
      const token = localStorage.getItem("SYGIMS_token");
      const res = await fetch(API_URL + "/stocks/annulations/" + demande.id + "/decider", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ approuve: approuve, commentaire: commentaire || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erreur || "La d\u00e9cision n'a pas pu \u00eatre enregistr\u00e9e.");
      setMessage(data.message || "D\u00e9cision enregistr\u00e9e.");
      setDemandes((prev) => prev.filter((d) => d.id !== demande.id));
    } catch (err) {
      setErreur(err.message || "Connexion instable, r\u00e9essayez.");
    } finally {
      setEnCours(null);
    }
  }

  return (
    <div className="annul-page">
      <header className="annul-header">
        <button className="annul-retour" onClick={onRetour}>{"\u2190 Retour"}</button>
        <h1>{"Annulations de dispensation \u00e0 valider"}</h1>
      </header>

      {erreur && <p className="annul-erreur" role="alert">{erreur}</p>}
      {message && <p className="annul-message">{message}</p>}

      {chargement && <p className="annul-info">Chargement...</p>}

      {!chargement && demandes.length === 0 && !erreur && (
        <p className="annul-vide">{"Aucune demande d'annulation en attente pour l'instant."}</p>
      )}

      {!chargement &&
        demandes.map((d) => (
          <div className="annul-carte" key={d.id}>
            <div className="annul-carte__entete">
              <strong>{"Dispensation N\u00b0" + d.numero + " \u2014 " + (d.etablissement || "")}</strong>
              <span className="annul-carte__date">{formaterDate(d.dateDemande)}</span>
            </div>

            <div className="annul-details">
              <div><span className="annul-etiquette">Produit</span><span>{d.produit}</span></div>
              <div><span className="annul-etiquette">{"Quantit\u00e9"}</span><span>{d.quantite}</span></div>
              <div><span className="annul-etiquette">{"B\u00e9n\u00e9ficiaire"}</span><span>{(d.typeBeneficiaire ? d.typeBeneficiaire + " \u2014 " : "") + (d.beneficiaire || "")}</span></div>
              <div><span className="annul-etiquette">Montant</span><span>{formaterMontant(d.montantTotal)}</span></div>
              <div><span className="annul-etiquette">{"Dispensation faite le"}</span><span>{formaterDate(d.dateDispensation)}</span></div>
              <div><span className="annul-etiquette">{"Demand\u00e9e par"}</span><span>{d.demandeur || ""}</span></div>
            </div>

            <div className="annul-motif">
              <div className="annul-motif__titre">{"Motif de la demande d'annulation"}</div>
              <div className="annul-motif__texte">{d.motif}</div>
            </div>

            <label className="annul-label">
              {"Commentaire (obligatoire pour refuser)"}
              <textarea
                rows={2}
                value={commentaires[d.id] || ""}
                onChange={(e) => changerCommentaire(d.id, e.target.value)}
              />
            </label>

            <div className="annul-actions">
              <button
                className="annul-bouton annul-bouton--refuser"
                disabled={enCours === d.id}
                onClick={() => decider(d, false)}
              >
                Refuser
              </button>
              <button
                className="annul-bouton annul-bouton--valider"
                disabled={enCours === d.id}
                onClick={() => decider(d, true)}
              >
                {enCours === d.id ? "..." : "Valider l'annulation"}
              </button>
            </div>
          </div>
        ))}
    </div>
  );
}
