import { useEffect, useState } from "react";
import "./EnregistrerRentreeCamec.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const champVide = {
  produitId: "",
  numeroLot: "",
  datePeremption: "",
  quantite: "",
  dateReception: new Date().toISOString().slice(0, 10),
  fournisseur: "",
  prixUnitaire: "",
  note: "",
};

export default function EnregistrerRentreeCamec({ onRetour }) {
  const [produits, setProduits] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [message, setMessage] = useState(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [form, setForm] = useState(champVide);
  const [erreursChamps, setErreursChamps] = useState({});

  async function chargerProduits() {
    setChargement(true);
    setErreur(null);
    try {
      const token = localStorage.getItem("gesmed_token");
      const res = await fetch(`${API_URL}/produits`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erreur || "Impossible de charger les produits.");
      setProduits(data);
    } catch (err) {
      setErreur(err.message || "Connexion instable, réessayez.");
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    chargerProduits();
  }, []);

  function majChamp(cle, valeur) {
    setForm((f) => ({ ...f, [cle]: valeur }));
    setErreursChamps((e) => ({ ...e, [cle]: undefined }));
  }

  function validerChamps() {
    const e = {};
    if (!form.produitId) e.produitId = "Choisis un produit.";
    if (!form.numeroLot.trim()) e.numeroLot = "Le numéro de lot est requis.";
    if (!form.datePeremption) e.datePeremption = "La date de péremption est requise.";
    if (!form.quantite || Number(form.quantite) <= 0) e.quantite = "Indique une quantité supérieure à 0.";
    if (!form.dateReception) e.dateReception = "La date de réception est requise.";
    return e;
  }

  async function soumettre(ev) {
    ev.preventDefault();
    const e = validerChamps();
    setErreursChamps(e);
    if (Object.keys(e).length > 0) return;

    setEnvoiEnCours(true);
    setErreur(null);
    setMessage(null);
    try {
      const token = localStorage.getItem("gesmed_token");
      const res = await fetch(`${API_URL}/receptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          produitId: form.produitId,
          numeroLot: form.numeroLot.trim(),
          datePeremption: form.datePeremption,
          quantite: Number(form.quantite),
          dateReception: form.dateReception,
          fournisseur: form.fournisseur || undefined,
          prixUnitaire: form.prixUnitaire ? Number(form.prixUnitaire) : undefined,
          note: form.note || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "L'enregistrement de la rentrée a échoué.");

      const produit = produits.find((p) => p.id === form.produitId);
      setMessage(
        `Lot enregistré — ${form.quantite} unité(s) de ${produit?.nom ?? "ce produit"}, lot ${form.numeroLot.trim()}.`
      );
      setForm(champVide);
    } catch (err) {
      setErreur(err.message || "Connexion instable, réessayez.");
    } finally {
      setEnvoiEnCours(false);
    }
  }

  return (
    <div className="rentree-page">
      <header className="rentree-header">
        <button className="rentree-retour" onClick={onRetour}>← Retour</button>
        <h1>Rentrée des produits</h1>
      </header>

      <p className="rentree-sous-titre">
        Enregistre un nouveau lot reçu à la CAMEC centrale. Le stock est mis à jour automatiquement.
      </p>

      {erreur && <p className="rentree-erreur" role="alert">{erreur}</p>}
      {message && <p className="rentree-message">{message}</p>}

      {chargement ? (
        <p>Chargement des produits...</p>
      ) : (
        <form className="rentree-formulaire" onSubmit={soumettre}>
          <div className="rentree-champ">
            <label>
              Produit <span className="rentree-obligatoire">*</span>
            </label>
            <select
              value={form.produitId}
              onChange={(e) => majChamp("produitId", e.target.value)}
              className={erreursChamps.produitId ? "rentree-input-erreur" : ""}
            >
              <option value="">Sélectionner un produit…</option>
              {produits.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nom}
                  {p.forme ? ` — ${p.forme}` : ""}
                </option>
              ))}
            </select>
            {erreursChamps.produitId && <p className="rentree-erreur-champ">{erreursChamps.produitId}</p>}
          </div>

          <div className="rentree-grille">
            <div className="rentree-champ">
              <label>
                Numéro de lot <span className="rentree-obligatoire">*</span>
              </label>
              <input
                type="text"
                value={form.numeroLot}
                onChange={(e) => majChamp("numeroLot", e.target.value)}
                placeholder="ex. L-2026-0913"
                className={erreursChamps.numeroLot ? "rentree-input-erreur" : ""}
              />
              {erreursChamps.numeroLot && <p className="rentree-erreur-champ">{erreursChamps.numeroLot}</p>}
            </div>

            <div className="rentree-champ">
              <label>
                Date de péremption <span className="rentree-obligatoire">*</span>
              </label>
              <input
                type="date"
                value={form.datePeremption}
                onChange={(e) => majChamp("datePeremption", e.target.value)}
                className={erreursChamps.datePeremption ? "rentree-input-erreur" : ""}
              />
              {erreursChamps.datePeremption && (
                <p className="rentree-erreur-champ">{erreursChamps.datePeremption}</p>
              )}
            </div>

            <div className="rentree-champ">
              <label>
                Quantité reçue <span className="rentree-obligatoire">*</span>
              </label>
              <input
                type="number"
                min="1"
                value={form.quantite}
                onChange={(e) => majChamp("quantite", e.target.value)}
                placeholder="ex. 500"
                className={erreursChamps.quantite ? "rentree-input-erreur" : ""}
              />
              {erreursChamps.quantite && <p className="rentree-erreur-champ">{erreursChamps.quantite}</p>}
            </div>

            <div className="rentree-champ">
              <label>
                Date de réception <span className="rentree-obligatoire">*</span>
              </label>
              <input
                type="date"
                value={form.dateReception}
                onChange={(e) => majChamp("dateReception", e.target.value)}
                className={erreursChamps.dateReception ? "rentree-input-erreur" : ""}
              />
              {erreursChamps.dateReception && (
                <p className="rentree-erreur-champ">{erreursChamps.dateReception}</p>
              )}
            </div>

            <div className="rentree-champ">
              <label>Fournisseur</label>
              <input
                type="text"
                value={form.fournisseur}
                onChange={(e) => majChamp("fournisseur", e.target.value)}
                placeholder="Optionnel"
              />
            </div>

            <div className="rentree-champ">
              <label>Prix unitaire (MRU)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.prixUnitaire}
                onChange={(e) => majChamp("prixUnitaire", e.target.value)}
                placeholder="Optionnel"
              />
            </div>
          </div>

          <div className="rentree-champ">
            <label>Note</label>
            <textarea
              value={form.note}
              onChange={(e) => majChamp("note", e.target.value)}
              placeholder="Optionnel — commentaire sur cette réception"
              rows={3}
            />
          </div>

          <div className="rentree-actions">
            <button
              type="button"
              className="rentree-bouton-secondaire"
              onClick={() => {
                setForm(champVide);
                setErreursChamps({});
              }}
            >
              Réinitialiser
            </button>
            <button type="submit" className="rentree-bouton" disabled={envoiEnCours}>
              {envoiEnCours ? "..." : "Enregistrer le lot"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}