import { useState } from "react";
import "./Login.css";

// Ajuste cette URL vers ton backend Render une fois en prod
// (variable d'env recommandée: import.meta.env.VITE_API_URL)
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function Login({ onLoginSuccess }) {
  const [identifiant, setIdentifiant] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Rempli seulement si le backend répond qu'il faut choisir un établissement
  // (utilisateur rattaché à plusieurs établissements).
  const [etablissements, setEtablissements] = useState(null);
  const [etablissementId, setEtablissementId] = useState("");

  async function envoyerConnexion(payload) {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error("Connexion instable, réessayez.");
    }

    if (!res.ok) {
      throw new Error(data.erreur || "Connexion instable, réessayez.");
    }

    return data;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    // Chrome peut remplir les champs sans prevenir React : on lit les valeurs affichees
    const champs = e.currentTarget.elements;
    const identifiant = champs.identifiant ? champs.identifiant.value : "";
    const motDePasse = champs.motDePasse ? champs.motDePasse.value : "";
    setIdentifiant(identifiant);
    setMotDePasse(motDePasse);

    if (!identifiant.trim() || !motDePasse) {
      setError("Renseigne ton identifiant et ton mot de passe.");
      return;
    }

    if (etablissements && !etablissementId) {
      setError("Choisis un établissement pour continuer.");
      return;
    }

    setLoading(true);
    try {
      const data = await envoyerConnexion({
        identifiant,
        motDePasse,
        ...(etablissementId && { etablissementId }),
      });

      // Le backend a plusieurs établissements rattachés à proposer :
      // on affiche le choix et on attend un second envoi.
      if (data.choixEtablissementRequis) {
        setEtablissements(data.etablissements);
        return;
      }

      localStorage.setItem("SYGIMS_token", data.token);
      onLoginSuccess?.(data);
    } catch (err) {
      setError(err.message || "Connexion instable, réessayez.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <aside className="login-panel" aria-hidden="true">
        <div className="login-panel__brand">
          <div className="login-panel__logo"><img src="/logo-sygims.png" alt="SYGIMS, Médicaments, Stocks, Traçabilité" /></div>
          <p className="login-panel__tagline">
            Suivi des médicaments, de la centrale d'achat
            <br />
            jusqu'à la formation sanitaire.
          </p>
        </div>

        <div className="login-panel__circuit login-niveaux-bloc">
          <ol className="login-niveaux">
            <span className="login-niveaux__impulsion" aria-hidden="true" />
            <li className="login-niveau login-niveau--depart"><span className="login-niveau__point">1</span><div className="login-niveau__carte"><b>CAMEC centrale</b><span>Garde le stock central et expédie</span></div></li>
            <li className="login-niveau login-niveau--validation"><span className="login-niveau__point">2</span><div className="login-niveau__carte"><b>GAS Programme</b><em className="login-niveau__etiquette">valide</em><span>Décide et contrôle, sans stock</span></div></li>
            <li className="login-niveau"><span className="login-niveau__point">3</span><div className="login-niveau__carte"><b>SAMEC Régional</b><span>Valide et approvisionne la wilaya</span></div></li>
            <li className="login-niveau"><span className="login-niveau__point">4</span><div className="login-niveau__carte"><b>SASSM Moughataa</b><span>Valide et approvisionne la moughataa</span></div></li>
            <li className="login-niveau"><span className="login-niveau__point">5</span><div className="login-niveau__carte"><b>Formation sanitaire</b><span>Commande et dispense les produits</span></div></li>
          </ol>
          <p className="login-legende"><span><i>↓</i>Les produits descendent</span><span><i>↑</i>La réquisition monte</span></p>
        </div>
      </aside>

      <main className="login-main">
        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <h1>Se connecter</h1>
          <p className="login-form__subtitle">
            Accède à ton espace selon ton établissement et ton rôle.
          </p>

          <label className="login-field">
            <span>Identifiant</span>
            <input
              type="text"
              autoComplete="username"
              name="identifiant"
              value={identifiant}
              onChange={(e) => setIdentifiant(e.target.value)}
              disabled={loading || !!etablissements}
            />
          </label>

          <label className="login-field">
            <span>Mot de passe</span>
            <div className="login-field__password">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                name="motDePasse"
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
                disabled={loading || !!etablissements}
              />
              <button
                type="button"
                className="login-field__toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={
                  showPassword
                    ? "Masquer le mot de passe"
                    : "Afficher le mot de passe"
                }
                disabled={!!etablissements}
              >
                {showPassword ? "Masquer" : "Afficher"}
              </button>
            </div>
          </label>

          {etablissements && (
            <label className="login-field">
              <span>Établissement</span>
              <select
                value={etablissementId}
                onChange={(e) => setEtablissementId(e.target.value)}
                disabled={loading}
                autoFocus
              >
                <option value="" disabled>
                  Choisis un établissement…
                </option>
                {etablissements.map((etab) => (
                  <option key={etab.id} value={etab.id}>
                    {etab.nom} — {etab.role}
                  </option>
                ))}
              </select>
            </label>
          )}

          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="login-submit" disabled={loading}>
            {loading ? "Connexion…" : "Se connecter"}
          </button>
        </form>
      </main>
    </div>
  );
}