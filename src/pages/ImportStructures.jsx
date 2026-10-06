import { useState } from "react";
import "./AdminPanel.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const LIBELLES_ROLE_COMPTE = {
  GESTIONNAIRE_DRS: "GAS DRS",
  DIRECTEUR_DRS: "Directeur DRS",
  GAS_MOUGHATAA: "GAS Moughataa",
  MEDECIN_CHEF_MOUGHATAA: "MCM",
};

// Deux imports de structure, même écran :
//   type="drs"        -> POST /admin/drs/import
//   type="moughataa"  -> POST /admin/moughataa/import
// Chaque ligne crée la structure, son dépôt et les comptes (GAS, et
// Directeur / MCM si renseigné). Les mots de passe en clair ne sont visibles
// qu'ici, juste après l'import : le bouton CSV permet de les récupérer.
const CONFIGS = {
  drs: {
    titre: "Importer des DRS en masse",
    url: "/admin/drs/import",
    colonnes: (
      <>
        <strong>Region</strong>, <strong>Code</strong> (obligatoire pour une nouvelle DRS),{" "}
        <strong>Depot</strong> (optionnel — par défaut « Dépôt de la DRS … »), <strong>GAS</strong> (gestionnaire du
        dépôt), <strong>Telephone GAS</strong>, <strong>Identifiant GAS</strong> (optionnels),{" "}
        <strong>Directeur</strong>, <strong>Telephone Directeur</strong>, <strong>Identifiant Directeur</strong>{" "}
        (optionnels).
      </>
    ),
    colonneNom: "DRS",
    prefixeFichier: "identifiants_drs",
  },
  moughataa: {
    titre: "Importer des moughataa en masse",
    url: "/admin/moughataa/import",
    colonnes: (
      <>
        <strong>Moughataa</strong>, <strong>Region</strong> (nom exact d'une DRS déjà créée), <strong>Depot</strong>{" "}
        (optionnel — par défaut « Dépôt de la moughataa … »), <strong>GAS</strong> (gestionnaire du dépôt),{" "}
        <strong>Telephone GAS</strong>, <strong>Identifiant GAS</strong> (optionnels), <strong>MCM</strong>,{" "}
        <strong>Telephone MCM</strong>, <strong>Identifiant MCM</strong> (optionnels).
      </>
    ),
    colonneNom: "Moughataa",
    prefixeFichier: "identifiants_moughataa",
  },
};

export default function ImportStructures({ type, token, onTermine }) {
  const config = CONFIGS[type];
  const [fichier, setFichier] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [resultat, setResultat] = useState(null);
  const [message, setMessage] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [cleInput, setCleInput] = useState(0); // remet le champ fichier à zéro

  async function lancerImport(ev) {
    ev.preventDefault();
    if (!fichier) {
      setErreur("Choisis un fichier Excel ou CSV avant d'importer.");
      return;
    }
    setErreur(null);
    setMessage(null);
    setResultat(null);
    setEnCours(true);
    try {
      // multipart : pas de Content-Type manuel, le navigateur fixe le boundary.
      const formData = new FormData();
      formData.append("fichier", fichier);
      const res = await fetch(`${API_URL}${config.url}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const texte = await res.text();
      let data = null;
      try {
        data = JSON.parse(texte);
      } catch {
        data = null;
      }
      if (!data) {
        throw new Error(
          `Réponse inattendue du serveur (HTTP ${res.status}). Vérifie que le backend est à jour et redémarré.`
        );
      }
      if (!res.ok) throw new Error(data.erreur || `Échec de l'import (HTTP ${res.status}).`);
      setMessage(data.message);
      setResultat(data.resultats);
      setFichier(null);
      setCleInput((n) => n + 1);
      if (onTermine) onTermine();
    } catch (err) {
      setErreur(
        err instanceof TypeError
          ? "Impossible de joindre le serveur. Vérifie que le backend est démarré."
          : err.message
      );
    } finally {
      setEnCours(false);
    }
  }

  // Retire le fichier choisi (et remet le champ à zéro, sinon le navigateur
  // garde le nom du fichier affiché).
  function retirerFichier() {
    setFichier(null);
    setErreur(null);
    setCleInput((n) => n + 1);
  }

  function telechargerIdentifiants() {
    const lignesCsv = [];
    const echapper = (v) => `"${(v || "").toString().replace(/"/g, '""')}"`;
    for (const r of resultat || []) {
      if (r.statut !== "ok") continue;
      for (const c of r.comptes || []) {
        lignesCsv.push(
          [r.nom, LIBELLES_ROLE_COMPTE[c.role] || c.role, c.nomComplet, c.identifiant, c.motDePasse]
            .map(echapper)
            .join(";")
        );
      }
    }
    if (lignesCsv.length === 0) return;
    const entetes = [config.colonneNom, "Fonction", "Nom", "Identifiant", "Mot de passe"];
    const contenu = [entetes.join(";"), ...lignesCsv].join("\n");
    const blob = new Blob(["\uFEFF" + contenu], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const lien = document.createElement("a");
    lien.href = url;
    lien.download = `${config.prefixeFichier}_${new Date().toISOString().slice(0, 10)}.csv`;
    lien.click();
    URL.revokeObjectURL(url);
  }

  const nbOk = (resultat || []).filter((r) => r.statut === "ok").length;

  return (
    <>
      <form className="admin-formulaire" onSubmit={lancerImport}>
        <h2>{config.titre}</h2>
        <p className="admin-reconciliation-note">
          Fichier Excel (.xlsx) ou CSV avec les colonnes : {config.colonnes} Une ligne crée la structure, son dépôt et
          les comptes (un mot de passe est généré pour chacun). Seule la première feuille du fichier est lue.
        </p>
        <div className="admin-grille">
          <div className="admin-champ">
            <label>Fichier</label>
            <input
              key={cleInput}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                setFichier(e.target.files?.[0] || null);
                setErreur(null);
              }}
            />
            {fichier && (
              <div className="admin-rattachement-ligne">
                <span>Fichier choisi : {fichier.name}</span>
                <button type="button" className="admin-lien-action" onClick={retirerFichier} disabled={enCours}>
                  Retirer
                </button>
              </div>
            )}
          </div>
        </div>
        <button type="submit" className="admin-bouton" disabled={enCours}>
          {enCours ? "Import en cours..." : "Importer"}
        </button>
        {enCours && <p className="admin-reconciliation-note">Envoi du fichier au serveur, patiente...</p>}
        {erreur && <p className="admin-erreur" role="alert">{erreur}</p>}
        {message && <p className="admin-message">{message}</p>}
      </form>

      {resultat && (
        <div className="admin-reconciliation">
          <div className="admin-rattachement-ligne">
            <span>
              {nbOk} ligne(s) créée(s) sur {resultat.length}.
            </span>
            {nbOk > 0 && (
              <button type="button" className="admin-lien-action" onClick={telechargerIdentifiants}>
                Télécharger les identifiants (CSV)
              </button>
            )}
          </div>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Ligne</th>
                <th>{config.colonneNom}</th>
                <th>Résultat</th>
              </tr>
            </thead>
            <tbody>
              {resultat.map((r) => (
                <tr key={r.ligne} className={r.statut === "erreur" ? "admin-ligne-inactive" : ""}>
                  <td>{r.ligne}</td>
                  <td>{r.nom}</td>
                  <td>
                    {r.statut === "ok"
                      ? `${r.message} Identifiants : ${(r.comptes || []).map((c) => c.identifiant).join(", ")}`
                      : r.message}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}