import { useEffect, useState } from "react";
import "./CommanderReapprovisionnement.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function CommanderReapprovisionnement({ onRetour }) {
  const [suggestions, setSuggestions] = useState([]);
  const [quantites, setQuantites] = useState({}); // { produitId: "30" }
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [message, setMessage] = useState(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [justification, setJustification] = useState("");

  async function chargerSuggestions() {
    setChargement(true);
    setErreur(null);
    try {
      const token = localStorage.getItem("gesmed_token");
      const res = await fetch(`${API_URL}/stocks/commande-suggeree`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erreur || "Impossible de calculer la commande suggérée.");
      setSuggestions(data);

      // Pré-remplit les quantités avec la suggestion, pour les produits qui en ont une.
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

    setEnvoiEnCours(true);
    try {
      const token = localStorage.getItem("gesmed_token");
      const res = await fetch(`${API_URL}/requisitions/reapprovisionnement`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ lignes, justification: justification || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erreur || "La commande a échoué.");

      const nb = data.requisitions?.length || 0;
      setMessage(
        nb > 1
          ? `Commande envoyée — scindée en ${nb} réquisitions (plusieurs programmes concernés).`
          : "Commande envoyée avec succès."
      );
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
      {message && <p className="reappro-message">{message}</p>}

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