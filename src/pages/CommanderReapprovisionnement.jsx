// CommanderReapprovisionnement.jsx
import { useEffect, useState } from "react";
import BoutonsExport from "../components/BoutonsExport";
import "./CommanderReapprovisionnement.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function CommanderReapprovisionnement({ session, onRetour }) {
  const [suggestions, setSuggestions] = useState([]);
  const [quantites, setQuantites] = useState({});
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [message, setMessage] = useState(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [justification, setJustification] = useState("");
  const [derniereCommande, setDerniereCommande] = useState(null);

  async function chargerSuggestions() {
    setChargement(true);
    setErreur(null);
    try {
      const token = localStorage.getItem("SYGIMS_token");
      const res = await fetch(`${API_URL}/stocks/commande-suggeree`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erreur || "Impossible de calculer la commande suggérée.");
      setSuggestions(data);

      const initial = {};
      for (const s of data) {
        if (s.quantiteSuggeree > 0) initial[s.produitId] = String(s.quantiteSuggeree);
      }
      setQuantites(initial);
    } catch (err) {
      setErreur(err.message || "Connexion instable, réessayez.");
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    chargerSuggestions();
  }, []);

  function majQuantite(produitId, valeur) {
    setQuantites((q) => ({ ...q, [produitId]: valeur }));
  }

  async function soumettre(ev) {
    ev.preventDefault();
    setErreur(null);
    setMessage(null);

    const lignes = Object.entries(quantites)
      .filter(([, valeur]) => valeur !== "" && Number(valeur) > 0)
      .map(([produitId, valeur]) => ({ produitId, quantite: Number(valeur) }));

    if (lignes.length === 0) {
      setErreur("Indique au moins une quantité à commander.");
      return;
    }

    const lignesAvecNoms = lignes.map((l) => ({
      ...l,
      produit: suggestions.find((s) => s.produitId === l.produitId)?.produit || l.produitId,
    }));

    setEnvoiEnCours(true);
    try {
      const token = localStorage.getItem("SYGIMS_token");
      const res = await fetch(`${API_URL}/requisitions/reapprovisionnement`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ lignes, justification: justification || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erreur || "La commande a échoué.");

      const requisitionsCreees = data.requisitions || [];
      const numeros = requisitionsCreees.map((r) => r.numero).filter((n) => n !== undefined && n !== null);
      const nb = requisitionsCreees.length;

      setMessage(
        nb > 1
          ? `Commande envoyée — scindée en ${nb} réquisitions (plusieurs programmes concernés) : N°${numeros.join(", N°")}.`
          : numeros.length > 0
          ? `Commande envoyée avec succès — N°${numeros[0]}.`
          : "Commande envoyée avec succès."
      );
      setDerniereCommande({
        numeros: numeros.length > 0 ? numeros : ["—"],
        lignes: lignesAvecNoms,
        justification,
      });
      setQuantites({});
      setJustification("");
      chargerSuggestions();
    } catch (err) {
      setErreur(err.message || "Connexion instable, réessayez.");
    } finally {
      setEnvoiEnCours(false);
    }
  }

  return (
    <div className="reappro-page">
      <header className="reappro-header">
        <button className="reappro-retour" onClick={onRetour}>← Retour</button>
        <h1>Commander un réapprovisionnement</h1>
      </header>

      <p className="reappro-sous-titre">
        Quantités suggérées automatiquement à partir de ta distribution moyenne mensuelle (DMM) et du stock
        disponible sur tout ton territoire. Ajuste librement avant d'envoyer.
      </p>

      {erreur && <p className="reappro-erreur" role="alert">{erreur}</p>}

      {message && (
        <div className="reappro-message">
          <p>{message}</p>
          {derniereCommande && (
            <div id="confirmation-commande" className="reappro-confirmation">
              <h2>
                {derniereCommande.numeros.length > 1
                  ? `Commande de réapprovisionnement — N°${derniereCommande.numeros.join(", N°")}`
                  : `Commande de réapprovisionnement — N°${derniereCommande.numeros[0]}`}
              </h2>
              {session?.utilisateur?.etablissementNom && (
                <p className="reappro-confirmation-meta">
                  Établissement : {session.utilisateur.etablissementNom}
                </p>
              )}
              <p className="reappro-confirmation-meta">
                Envoyée le {new Date().toLocaleDateString("fr-FR")} à {new Date().toLocaleTimeString("fr-FR")}
              </p>
              <table className="reappro-table-confirmation">
                <thead>
                  <tr>
                    <th>Produit</th>
                    <th>Quantité commandée</th>
                  </tr>
                </thead>
                <tbody>
                  {derniereCommande.lignes.map((l) => (
                    <tr key={l.produitId}>
                      <td>{l.produit}</td>
                      <td>{l.quantite}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {derniereCommande.justification && (
                <p className="reappro-confirmation-justif">
                  <strong>Justification :</strong> {derniereCommande.justification}
                </p>
              )}
              <BoutonsExport
                cibleId="confirmation-commande"
                nomFichier={`commande-${derniereCommande.numeros.join("-")}`}
              />
            </div>
          )}
        </div>
      )}

      {chargement ? (
        <p>Calcul des besoins en cours...</p>
      ) : (
        <form className="reappro-formulaire" onSubmit={soumettre}>
          <table className="reappro-table">
            <thead>
              <tr>
                <th>Produit</th>
                <th>DMM</th>
                <th>Stock disponible</th>
                <th>Suggéré</th>
                <th>Quantité à commander</th>
              </tr>
            </thead>
            <tbody>
              {suggestions.map((s) => (
                <tr key={s.produitId}>
                  <td>{s.produit}</td>
                  <td>{s.cmm}</td>
                  <td>{s.stockDisponible}</td>
                  <td className={s.quantiteSuggeree > 0 ? "reappro-suggestion-positive" : ""}>
                    {s.quantiteSuggeree}
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      name={`quantite-${s.produitId}`}
                      autoComplete="off"
                      value={quantites[s.produitId] ?? ""}
                      onChange={(e) => majQuantite(s.produitId, e.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="reappro-champ">
            <label>Justification (optionnel)</label>
            <textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              placeholder="Contexte de cette commande..."
              rows={3}
            />
          </div>

          <div className="reappro-actions">
            <button type="submit" className="reappro-bouton" disabled={envoiEnCours}>
              {envoiEnCours ? "..." : "Envoyer la commande"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}