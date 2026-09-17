import { useEffect, useState } from "react";
import "./AdminPanel.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const LIBELLES_TYPE_ETAB = {
  CAMEC: "CAMEC",
  GAS_PROGRAMME_NATIONAL: "GAS Programme national",
  GAS_DRS: "GAS DRS",
  GAS_MOUGHATAA: "GAS Moughataa",
  FORMATION_SANITAIRE: "Formation sanitaire",
};

const LIBELLES_ROLE = {
  GESTIONNAIRE_CAMEC: "Gestionnaire CAMEC",
  GESTIONNAIRE_DRS: "Gestionnaire DRS",
  DIRECTEUR_DRS: "Directeur DRS",
  GAS_MOUGHATAA: "Agent GAS Moughataa",
  GAS_PROGRAMME_NATIONAL: "Agent GAS Programme national",
  FORMATION_SANITAIRE: "Agent formation sanitaire",
  AUDITEUR: "Auditeur",
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

export default function AdminPanel({ onRetour }) {
  const token = localStorage.getItem("gesmed_token");

  const [onglet, setOnglet] = useState("etablissements");
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [message, setMessage] = useState(null);

  const [drsListe, setDrsListe] = useState([]);
  const [programmes, setProgrammes] = useState([]);
  const [roles, setRoles] = useState([]);
  const [etablissements, setEtablissements] = useState([]);
  const [utilisateurs, setUtilisateurs] = useState([]);

  const [formEtab, setFormEtab] = useState({
    nom: "",
    type: "FORMATION_SANITAIRE",
    aStockPhysique: true,
    drsId: "",
    moughataaId: "",
    programmeId: "",
    adresse: "",
  });

  const [formUser, setFormUser] = useState({
    nomComplet: "",
    identifiant: "",
    motDePasse: "",
    telephone: "",
    estAdminSysteme: false,
  });

  const [formRattachement, setFormRattachement] = useState({});

  async function chargerTout() {
    setChargement(true);
    setErreur(null);
    try {
      const [d, p, r, e, u] = await Promise.all([
        appelApi("/admin/drs", { method: "GET" }, token),
        appelApi("/admin/programmes", { method: "GET" }, token),
        appelApi("/admin/roles", { method: "GET" }, token),
        appelApi("/admin/etablissements", { method: "GET" }, token),
        appelApi("/admin/utilisateurs", { method: "GET" }, token),
      ]);
      setDrsListe(d);
      setProgrammes(p);
      setRoles(r);
      setEtablissements(e);
      setUtilisateurs(u);
    } catch (err) {
      setErreur(err.message);
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    chargerTout();
  }, []);

  async function creerEtablissement(ev) {
    ev.preventDefault();
    setErreur(null);
    setMessage(null);
    try {
      await appelApi(
        "/admin/etablissements",
        { method: "POST", body: JSON.stringify(formEtab) },
        token
      );
      setMessage(`Établissement "${formEtab.nom}" créé avec succès.`);
      setFormEtab({
        nom: "",
        type: "FORMATION_SANITAIRE",
        aStockPhysique: true,
        drsId: "",
        moughataaId: "",
        programmeId: "",
        adresse: "",
      });
      chargerTout();
    } catch (err) {
      setErreur(err.message);
    }
  }

  async function basculerActifEtablissement(etab) {
    setErreur(null);
    try {
      await appelApi(
        `/admin/etablissements/${etab.id}`,
        { method: "PATCH", body: JSON.stringify({ actif: !etab.actif }) },
        token
      );
      chargerTout();
    } catch (err) {
      setErreur(err.message);
    }
  }

  async function creerUtilisateur(ev) {
    ev.preventDefault();
    setErreur(null);
    setMessage(null);
    try {
      await appelApi(
        "/admin/utilisateurs",
        { method: "POST", body: JSON.stringify(formUser) },
        token
      );
      setMessage(`Compte "${formUser.identifiant}" créé avec succès.`);
      setFormUser({ nomComplet: "", identifiant: "", motDePasse: "", telephone: "", estAdminSysteme: false });
      chargerTout();
    } catch (err) {
      setErreur(err.message);
    }
  }

  async function basculerActifUtilisateur(u) {
    setErreur(null);
    try {
      await appelApi(
        `/admin/utilisateurs/${u.id}`,
        { method: "PATCH", body: JSON.stringify({ actif: !u.actif }) },
        token
      );
      chargerTout();
    } catch (err) {
      setErreur(err.message);
    }
  }

  async function rattacher(userId) {
    const donnees = formRattachement[userId];
    if (!donnees?.etablissementId || !donnees?.role) {
      setErreur("Choisis un établissement et un rôle avant de rattacher.");
      return;
    }
    setErreur(null);
    setMessage(null);
    try {
      await appelApi(
        `/admin/utilisateurs/${userId}/rattachements`,
        { method: "POST", body: JSON.stringify(donnees) },
        token
      );
      setMessage("Rattachement effectué.");
      setFormRattachement((f) => ({ ...f, [userId]: {} }));
      chargerTout();
    } catch (err) {
      setErreur(err.message);
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <button className="admin-retour" onClick={onRetour}>← Retour</button>
        <h1>Administration</h1>
      </header>

      {erreur && <p className="admin-erreur" role="alert">{erreur}</p>}
      {message && <p className="admin-message">{message}</p>}

      <div className="admin-onglets">
        <button
          className={onglet === "etablissements" ? "admin-onglet-actif" : "admin-onglet"}
          onClick={() => setOnglet("etablissements")}
        >
          Établissements
        </button>
        <button
          className={onglet === "utilisateurs" ? "admin-onglet-actif" : "admin-onglet"}
          onClick={() => setOnglet("utilisateurs")}
        >
          Utilisateurs
        </button>
      </div>

      {chargement ? (
        <p>Chargement...</p>
      ) : onglet === "etablissements" ? (
        <>
          <form className="admin-formulaire" onSubmit={creerEtablissement}>
            <h2>Créer un établissement</h2>
            <div className="admin-grille">
              <div className="admin-champ">
                <label>Nom</label>
                <input
                  type="text"
                  required
                  value={formEtab.nom}
                  onChange={(e) => setFormEtab((f) => ({ ...f, nom: e.target.value }))}
                />
              </div>
              <div className="admin-champ">
                <label>Type</label>
                <select
                  value={formEtab.type}
                  onChange={(e) => setFormEtab((f) => ({ ...f, type: e.target.value }))}
                >
                  {Object.entries(LIBELLES_TYPE_ETAB).map(([val, lib]) => (
                    <option key={val} value={val}>{lib}</option>
                  ))}
                </select>
              </div>
              <div className="admin-champ">
                <label>DRS (si applicable)</label>
                <select
                  value={formEtab.drsId}
                  onChange={(e) => setFormEtab((f) => ({ ...f, drsId: e.target.value }))}
                >
                  <option value="">—</option>
                  {drsListe.map((d) => (
                    <option key={d.id} value={d.id}>{d.nom}</option>
                  ))}
                </select>
              </div>
              <div className="admin-champ">
                <label>Programme (GAS Programme national uniquement)</label>
                <select
                  value={formEtab.programmeId}
                  onChange={(e) => setFormEtab((f) => ({ ...f, programmeId: e.target.value }))}
                >
                  <option value="">—</option>
                  {programmes.map((p) => (
                    <option key={p.id} value={p.id}>{p.nom}</option>
                  ))}
                </select>
              </div>
              <div className="admin-champ">
                <label>A un stock physique ?</label>
                <select
                  value={formEtab.aStockPhysique ? "oui" : "non"}
                  onChange={(e) => setFormEtab((f) => ({ ...f, aStockPhysique: e.target.value === "oui" }))}
                >
                  <option value="oui">Oui</option>
                  <option value="non">Non</option>
                </select>
              </div>
              <div className="admin-champ">
                <label>Adresse (optionnel)</label>
                <input
                  type="text"
                  value={formEtab.adresse}
                  onChange={(e) => setFormEtab((f) => ({ ...f, adresse: e.target.value }))}
                />
              </div>
            </div>
            <button type="submit" className="admin-bouton">Créer l'établissement</button>
          </form>

          <table className="admin-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Type</th>
                <th>Programme</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {etablissements.map((e) => (
                <tr key={e.id} className={!e.actif ? "admin-ligne-inactive" : ""}>
                  <td>{e.nom}</td>
                  <td>{LIBELLES_TYPE_ETAB[e.type] || e.type}</td>
                  <td>{e.programme?.nom || "—"}</td>
                  <td>{e.actif ? "Actif" : "Désactivé"}</td>
                  <td>
                    <button className="admin-lien-action" onClick={() => basculerActifEtablissement(e)}>
                      {e.actif ? "Désactiver" : "Réactiver"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <>
          <form className="admin-formulaire" onSubmit={creerUtilisateur}>
            <h2>Créer un compte</h2>
            <div className="admin-grille">
              <div className="admin-champ">
                <label>Nom complet</label>
                <input
                  type="text"
                  required
                  value={formUser.nomComplet}
                  onChange={(e) => setFormUser((f) => ({ ...f, nomComplet: e.target.value }))}
                />
              </div>
              <div className="admin-champ">
                <label>Identifiant</label>
                <input
                  type="text"
                  required
                  value={formUser.identifiant}
                  onChange={(e) => setFormUser((f) => ({ ...f, identifiant: e.target.value }))}
                />
              </div>
              <div className="admin-champ">
                <label>Mot de passe</label>
                <input
                  type="text"
                  required
                  value={formUser.motDePasse}
                  onChange={(e) => setFormUser((f) => ({ ...f, motDePasse: e.target.value }))}
                />
              </div>
              <div className="admin-champ">
                <label>Téléphone (optionnel)</label>
                <input
                  type="text"
                  value={formUser.telephone}
                  onChange={(e) => setFormUser((f) => ({ ...f, telephone: e.target.value }))}
                />
              </div>
              <div className="admin-champ">
                <label>Admin système ?</label>
                <select
                  value={formUser.estAdminSysteme ? "oui" : "non"}
                  onChange={(e) => setFormUser((f) => ({ ...f, estAdminSysteme: e.target.value === "oui" }))}
                >
                  <option value="non">Non</option>
                  <option value="oui">Oui</option>
                </select>
              </div>
            </div>
            <button type="submit" className="admin-bouton">Créer le compte</button>
          </form>

          <table className="admin-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Identifiant</th>
                <th>Rattachements</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {utilisateurs.map((u) => (
                <tr key={u.id} className={!u.actif ? "admin-ligne-inactive" : ""}>
                  <td>{u.nomComplet}{u.estAdminSysteme ? " (Admin)" : ""}</td>
                  <td>{u.identifiant}</td>
                  <td>
                    {u.etablissements.map((r) => (
                      <div key={r.id}>
                        {LIBELLES_ROLE[r.role] || r.role} — {r.etablissement.nom}
                      </div>
                    ))}
                  </td>
                  <td>{u.actif ? "Actif" : "Désactivé"}</td>
                  <td>
                    <button className="admin-lien-action" onClick={() => basculerActifUtilisateur(u)}>
                      {u.actif ? "Désactiver" : "Réactiver"}
                    </button>
                    <div className="admin-rattachement">
                      <select
                        value={formRattachement[u.id]?.etablissementId || ""}
                        onChange={(e) =>
                          setFormRattachement((f) => ({
                            ...f,
                            [u.id]: { ...f[u.id], etablissementId: e.target.value },
                          }))
                        }
                      >
                        <option value="">Établissement...</option>
                        {etablissements.map((e) => (
                          <option key={e.id} value={e.id}>{e.nom}</option>
                        ))}
                      </select>
                      <select
                        value={formRattachement[u.id]?.role || ""}
                        onChange={(e) =>
                          setFormRattachement((f) => ({
                            ...f,
                            [u.id]: { ...f[u.id], role: e.target.value },
                          }))
                        }
                      >
                        <option value="">Rôle...</option>
                        {roles.map((r) => (
                          <option key={r} value={r}>{LIBELLES_ROLE[r] || r}</option>
                        ))}
                      </select>
                      <button className="admin-lien-action" onClick={() => rattacher(u.id)}>
                        Rattacher
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}