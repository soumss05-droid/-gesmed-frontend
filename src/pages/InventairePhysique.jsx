import { useEffect, useState } from "react";
import "./InventairePhysique.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function InventairePhysique({ onRetour }) {
  const [stocks, setStocks] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [message, setMessage] = useState(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [comptages, setComptages] = useState({}); // { lotId: "12" }
  const [commentaire, setCommentaire] = useState("");
  const [historique, setHistorique] = useState([]);
  const [afficherHistorique, setAfficherHistorique] = useState(false);

  async function chargerStocks() {
    setChargement(true);
    setErreur(null);
    try {
      const token = localStorage.getItem("gesmed_token");
      const res = await fetch(`${API_URL}/stocks`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erreur || "Impossible de charger le stock.");
      setStocks(data);
    } catch (err) {
      setErreur(err.message || "Connexion instable, réessayez.");
    } finally {
      setChargement(false);
    }
  }

  async function chargerHistorique() {
    try {
      const token = localStorage.getItem("gesmed_token");
      const res = await fetch(`${API_URL}/inventaires`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json();
      if (res.ok) setHistorique(data);
    } catch {
      // L'historique n'est pas critique, on ignore silencieusement l'échec.
    }
  }

  useEffect(() => {
    chargerStocks();
    chargerHistorique();
  }, []);

  function majComptage(lotId, valeur) {
    setComptages((c) => ({ ...c, [lotId]: valeur }));
  }

  async function soumettre(ev) {
    ev.preventDefault();
    setErreur(null);
    setMessage(null);

    const lignes = Object.entries(comptages)
      .filter(([, valeur]) => valeur !== "" && valeur !== null && valeur !== undefined)
      .map(([lotId, valeur]) => ({ lotId, quantitePhysique: Number(valeur) }));

    if (lignes.length === 0) {
      setErreur("Compte au moins un lot avant d'enregistrer.");
      return;
    }
    if (lignes.some((l) => l.quantitePhysique < 0)) {
      setErreur("Les quantités comptées ne peuvent pas être négatives.");
      return;
    }

    setEnvoiEnCours(true);
    try {
      const token = localStorage.getItem("gesmed_token");
      const res = await fetch(`${API_URL}/inventaires`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          type: "PONCTUEL",
          commentaire: commentaire || undefined,
          lignes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "L'enregistrement de l'inventaire a échoué.");

      const nbEcarts = data.inventaire.lignes.filter((l) => l.ecart !== 0).length;
      setMessage(
        nbEcarts > 0
          ? `Inventaire enregistré — ${nbEcarts} écart(s) détecté(s), à consulter dans les rapports.`
          : "Inventaire enregistré — aucun écart détecté."
      );
      setComptages({});
      setCommentaire("");
      chargerHistorique();
    } catch (err) {
      setErreur(err.message || "Connexion instable, réessayez.");
    } finally {
      setEnvoiEnCours(false);
    }
  }

  return (
    <div className="inventaire-page">
      <header className="inventaire-header">
        <button className="inventaire-retour" onClick={onRetour}>← Retour</button>
        <h1>Inventaire physique</h1>
      </header>

      <p className="inventaire-sous-titre">
        Compare le stock réel compté à ce que le système calcule, pour détecter les écarts (pertes ou surplus).
        Aucun blocage : les écarts sont seulement enregistrés pour les rapports.
      </p>

      {erreur && <p className="inventaire-erreur" role="alert">{erreur}</p>}
      {message && <p className="inventaire-message">{message}</p>}

      {chargement ? (
        <p>Chargement du stock...</p>
      ) : stocks.length === 0 ? (
        <p className="inventaire-vide">Aucun produit en stock à compter dans cet établissement.</p>
      ) : (
        <form className="inventaire-formulaire" onSubmit={soumettre}>
          {stocks.map((stock) => (
            <div className="inventaire-produit" key={stock.produitId || stock.produit}>
              <h2>{stock.produit}</h2>
              {(!stock.lots || stock.lots.length === 0) && (
                <p className="inventaire-sans-lot">Aucun lot en stock pour ce produit.</p>
              )}
              {stock.lots && stock.lots.length > 0 && (
                <table className="inventaire-table">
                  <thead>
                    <tr>
                      <th>N° de lot</th>
                      <th>Péremption</th>
                      <th>Quantité système</th>
                      <th>Quantité comptée</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stock.lots.map((lot) => (
                      <tr key={lot.id}>
                        <td>{lot.numeroLot}</td>
                        <td>{new Date(lot.datePeremption).toLocaleDateString("fr-FR")}</td>
                        <td>{lot.quantite}</td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            placeholder="—"
                            name={`quantite-comptee-${lot.id}`}
                            autoComplete="off"
                            value={comptages[lot.id] ?? ""}
                            onChange={(e) => majComptage(lot.id, e.target.value)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}

          <div className="inventaire-champ">
            <label>Note (optionnel)</label>
            <textarea
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              placeholder="Contexte du comptage, remarques..."
              rows={3}
            />
          </div>

          <div className="inventaire-actions">
            <button type="submit" className="inventaire-bouton" disabled={envoiEnCours}>
              {envoiEnCours ? "..." : "Enregistrer l'inventaire"}
            </button>
          </div>
        </form>
      )}

      <div className="inventaire-historique-section">
        <button
          type="button"
          className="inventaire-lien-historique"
          onClick={() => setAfficherHistorique((v) => !v)}
        >
          {afficherHistorique ? "Masquer l'historique" : "Voir l'historique des inventaires"}
        </button>

        {afficherHistorique && (
          <div className="inventaire-historique">
            {historique.length === 0 ? (
              <p className="inventaire-vide">Aucun inventaire réalisé pour l'instant.</p>
            ) : (
              historique.map((inv) => (
                <div className="inventaire-historique-carte" key={inv.id}>
                  <div className="inventaire-historique-entete">
                    <strong>{new Date(inv.dateInventaire).toLocaleDateString("fr-FR")}</strong>
                    <span>{inv.effectuePar?.nomComplet}</span>
                  </div>
                  {inv.commentaire && <p className="inventaire-historique-note">{inv.commentaire}</p>}
                  <ul>
                    {inv.lignes.map((l) => (
                      <li key={l.id}>
                        {l.lot.produit.nom} ({l.lot.numeroLot}) — système {l.quantiteSysteme}, compté{" "}
                        {l.quantitePhysique}{" "}
                        <span className={l.ecart === 0 ? "inventaire-ecart-nul" : l.ecart < 0 ? "inventaire-ecart-perte" : "inventaire-ecart-surplus"}>
                          ({l.ecart > 0 ? "+" : ""}{l.ecart})
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}