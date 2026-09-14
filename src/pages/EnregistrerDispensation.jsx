import { useEffect, useState } from "react";
import "./EnregistrerDispensation.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function EnregistrerDispensation({ onRetour }) {
  const [produits, setProduits] = useState([]);
  const [produitId, setProduitId] = useState("");
  const [quantite, setQuantite] = useState("");
  const [chargementProduits, setChargementProduits] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [succes, setSucces] = useState(false);

  useEffect(() => {
    async function chargerProduits() {
      try {
        const token = localStorage.getItem("gesmed_token");
        const res = await fetch(`${API_URL}/produits`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error("Impossible de charger le catalogue produits.");
        setProduits(await res.json());
      } catch (err) {
        setErreur(err.message || "Connexion instable, réessayez.");
      } finally {
        setChargementProduits(false);
      }
    }
    chargerProduits();
  }, []);

  async function envoyerDispensation(e) {
    e.preventDefault();
    setErreur(null);

    if (!produitId || !quantite || Number(quantite) <= 0) {
      setErreur("Choisis un produit et une quantité valide.");
      return;
    }

    setEnvoi(true);
    try {
      const token = localStorage.getItem("gesmed_token");
      const res = await fetch(`${API_URL}/stocks/dispensation`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ produitId, quantite: Number(quantite) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erreur || "La dispensation n'a pas pu être enregistrée.");
      setSucces(true);
    } catch (err) {
      setErreur(err.message || "Connexion instable, réessayez.");
    } finally {
      setEnvoi(false);
    }
  }

  if (succes) {
    return (
      <div className="dispensation-page">
        <div className="dispensation-confirmation">
          <h1>Dispensation enregistrée</h1>
          <p>Le stock a été mis à jour.</p>
          <button className="dispensation-bouton" onClick={onRetour}>Retour au tableau de bord</button>
        </div>
      </div>
    );
  }

  return (
    <div className="dispensation-page">
      <header className="dispensation-header">
        <button className="dispensation-retour" onClick={onRetour}>← Retour</button>
        <h1>Enregistrer une dispensation</h1>
      </header>

      {chargementProduits && <p>Chargement du catalogue produits...</p>}

      {!chargementProduits && (
        <form className="dispensation-form" onSubmit={envoyerDispensation}>
          <label className="dispensation-label">
            Produit
            <select value={produitId} onChange={(e) => setProduitId(e.target.value)}>
              <option value="">Choisir un produit…</option>
              {produits.map((p) => (
                <option key={p.id} value={p.id}>{p.nom}</option>
              ))}
            </select>
          </label>

          <label className="dispensation-label">
            Quantité donnée au(x) patient(s)
            <input type="number" min="1" value={quantite} onChange={(e) => setQuantite(e.target.value)} />
          </label>

          {erreur && <p className="dispensation-erreur" role="alert">{erreur}</p>}

          <button type="submit" className="dispensation-bouton" disabled={envoi}>
            {envoi ? "Envoi…" : "Enregistrer"}
          </button>
        </form>
      )}
    </div>
  );
}
