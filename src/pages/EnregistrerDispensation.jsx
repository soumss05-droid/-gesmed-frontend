import { useEffect, useState } from "react";
import "./EnregistrerDispensation.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

// "label" : texte affiché dans la liste déroulante "Destiné à".
// "labelChamp" : texte affiché au-dessus du champ de saisie qui apparaît
// une fois le type choisi — volontairement différent du libellé de la liste
// pour demander précisément la bonne information selon le type (le
// responsable du labo, pas le nom du labo lui-même ; le service précis pour
// "Autre service", etc.). "Responsable labo/maternité" plutôt que
// "laborantin(e)" ou "responsable" seul, pour rester neutre côté genre.
const TYPES_BENEFICIAIRE = [
  { valeur: "PATIENT", label: "Patient", labelChamp: "Patient", placeholder: "Nom, téléphone ou code patient" },
  { valeur: "LABORATOIRE", label: "Laboratoire", labelChamp: "Responsable labo", placeholder: "Nom du responsable labo" },
  { valeur: "MATERNITE", label: "Maternité", labelChamp: "Responsable maternité", placeholder: "Nom du/de la responsable" },
  { valeur: "SERVICE", label: "Autre service", labelChamp: "Service", placeholder: "Nom du service" },
];

export default function EnregistrerDispensation({ onRetour }) {
  const [produits, setProduits] = useState([]);
  const [produitId, setProduitId] = useState("");
  const [quantite, setQuantite] = useState("");
  const [typeBeneficiaire, setTypeBeneficiaire] = useState("");
  const [beneficiaire, setBeneficiaire] = useState("");
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

  const typeChoisi = TYPES_BENEFICIAIRE.find((t) => t.valeur === typeBeneficiaire);

  async function envoyerDispensation(e) {
    e.preventDefault();
    setErreur(null);

    if (!produitId || !quantite || Number(quantite) <= 0) {
      setErreur("Choisis un produit et une quantité valide.");
      return;
    }
    if (!typeBeneficiaire) {
      setErreur("Précise à qui cette dispensation est destinée.");
      return;
    }
    if (!beneficiaire.trim()) {
      setErreur("Précise le nom, le téléphone ou le code du bénéficiaire.");
      return;
    }

    setEnvoi(true);
    try {
      const token = localStorage.getItem("gesmed_token");
      const res = await fetch(`${API_URL}/stocks/dispensation`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          produitId,
          quantite: Number(quantite),
          typeBeneficiaire,
          beneficiaire: beneficiaire.trim(),
        }),
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
            Quantité donnée
            <input type="number" min="1" value={quantite} onChange={(e) => setQuantite(e.target.value)} />
          </label>

          <label className="dispensation-label">
            Destiné à
            <select value={typeBeneficiaire} onChange={(e) => setTypeBeneficiaire(e.target.value)}>
              <option value="">Choisir…</option>
              {TYPES_BENEFICIAIRE.map((t) => (
                <option key={t.valeur} value={t.valeur}>{t.label}</option>
              ))}
            </select>
          </label>

          {typeChoisi && (
            <label className="dispensation-label">
              {typeChoisi.labelChamp}
              <input
                type="text"
                value={beneficiaire}
                onChange={(e) => setBeneficiaire(e.target.value)}
                placeholder={typeChoisi.placeholder}
              />
            </label>
          )}

          {erreur && <p className="dispensation-erreur" role="alert">{erreur}</p>}

          <button type="submit" className="dispensation-bouton" disabled={envoi}>
            {envoi ? "Envoi…" : "Enregistrer"}
          </button>
        </form>
      )}
    </div>
  );
}