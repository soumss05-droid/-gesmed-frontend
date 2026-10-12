import { useEffect, useState } from "react";
import "./AdminPanel.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const LIBELLES_ACTION = {
  COMPTE_CREE: "Compte créé",
  FOSA_CREEE: "FOSA + compte créés",
};

const LIBELLES_ROLE = {
  GAS_MOUGHATAA: "GAS Moughataa",
  MEDECIN_CHEF_MOUGHATAA: "MCM",
  FORMATION_SANITAIRE: "Responsable FOSA",
};

function lireToken() {
  try {
    return localStorage.getItem("SYGIMS_token") || localStorage.getItem("gesmed_token") || "";
  } catch {
    return "";
  }
}

async function appelApi(chemin, options) {
  const res = await fetch(`${API_URL}${chemin}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lireToken()}`,
      ...(options?.headers || {}),
    },
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.erreur || "Une erreur est survenue.");
  return data;
}

function formaterDate(iso) {
  try {
    return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

// Vue ADMIN : ce que les GAS DRS ont créé via « Mon équipe ».
// Lecture seule ; l'admin marque les entrées comme « vues ». Pour agir sur un
// compte (désactiver, réinitialiser le mot de passe) : Administration > Utilisateurs.
export default function JournalEquipe({ onRetour }) {
  const [entrees, setEntrees] = useState([]);
  const [nonLus, setNonLus] = useState(0);
  const [nonLusSeulement, setNonLusSeulement] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [chargement, setChargement] = useState(true);

  async function charger(seulementNonLus = nonLusSeulement) {
    setErreur(null);
    try {
      const data = await appelApi(`/journal-equipe?nonLusSeulement=${seulementNonLus}`);
      setEntrees(data.entrees);
      setNonLus(data.nonLus);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function marquer(id) {
    try {
      await appelApi(`/journal-equipe/${id}/lu`, { method: "POST" });
      await charger();
    } catch (e) {
      setErreur(e.message);
    }
  }

  async function toutMarquer() {
    try {
      await appelApi("/journal-equipe/tout-lu", { method: "POST" });
      await charger();
    } catch (e) {
      setErreur(e.message);
    }
  }

  function basculerFiltre(ev) {
    const valeur = ev.target.checked;
    setNonLusSeulement(valeur);
    charger(valeur);
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <button className="admin-retour" onClick={onRetour}>← Retour</button>
        <h1>Activité des DRS{nonLus > 0 ? ` — ${nonLus} nouveau(x)` : ""}</h1>
      </header>

      {erreur && <p className="admin-erreur" role="alert">{erreur}</p>}

      <div className="admin-filtres">
        <label>
          <input type="checkbox" checked={nonLusSeulement} onChange={basculerFiltre} /> Non vus seulement
        </label>{" "}
        {nonLus > 0 && (
          <button className="admin-bouton" type="button" onClick={toutMarquer}>
            Tout marquer comme vu
          </button>
        )}
      </div>

      {chargement ? (
        <p>Chargement…</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>DRS</th>
              <th>Créé par</th>
              <th>Action</th>
              <th>Compte</th>
              <th>Rôle</th>
              <th>Établissement</th>
              <th>Identifiant</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {entrees.length === 0 && (
              <tr><td colSpan={9}>Aucune création pour le moment.</td></tr>
            )}
            {entrees.map((e) => (
              <tr key={e.id} className={e.lu ? "admin-ligne-inactive" : ""}>
                <td>{formaterDate(e.createdAt)}</td>
                <td>{e.drsNom}</td>
                <td>{e.auteurNom}</td>
                <td>{LIBELLES_ACTION[e.action] || e.action}</td>
                <td>{e.compteNom}</td>
                <td>{LIBELLES_ROLE[e.role] || e.role || "—"}</td>
                <td>{e.etablissementNom}</td>
                <td>{e.identifiant}</td>
                <td>
                  {!e.lu && (
                    <button className="admin-lien-action" type="button" onClick={() => marquer(e.id)}>
                      Marquer vu
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}