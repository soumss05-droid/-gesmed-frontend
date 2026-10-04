import { useEffect, useState } from "react";
import "./Verrouillage.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const LIBELLE_CIBLE_PAR_ROLE = {
  GAS_MOUGHATAA: "formations sanitaires de ta moughataa",
  GESTIONNAIRE_DRS: "GAS Moughataa de ta DRS",
  DIRECTEUR_DRS: "GAS Moughataa de ta DRS",
  GAS_PROGRAMME_NATIONAL: "GAS DRS du pays, pour les produits de ton programme",
};

async function appelApi(chemin, options, token) {
  const res = await fetch(`${API_URL}${chemin}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options?.headers || {}),
    },
    cache: "no-store",
  });
  const data = res.status === 204 ? null : await res.json();
  if (!res.ok) throw new Error(data?.erreur || "Une erreur est survenue.");
  return data;
}

export default function Verrouillage({ session, onRetour }) {
  const token = localStorage.getItem("SYGIMS_token");
  const role = session.utilisateur.role;

  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [message, setMessage] = useState(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [etat, setEtat] = useState(null);

  async function charger() {
    setChargement(true);
    setErreur(null);
    try {
      const data = await appelApi("/verrouillage/ma-zone", { method: "GET" }, token);
      setEtat(data);
    } catch (err) {
      setErreur(err.message);
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    charger();
  }, []);

  async function verrouillerZone() {
    const cible = LIBELLE_CIBLE_PAR_ROLE[role] || "les établissements de ta zone";
    if (!window.confirm(`Verrouiller la saisie manuelle de stock (/stocks/entree) pour ${cible} ? Cette action peut ensuite être annulée uniquement par l'administrateur.`)) {
      return;
    }
    setErreur(null);
    setMessage(null);
    setEnvoiEnCours(true);
    try {
      const resultat = await appelApi("/verrouillage/ma-zone", { method: "POST" }, token);
      setMessage(resultat.message);
      charger();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnvoiEnCours(false);
    }
  }

  return (
    <div className="verrouillage-page">
      <header className="verrouillage-header">
        <button className="verrouillage-retour" onClick={onRetour}>← Retour</button>
        <h1>Verrouillage de la saisie initiale</h1>
      </header>

      <p className="verrouillage-explication">
        Une fois que {LIBELLE_CIBLE_PAR_ROLE[role] || "les établissements de ta zone"} ont terminé de saisir leur
        dotation de départ, tu peux verrouiller leur accès à la saisie manuelle de stock : au-delà, leurs entrées
        devront passer par le circuit officiel réquisition / bordereau de livraison. Seul un administrateur peut
        ensuite lever ce verrou.
      </p>

      {erreur && <p className="verrouillage-erreur" role="alert">{erreur}</p>}
      {message && <p className="verrouillage-message">{message}</p>}

      <button
        type="button"
        className="verrouillage-bouton"
        onClick={verrouillerZone}
        disabled={envoiEnCours || chargement}
      >
        {envoiEnCours ? "Verrouillage en cours..." : "Verrouiller ma zone"}
      </button>

      {chargement ? (
        <p>Chargement...</p>
      ) : (
        <table className="verrouillage-table">
          <thead>
            <tr>
              <th>Établissement</th>
              <th>État</th>
            </tr>
          </thead>
          <tbody>
            {etat?.etablissements?.map((e) => (
              <tr key={e.id}>
                <td>{e.nom}</td>
                <td>
                  {e.verrouille ? (
                    <span className="verrouillage-badge verrouillage-badge--verrouille">Verrouillé</span>
                  ) : (
                    <span className="verrouillage-badge verrouillage-badge--libre">Libre</span>
                  )}
                </td>
              </tr>
            ))}
            {etat?.etablissements?.length === 0 && (
              <tr>
                <td colSpan={2}>Aucun établissement trouvé dans ta zone.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}