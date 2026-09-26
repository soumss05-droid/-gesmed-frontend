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
  const [programmes, setProgrammes] = useState([]);
  const [chargementProduits, setChargementProduits] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [message, setMessage] = useState(null);
  const [enCours, setEnCours] = useState(false);

  const [form, setForm] = useState(champVide);
  const [erreursChamps, setErreursChamps] = useState({});

  const [afficherNouveauProduit, setAfficherNouveauProduit] = useState(false);
  const [nouveauProduit, setNouveauProduit] = useState({
    nom: "",
    forme: "",
    unite: "",
    programmeId: "",
  });
  const [erreurNouveauProduit, setErreurNouveauProduit] = useState(null);
  const [creationEnCours, setCreationEnCours] = useState(false);

  async function chargerProduits() {
    setChargementProduits(true);
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
      setChargementProduits(false);
    }
  }

  async function chargerProgrammes() {
    try {
      const token = localStorage.getItem("gesmed_token");
      const res = await fetch(`${API_URL}/produits/programmes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setProgrammes(data);
    } catch {
      // silencieux : le sélecteur restera vide, l'erreur apparaîtra
      // naturellement si l'utilisateur tente de créer un produit sans
      // programme disponible
    }
  }

  useEffect(() => {
    chargerProduits();
    chargerProgrammes();
  }, []);

  function majChamp(champ, valeur) {
    setForm((prev) => ({ ...prev, [champ]: valeur }));
    setErreursChamps((e) => ({ ...e, [champ]: undefined }));
  }

  function majNouveauProduit(champ, valeur) {
    setNouveauProduit((prev) => ({ ...prev, [champ]: valeur }));
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

  // Détection de produits au nom proche déjà existants, pour éviter les
  // doublons de catalogue sans bloquer la création (certains cas — formes
  // différentes du même principe actif — restent légitimes).
  function nomsSimilaires(nom) {
    const saisie = nom.trim().toLowerCase();
    if (saisie.length < 3) return [];
    return produits.filter((p) => {
      const existant = p.nom.trim().toLowerCase();
      return existant.includes(saisie) || saisie.includes(existant);
    });
  }

  async function creerNouveauProduit(e) {
    e.preventDefault();
    setErreurNouveauProduit(null);
    setMessage(null);

    if (!nouveauProduit.nom.trim() || !nouveauProduit.programmeId) {
      setErreurNouveauProduit("Nom et programme sont requis.");
      return;
    }

    setCreationEnCours(true);
    try {
      const token = localStorage.getItem("gesmed_token");
      const res = await fetch(`${API_URL}/produits`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          nom: nouveauProduit.nom.trim(),
          forme: nouveauProduit.forme || undefined,
          unite: nouveauProduit.unite || undefined,
          programmeId: nouveauProduit.programmeId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erreur || "La création du produit a échoué.");

      setProduits((prev) => [...prev, data]);
      majChamp("produitId", data.id);
      setAfficherNouveauProduit(false);
      setNouveauProduit({ nom: "", forme: "", unite: "", programmeId: "" });
      setMessage("Produit créé et sélectionné.");
    } catch (err) {
      setErreurNouveauProduit(err.message || "Connexion instable, réessayez.");
    } finally {
      setCreationEnCours(false);
    }
  }

  async function enregistrerRentree(e) {
    e.preventDefault();
    setErreur(null);
    setMessage(null);

    const erreursTrouvees = validerChamps();
    setErreursChamps(erreursTrouvees);
    if (Object.keys(erreursTrouvees).length > 0) return;

    setEnCours(true);
    try {
      const token = localStorage.getItem("gesmed_token");
      const res = await fetch(`${API_URL}/stocks/entree`, {
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
      if (!res.ok) throw new Error(data.erreur || "L'enregistrement de la rentrée a échoué.");

      const produit = produits.find((p) => p.id === form.produitId);
      setMessage(
        `Rentrée enregistrée : lot ${form.numeroLot.trim()} (${form.quantite} unité(s) de ${produit?.nom ?? "ce produit"}).`
      );
      setForm(champVide);
      setErreursChamps({});
    } catch (err) {
      setErreur(err.message || "Connexion instable, réessayez.");
    } finally {
      setEnCours(false);
    }
  }

  const similaires = nomsSimilaires(nouveauProduit.nom);

  return (
    <div className="rentree-page">
      <header className="rentree-header">
        <button className="rentree-retour" onClick={onRetour}>← Retour</button>
        <h1>Rentrée de produits — CAMEC</h1>
      </header>

      {erreur && <p className="rentree-erreur" role="alert">{erreur}</p>}
      {message && <p className="rentree-message">{message}</p>}

      {chargementProduits ? (
        <p>Chargement des produits...</p>
      ) : (
        <form className="rentree-formulaire" onSubmit={enregistrerRentree}>
          <div className="rentree-champ">
            <label>
              Produit <span className="rentree-obligatoire">*</span>
            </label>
            <select
              value={form.produitId}
              onChange={(e) => majChamp("produitId", e.target.value)}
              className={erreursChamps.produitId ? "rentree-input-erreur" : ""}
            >
              <option value="">-- Sélectionner un produit --</option>
              {produits.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nom} {p.forme ? `— ${p.forme}` : ""}
                </option>
              ))}
            </select>
            {erreursChamps.produitId && <p className="rentree-erreur-champ">{erreursChamps.produitId}</p>}

            <button
              type="button"
              className="rentree-lien-nouveau-produit"
              onClick={() => setAfficherNouveauProduit((v) => !v)}
            >
              {afficherNouveauProduit ? "Annuler la création" : "Produit introuvable ? + Créer un nouveau produit"}
            </button>
          </div>

          {afficherNouveauProduit && (
            <div className="rentree-panneau-nouveau-produit">
              <h2>Créer un nouveau produit</h2>
              {erreurNouveauProduit && <p className="rentree-erreur-champ">{erreurNouveauProduit}</p>}
              <div className="rentree-grille">
                <div className="rentree-champ">
                  <label>Nom <span className="rentree-obligatoire">*</span></label>
                  <input
                    type="text"
                    value={nouveauProduit.nom}
                    onChange={(e) => majNouveauProduit("nom", e.target.value)}
                    placeholder="ex. Doliprane 500mg"
                  />
                  {similaires.length > 0 && (
                    <p className="rentree-erreur-champ">
                      ⚠ Produit(s) proche(s) déjà existant(s) : {similaires.map((p) => p.nom).join(", ")}
                    </p>
                  )}
                </div>
                <div className="rentree-champ">
                  <label>Programme <span className="rentree-obligatoire">*</span></label>
                  <select
                    value={nouveauProduit.programmeId}
                    onChange={(e) => majNouveauProduit("programmeId", e.target.value)}
                  >
                    <option value="">-- Sélectionner un programme --</option>
                    {programmes.map((prog) => (
                      <option key={prog.id} value={prog.id}>{prog.nom}</option>
                    ))}
                  </select>
                </div>
                <div className="rentree-champ">
                  <label>Forme</label>
                  <input
                    type="text"
                    value={nouveauProduit.forme}
                    onChange={(e) => majNouveauProduit("forme", e.target.value)}
                    placeholder="ex. Comprimé, Sirop..."
                  />
                </div>
                <div className="rentree-champ">
                  <label>Unité</label>
                  <input
                    type="text"
                    value={nouveauProduit.unite}
                    onChange={(e) => majNouveauProduit("unite", e.target.value)}
                    placeholder="ex. boîte, flacon..."
                  />
                </div>
              </div>
              <div className="rentree-actions">
                <button
                  type="button"
                  className="rentree-bouton"
                  disabled={creationEnCours || !nouveauProduit.nom.trim() || !nouveauProduit.programmeId}
                  onClick={creerNouveauProduit}
                >
                  {creationEnCours ? "Création..." : "Créer le produit"}
                </button>
              </div>
            </div>
          )}

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
            <button type="submit" className="rentree-bouton" disabled={enCours}>
              {enCours ? "..." : "Enregistrer le lot"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}