import { useState } from "react";
import "./AdminPanel.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

function lireToken() {
  try {
    return localStorage.getItem("SYGIMS_token") || localStorage.getItem("gesmed_token") || "";
  } catch {
    return "";
  }
}

export default function ChangerMotDePasse({ onRetour }) {
  const [ancien, setAncien] = useState("");
  const [nouveau, setNouveau] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [afficher, setAfficher] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [message, setMessage] = useState(null);

  async function envoyer(e) {
    e.preventDefault();
    setErreur(null);
    setMessage(null);

    if (!ancien || !nouveau || !confirmation) {
      setErreur("Remplis les trois champs.");
      return;
    }
    if (nouveau.length < 8) {
      setErreur("Le nouveau mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (nouveau !== confirmation) {
      setErreur("La confirmation ne correspond pas au nouveau mot de passe.");
      return;
    }
    if (nouveau === ancien) {
      setErreur("Le nouveau mot de passe doit être différent de l'ancien.");
      return;
    }

    setEnCours(true);
    try {
      const res = await fetch(`${API_URL}/auth/changer-mot-de-passe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${lireToken()}`,
        },
        body: JSON.stringify({ ancienMotDePasse: ancien, nouveauMotDePasse: nouveau }),
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.erreur || "Connexion instable, réessaie.");
      setMessage("Mot de passe modifié. Utilise-le à ta prochaine connexion.");
      setAncien("");
      setNouveau("");
      setConfirmation("");
    } catch (err) {
      setErreur(err.message || "Connexion instable, réessaie.");
    } finally {
      setEnCours(false);
    }
  }

  const typeChamp = afficher ? "text" : "password";

  return (
    <div className="admin-page">
      <header className="admin-header">
        <button className="admin-retour" onClick={onRetour}>← Retour</button>
        <h1>Changer mon mot de passe</h1>
      </header>

      {erreur && <p className="admin-erreur" role="alert">{erreur}</p>}
      {message && (
        <div className="admin-message" role="status">
          <p>{message}</p>
        </div>
      )}

      <form className="admin-formulaire" onSubmit={envoyer}>
        <div className="admin-grille">
          <div className="admin-champ">
            <label>Ancien mot de passe</label>
            <input
              type={typeChamp}
              autoComplete="current-password"
              value={ancien}
              onChange={(e) => setAncien(e.target.value)}
              disabled={enCours}
            />
          </div>
          <div className="admin-champ">
            <label>Nouveau mot de passe (8 caractères minimum)</label>
            <input
              type={typeChamp}
              autoComplete="new-password"
              value={nouveau}
              onChange={(e) => setNouveau(e.target.value)}
              disabled={enCours}
            />
          </div>
          <div className="admin-champ">
            <label>Confirmer le nouveau mot de passe</label>
            <input
              type={typeChamp}
              autoComplete="new-password"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              disabled={enCours}
            />
          </div>
        </div>
        <p>
          <label>
            <input type="checkbox" checked={afficher} onChange={(e) => setAfficher(e.target.checked)} /> Afficher les
            mots de passe
          </label>
        </p>
        <button className="admin-bouton" type="submit" disabled={enCours}>
          {enCours ? "Enregistrement…" : "Changer mon mot de passe"}
        </button>
      </form>
    </div>
  );
}