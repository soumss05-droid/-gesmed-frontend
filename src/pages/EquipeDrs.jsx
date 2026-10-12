import { useEffect, useState } from "react";
import "./AdminPanel.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const LIBELLES_ROLE = {
  GAS_MOUGHATAA: "GAS Moughataa",
  MEDECIN_CHEF_MOUGHATAA: "Médecin Chef de Moughataa (MCM)",
  FORMATION_SANITAIRE: "Responsable de formation sanitaire",
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

// Envoi d'un fichier : pas de Content-Type manuel (le navigateur ajoute la
// frontière multipart lui-même).
async function envoyerFichier(chemin, formData) {
  const res = await fetch(`${API_URL}${chemin}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${lireToken()}` },
    body: formData,
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.erreur || "Une erreur est survenue.");
  return data;
}

const LIBELLES_STATUT_IMPORT = {
  a_creer: "À créer",
  cree: "Créée",
  existe: "Déjà présente",
  erreur: "Erreur",
};

function telechargerIdentifiantsCsv(resultats) {
  const lignes = resultats.filter((r) => r.statut === "cree");
  const echapper = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const entete = ["FOSA", "Moughataa", "Responsable", "Identifiant", "Mot de passe"];
  const corps = lignes.map((r) =>
    [r.nomFosa, r.moughataa, r.responsable, r.identifiant, r.motDePasse].map(echapper).join(";")
  );
  const contenu = "\uFEFF" + [entete.map(echapper).join(";"), ...corps].join("\r\n");
  const blob = new Blob([contenu], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "identifiants_fosa.csv";
  a.click();
  URL.revokeObjectURL(url);
}

const FORM_COMPTE_VIDE = { nomComplet: "", telephone: "", identifiant: "", role: "GAS_MOUGHATAA", etablissementId: "" };
const FORM_FOSA_VIDE = { nom: "", moughataaId: "", responsable: "", telephone: "", identifiant: "" };

// « Mon équipe » — le gestionnaire (GAS) de DRS crée les comptes et les FOSA
// de SA région. Les comptes sont actifs tout de suite ; l'administrateur les
// voit et peut les désactiver ou réinitialiser leur mot de passe.
export default function EquipeDrs({ onRetour }) {
  const [onglet, setOnglet] = useState("comptes");
  const [perimetre, setPerimetre] = useState(null);
  const [comptes, setComptes] = useState([]);
  const [formCompte, setFormCompte] = useState(FORM_COMPTE_VIDE);
  const [formFosa, setFormFosa] = useState(FORM_FOSA_VIDE);
  const [identifiantsCrees, setIdentifiantsCrees] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [fichier, setFichier] = useState(null);
  const [cleInput, setCleInput] = useState(0);
  const [analyse, setAnalyse] = useState(null); // résultat de la simulation
  const [resultatImport, setResultatImport] = useState(null); // résultat réel

  async function charger() {
    try {
      const [p, c] = await Promise.all([appelApi("/equipe/perimetre"), appelApi("/equipe/comptes")]);
      setPerimetre(p);
      setComptes(c);
    } catch (e) {
      setErreur(e.message);
    }
  }

  useEffect(() => {
    charger();
  }, []);

  // Établissements proposés selon le rôle choisi.
  const etablissementsDuRole =
    formCompte.role === "FORMATION_SANITAIRE" ? perimetre?.fosa || [] : perimetre?.depotsMoughataa || [];

  async function envoyer(chemin, corps, formVide, setForm) {
    setErreur(null);
    setIdentifiantsCrees(null);
    setEnCours(true);
    try {
      const data = await appelApi(chemin, { method: "POST", body: JSON.stringify(corps) });
      setIdentifiantsCrees(data);
      setForm(formVide);
      await charger();
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(false);
    }
  }

  function creerCompte(ev) {
    ev.preventDefault();
    envoyer("/equipe/comptes", formCompte, FORM_COMPTE_VIDE, setFormCompte);
  }

  function creerFosa(ev) {
    ev.preventDefault();
    envoyer("/equipe/fosa", formFosa, FORM_FOSA_VIDE, setFormFosa);
  }

  async function lancerImport(simulation) {
    if (!fichier) {
      setErreur("Choisis d'abord un fichier Excel ou CSV.");
      return;
    }
    setErreur(null);
    setEnCours(true);
    try {
      const fd = new FormData();
      fd.append("fichier", fichier);
      fd.append("simulation", simulation ? "true" : "false");
      const data = await envoyerFichier("/equipe/import-fosa", fd);
      if (simulation) {
        setAnalyse(data);
        setResultatImport(null);
      } else {
        setResultatImport(data);
        setAnalyse(null);
        setFichier(null);
        setCleInput((k) => k + 1);
        await charger();
      }
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(false);
    }
  }

  function changerFichier(ev) {
    setFichier(ev.target.files?.[0] || null);
    setAnalyse(null);
    setResultatImport(null);
  }

  function copierIdentifiants() {
    const c = identifiantsCrees?.compte;
    if (!c) return;
    const texte = `SYGIMS — ${c.etablissement}\nIdentifiant : ${c.identifiant}\nMot de passe : ${c.motDePasse}`;
    navigator.clipboard?.writeText(texte).catch(() => {});
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <button className="admin-retour" onClick={onRetour}>← Retour</button>
        <h1>Mon équipe{perimetre?.drs ? ` — ${perimetre.drs.nom}` : ""}</h1>
      </header>

      {erreur && <p className="admin-erreur" role="alert">{erreur}</p>}

      {identifiantsCrees && (
        <div className="admin-message" role="status">
          <p>{identifiantsCrees.message}</p>
          <p>
            <strong>{identifiantsCrees.compte.nomComplet}</strong> — {identifiantsCrees.compte.etablissement}
            <br />
            Identifiant : <strong>{identifiantsCrees.compte.identifiant}</strong>
            <br />
            Mot de passe : <strong>{identifiantsCrees.compte.motDePasse}</strong>
          </p>
          <button className="admin-bouton" type="button" onClick={copierIdentifiants}>Copier</button>{" "}
          <button className="admin-lien-action" type="button" onClick={() => setIdentifiantsCrees(null)}>Masquer</button>
          <p className="admin-reconciliation-note">
            Note ces informations maintenant : le mot de passe ne sera plus affiché. Communique-le directement à la
            personne concernée.
          </p>
        </div>
      )}

      <div className="admin-onglets">
        <button className={onglet === "comptes" ? "admin-onglet-actif" : "admin-onglet"} onClick={() => setOnglet("comptes")}>
          Nouveau compte
        </button>
        <button className={onglet === "fosa" ? "admin-onglet-actif" : "admin-onglet"} onClick={() => setOnglet("fosa")}>
          Nouvelle formation sanitaire
        </button>
        <button className={onglet === "import" ? "admin-onglet-actif" : "admin-onglet"} onClick={() => setOnglet("import")}>
          Import en masse (FOSA)
        </button>
        <button className={onglet === "liste" ? "admin-onglet-actif" : "admin-onglet"} onClick={() => setOnglet("liste")}>
          Comptes de ma région ({comptes.length})
        </button>
      </div>

      {onglet === "comptes" && (
        <form className="admin-formulaire" onSubmit={creerCompte}>
          <h2>Créer un compte dans ma région</h2>
          <div className="admin-grille">
            <div className="admin-champ">
              <label>Rôle</label>
              <select
                value={formCompte.role}
                onChange={(e) => setFormCompte({ ...formCompte, role: e.target.value, etablissementId: "" })}
              >
                {(perimetre?.roles || []).map((r) => (
                  <option key={r} value={r}>{LIBELLES_ROLE[r] || r}</option>
                ))}
              </select>
            </div>
            <div className="admin-champ">
              <label>{formCompte.role === "FORMATION_SANITAIRE" ? "Formation sanitaire" : "Dépôt de la moughataa"}</label>
              <select
                required
                value={formCompte.etablissementId}
                onChange={(e) => setFormCompte({ ...formCompte, etablissementId: e.target.value })}
              >
                <option value="">— Choisir —</option>
                {etablissementsDuRole.map((e) => (
                  <option key={e.id} value={e.id}>{e.nom}{e.moughataa ? ` (${e.moughataa})` : ""}</option>
                ))}
              </select>
            </div>
            <div className="admin-champ">
              <label>Nom complet</label>
              <input
                required
                value={formCompte.nomComplet}
                onChange={(e) => setFormCompte({ ...formCompte, nomComplet: e.target.value })}
              />
            </div>
            <div className="admin-champ">
              <label>Téléphone (optionnel)</label>
              <input
                value={formCompte.telephone}
                onChange={(e) => setFormCompte({ ...formCompte, telephone: e.target.value })}
              />
            </div>
            <div className="admin-champ">
              <label>Identifiant (optionnel — généré sinon)</label>
              <input
                value={formCompte.identifiant}
                onChange={(e) => setFormCompte({ ...formCompte, identifiant: e.target.value })}
              />
            </div>
          </div>
          <button className="admin-bouton" type="submit" disabled={enCours}>
            {enCours ? "Création…" : "Créer le compte"}
          </button>
        </form>
      )}

      {onglet === "fosa" && (
        <form className="admin-formulaire" onSubmit={creerFosa}>
          <h2>Créer une formation sanitaire et son responsable</h2>
          <div className="admin-grille">
            <div className="admin-champ">
              <label>Nom de la FOSA</label>
              <input required value={formFosa.nom} onChange={(e) => setFormFosa({ ...formFosa, nom: e.target.value })} />
            </div>
            <div className="admin-champ">
              <label>Moughataa</label>
              <select
                required
                value={formFosa.moughataaId}
                onChange={(e) => setFormFosa({ ...formFosa, moughataaId: e.target.value })}
              >
                <option value="">— Choisir —</option>
                {(perimetre?.moughataas || []).map((m) => (
                  <option key={m.id} value={m.id}>{m.nom}</option>
                ))}
              </select>
            </div>
            <div className="admin-champ">
              <label>Responsable (nom complet)</label>
              <input
                required
                value={formFosa.responsable}
                onChange={(e) => setFormFosa({ ...formFosa, responsable: e.target.value })}
              />
            </div>
            <div className="admin-champ">
              <label>Téléphone (optionnel)</label>
              <input value={formFosa.telephone} onChange={(e) => setFormFosa({ ...formFosa, telephone: e.target.value })} />
            </div>
            <div className="admin-champ">
              <label>Identifiant (optionnel — généré sinon)</label>
              <input
                value={formFosa.identifiant}
                onChange={(e) => setFormFosa({ ...formFosa, identifiant: e.target.value })}
              />
            </div>
          </div>
          <button className="admin-bouton" type="submit" disabled={enCours}>
            {enCours ? "Création…" : "Créer la FOSA et son compte"}
          </button>
        </form>
      )}

      {onglet === "import" && (
        <div className="admin-formulaire">
          <h2>Importer des formations sanitaires en masse</h2>
          <p className="admin-reconciliation-note">
            Colonnes : <strong>Nom FOSA</strong>, <strong>Moughataa</strong> (une moughataa de ta région),{" "}
            <strong>Responsable</strong> (nom complet), <strong>Telephone</strong> et <strong>Identifiant</strong>{" "}
            (optionnels). Seule la première feuille du fichier est lue. Étape 1 : « Analyser » vérifie le fichier sans
            rien créer. Étape 2 : tu confirmes la création.
          </p>
          <div className="admin-champ">
            <label>Fichier Excel ou CSV</label>
            <input key={cleInput} type="file" accept=".xlsx,.xls,.csv" onChange={changerFichier} />
          </div>
          <button className="admin-bouton" type="button" disabled={enCours || !fichier} onClick={() => lancerImport(true)}>
            {enCours && !analyse ? "Analyse…" : "Analyser le fichier"}
          </button>

          {analyse && (
            <>
              <p className="admin-message">{analyse.message}</p>
              <table className="admin-table">
                <thead>
                  <tr><th>Ligne</th><th>FOSA</th><th>Moughataa</th><th>Responsable</th><th>Identifiant</th><th>Statut</th></tr>
                </thead>
                <tbody>
                  {analyse.resultats.map((r) => (
                    <tr key={r.ligne} className={r.statut === "a_creer" ? "" : "admin-ligne-inactive"}>
                      <td>{r.ligne}</td>
                      <td>{r.nomFosa}</td>
                      <td>{r.moughataa}</td>
                      <td>{r.responsable}</td>
                      <td>{r.identifiant || "—"}</td>
                      <td>{LIBELLES_STATUT_IMPORT[r.statut]}{r.statut !== "a_creer" ? ` — ${r.message}` : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {analyse.resultats.some((r) => r.statut === "a_creer") ? (
                <button className="admin-bouton" type="button" disabled={enCours} onClick={() => lancerImport(false)}>
                  {enCours ? "Création…" : `Confirmer : créer ${analyse.resultats.filter((r) => r.statut === "a_creer").length} FOSA`}
                </button>
              ) : (
                <p className="admin-reconciliation-note">Rien à créer : corrige le fichier puis relance l'analyse.</p>
              )}
            </>
          )}

          {resultatImport && (
            <>
              <p className="admin-message">{resultatImport.message}</p>
              <p className="admin-reconciliation-note">
                Télécharge les identifiants maintenant : les mots de passe ne seront plus affichés.
              </p>
              <button className="admin-bouton" type="button" onClick={() => telechargerIdentifiantsCsv(resultatImport.resultats)}>
                Télécharger les identifiants (CSV)
              </button>
              <table className="admin-table">
                <thead>
                  <tr><th>Ligne</th><th>FOSA</th><th>Responsable</th><th>Identifiant</th><th>Mot de passe</th><th>Statut</th></tr>
                </thead>
                <tbody>
                  {resultatImport.resultats.map((r) => (
                    <tr key={r.ligne} className={r.statut === "cree" ? "" : "admin-ligne-inactive"}>
                      <td>{r.ligne}</td>
                      <td>{r.nomFosa}</td>
                      <td>{r.responsable}</td>
                      <td>{r.identifiant || "—"}</td>
                      <td>{r.motDePasse || "—"}</td>
                      <td>{LIBELLES_STATUT_IMPORT[r.statut]}{r.statut !== "cree" ? ` — ${r.message}` : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {onglet === "liste" && (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Identifiant</th>
              <th>Rôle</th>
              <th>Établissement</th>
              <th>Moughataa</th>
              <th>Téléphone</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {comptes.length === 0 && (
              <tr><td colSpan={7}>Aucun compte dans ta région pour le moment.</td></tr>
            )}
            {comptes.map((c) => (
              <tr key={c.rattachementId} className={c.actif ? "" : "admin-ligne-inactive"}>
                <td>{c.nomComplet}</td>
                <td>{c.identifiant}</td>
                <td>{LIBELLES_ROLE[c.role] || c.role}</td>
                <td>{c.etablissement}</td>
                <td>{c.moughataa || "—"}</td>
                <td>{c.telephone || "—"}</td>
                <td>{c.actif ? "Actif" : "Désactivé"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}