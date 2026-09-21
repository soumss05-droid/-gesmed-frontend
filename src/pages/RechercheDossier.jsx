import { useState } from "react";
import "./RechercheDossier.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const LIBELLES_STATUT = {
  BROUILLON: "Brouillon",
  EN_ATTENTE: "En attente",
  MODIFIEE_EN_ATTENTE_CONFIRMATION: "Modifiée",
  REJETEE_POUR_CORRECTION: "Rejetée — à corriger",
  VALIDEE: "Validée",
  REJETEE: "Rejetée",
  EXPEDIEE: "Expédiée",
  CLOTUREE: "Clôturée",
  SCINDEE: "Scindée",
};

const LIBELLES_STATUT_BL = {
  ENVOYE: "Envoyé — en attente de réception",
  RECU_SANS_ECART: "Reçu sans écart",
  RECU_AVEC_ECART_BLOQUE: "Reçu avec écart — bloqué",
  RECU_AVEC_ECART_DEBLOQUE: "Reçu avec écart — débloqué",
};

function formaterDate(date) {
  return new Date(date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function RechercheDossier({ onRetour }) {
  const [numero, setNumero] = useState("");
  const [dossier, setDossier] = useState(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [recherchee, setRecherchee] = useState(false);

  async function rechercher(ev) {
    ev.preventDefault();
    if (!numero.trim()) return;
    setChargement(true);
    setErreur(null);
    setDossier(null);
    setRecherchee(true);
    try {
      const token = localStorage.getItem("gesmed_token");
      const res = await fetch(`${API_URL}/requisitions/recherche/${numero.trim()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erreur || "Impossible de trouver ce dossier.");
      setDossier(data);
    } catch (err) {
      setErreur(err.message || "Connexion instable, réessayez.");
    } finally {
      setChargement(false);
    }
  }

  return (
    <div className="recherche-page">
      <header className="recherche-header">
        <button className="recherche-retour" onClick={onRetour}>← Retour</button>
        <h1>Rechercher un dossier</h1>
      </header>

      <p className="recherche-sous-titre">
        Saisis le numéro d'une réquisition pour retrouver son dossier complet — y compris ses éventuelles
        scissions et les bordereaux de livraison liés.
      </p>

      <form className="recherche-formulaire" onSubmit={rechercher}>
        <span className="recherche-prefixe">N°</span>
        <input
          type="number"
          min="1"
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
          placeholder="Ex. 42"
          autoFocus
        />
        <button type="submit" className="recherche-bouton" disabled={chargement}>
          {chargement ? "Recherche..." : "Rechercher"}
        </button>
      </form>

      {erreur && <p className="recherche-erreur" role="alert">{erreur}</p>}

      {!erreur && recherchee && !chargement && dossier && (
        <div className="recherche-resultats">
          {dossier.length > 1 && (
            <p className="recherche-note-famille">
              Ce dossier comprend {dossier.length} réquisition(s) liée(s) (scission incluse).
            </p>
          )}

          {dossier.map((r) => (
            <div className="recherche-carte" key={r.id}>
              <div className="recherche-carte-entete">
                <span className="recherche-numero">N°{r.numero}</span>
                <span className="recherche-statut">{LIBELLES_STATUT[r.statut] || r.statut}</span>
                <span className="recherche-date">{formaterDate(r.dateCreation)}</span>
              </div>
              <p className="recherche-info">
                Demandeur : <strong>{r.etablissementDemandeur?.nom}</strong> — Niveau actuel :{" "}
                <strong>{r.niveauActuel?.nom}</strong>
              </p>
              {r.justification && <p className="recherche-justification">{r.justification}</p>}

              <ul className="recherche-lignes">
                {r.lignes.map((l) => (
                  <li key={l.id}>
                    {l.produit.nom} — demandé {l.quantiteDemandee}, validé {l.quantiteValidee}
                  </li>
                ))}
              </ul>

              {r.bordereaux.length > 0 && (
                <div className="recherche-bl-liste">
                  <p className="recherche-bl-titre">Bordereaux de livraison liés :</p>
                  {r.bordereaux.map((bl) => (
                    <div className="recherche-bl-carte" key={bl.id}>
                      <div className="recherche-bl-entete">
                        <span className="recherche-numero">BL N°{bl.numero}</span>
                        <span>{LIBELLES_STATUT_BL[bl.statut] || bl.statut}</span>
                      </div>
                      <p className="recherche-info">
                        {bl.etablissementExpediteur?.nom} → {bl.etablissementDestinataire?.nom} — envoyé le{" "}
                        {formaterDate(bl.dateEnvoi)}
                      </p>
                      <ul className="recherche-lignes">
                        {bl.lignes.map((lb) => (
                          <li key={lb.id}>
                            {lb.produit.nom} — envoyé {lb.quantiteEnvoyee}
                            {lb.quantiteRecue !== null ? `, reçu ${lb.quantiteRecue}` : ""}
                            {lb.ecart ? ` (écart : ${lb.ecart})` : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!erreur && recherchee && !chargement && !dossier && (
        <p className="recherche-vide">Aucun résultat.</p>
      )}
    </div>
  );
}