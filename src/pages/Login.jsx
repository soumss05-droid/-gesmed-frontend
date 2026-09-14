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

      localStorage.setItem("gesmed_token", data.token);
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
          <span className="login-panel__mark">GesMed</span>
          <p className="login-panel__tagline">
            Suivi des médicaments, de la centrale d'achat
            <br />
            jusqu'à la formation sanitaire.
          </p>
        </div>

        <svg
          className="login-panel__circuit"
          viewBox="0 0 360 420"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M 60 40 L 60 130 L 180 130 L 180 220 L 300 220 L 300 310 L 180 310 L 180 380"
            className="circuit-line"
            fill="none"
          />
          <path
            d="M 180 220 L 60 220 L 60 380"
            className="circuit-line circuit-line--branch"
            fill="none"
          />

          <g className="circuit-node" transform="translate(60, 40)">
            <circle r="7" />
            <text x="18" y="5">CAMEC centrale</text>
          </g>
          <g className="circuit-node" transform="translate(180, 130)">
            <circle r="7" />
            <text x="18" y="5">GAS Programme national</text>
          </g>
          <g className="circuit-node" transform="translate(300, 220)">
            <circle r="7" />
            <text x="18" y="5" textAnchor="end" x2="-18">
              GAS DRS
            </text>
          </g>
          <g className="circuit-node" transform="translate(60, 220)">
            <circle r="7" />
            <text x="18" y="5">GAS Moughataa</text>
          </g>
          <g className="circuit-node circuit-node--end" transform="translate(180, 310)">
            <circle r="7" />
            <text x="18" y="5">Formation sanitaire</text>
          </g>
        </svg>
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