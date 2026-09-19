import { useEffect, useState } from "react";
import "./NouvelleRequisition.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

function ligneVide() {
  return { produitId: "", quantiteDemandee: "" };
}

export default function NouvelleRequisition({ onRetour }) {
  const [produits, setProduits] = useState([]);
  const [suggestions, setSuggestions] = useState({}); // { produitId: { cmm, stockDisponible, quantiteSuggeree } }
  const [lignes, setLignes] = useState([ligneVide()]);
  const [justification, setJustification] = useState("");
  const [chargementProduits, setChargementProduits] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [succes, setSucces] = useState(false);

  useEffect(() => {
    async function chargerDonnees() {
      try {
        const token = localStorage.getItem("gesmed_token");
        const [resProduits, resSuggestions] = await Promise.all([
          fetch(`${API_URL}/produits`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/stocks/commande-suggeree`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (!resProduits.ok) throw new Error("Impossible de charger le catalogue produits.");
        setProduits(await resProduits.json());

        // La quantité suggérée est un plus pour guider la commande — si
        // elle échoue, on continue sans bloquer la création de réquisition.
        if (resSuggestions.ok) {
          const donneesSuggestions = await resSuggestions.json();
          const parProduit = {};
          for (const s of donneesSuggestions) parProduit[s.produitId] = s;
          setSuggestions(parProduit);
        }
      } catch (err) {
        setErreur(err.message || "Connexion instable, réessayez.");
      } finally {
        setChargementProduits(false);
      }
    }
    chargerDonnees();
  }, []);

  function modifierLigne(index, champ, valeur) {
    setLignes((prev) =>
      prev.map((l, i) => {
        if (i !== index) return l;
        const miseAJour = { ...l, [champ]: valeur };
        // Quand on choisit un produit, on pré-remplit avec la quantité
        // suggérée (CMM × 1 mois − stock disponible), sans écraser une
        // quantité déjà saisie manuellement.
        if (champ === "produitId" && !l.quantiteDemandee) {
          const suggestion = suggestions[valeur];
          if (suggestion && suggestion.quantiteSuggeree > 0) {
            miseAJour.quantiteDemandee = String(suggestion.quantiteSuggeree);
          }
        }
        return miseAJour;
      })
    );
  }

  function ajouterLigne() {
    setLignes((prev) => [...prev, ligneVide()]);
  }

  function supprimerLigne(index) {
    setLignes((prev) => prev.filter((_, i) => i !== index));
  }

  async function envoyerRequisition(e) {
    e.preventDefault();
    setErreur(null);

    const lignesValides = lignes.filter((l) => l.produitId && Number(l.quantiteDemandee) > 0);
    if (lignesValides.length === 0) {
      setErreur("Ajoute au moins un produit avec une quantité valide.");
      return;
    }

    setEnvoi(true);
    try {
      const token = localStorage.getItem("gesmed_token");
      const res = await fetch(`${API_URL}/requisitions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          lignes: lignesValides.map((l) => ({
            produitId: l.produitId,
            quantiteDemandee: Number(l.quantiteDemandee),
          })),
          justification: justification || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erreur || "La réquisition n'a pas pu être créée.");
      setSucces(true);
    } catch (err) {
      setErreur(err.message || "Connexion instable, réessayez.");
    } finally {
      setEnvoi(false);
    }
  }

  if (succes) {
    return (
      <div className="requisition-page">
        <div className="requisition-confirmation">
          <h1>Réquisition envoyée</h1>
          <p>Elle a été transmise au GAS Moughataa pour validation.</p>
          <button className="requisition-bouton" onClick={onRetour}>
            Retour au tableau de bord
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="requisition-page">
      <header className="requisition-header">
        <button className="requisition-retour" onClick={onRetour}>← Retour</button>
        <h1>Nouvelle réquisition</h1>
      </header>

      {chargementProduits && <p>Chargement du catalogue produits...</p>}

      {!chargementProduits && (
        <form className="requisition-form" onSubmit={envoyerRequisition}>
          {lignes.map((ligne, index) => {
            const suggestion = suggestions[ligne.produitId];
            return (
              <div className="requisition-ligne-bloc" key={index}>
                <div className="requisition-ligne">
                  <select value={ligne.produitId} onChange={(e) => modifierLigne(index, "produitId", e.target.value)}>
                    <option value="">Choisir un produit…</option>
                    {produits.map((p) => (
                      <option key={p.id} value={p.id}>{p.nom}</option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min="1"
                    placeholder="Quantité"
                    value={ligne.quantiteDemandee}
                    onChange={(e) => modifierLigne(index, "quantiteDemandee", e.target.value)}
                  />

                  {lignes.length > 1 && (
                    <button type="button" className="requisition-supprimer" onClick={() => supprimerLigne(index)} aria-label="Supprimer cette ligne">✕</button>
                  )}
                </div>

                {ligne.produitId && suggestion && (
                  <p className="requisition-suggestion">
                    Consommation moyenne mensuelle : {suggestion.cmm} — Stock disponible : {suggestion.stockDisponible} — Suggéré : {suggestion.quantiteSuggeree}
                  </p>
                )}
              </div>
            );
          })}

          <button type="button" className="requisition-ajouter" onClick={ajouterLigne}>+ Ajouter un produit</button>

          <label className="requisition-label">
            Justification (optionnel)
            <textarea value={justification} onChange={(e) => setJustification(e.target.value)} rows={3} />
          </label>

          {erreur && <p className="requisition-erreur" role="alert">{erreur}</p>}

          <button type="submit" className="requisition-bouton" disabled={envoi}>
            {envoi ? "Envoi…" : "Envoyer la réquisition"}
          </button>
        </form>
      )}
    </div>
  );
}