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
  MEDECIN_CHEF_MOUGHATAA: "Médecin Chef de Moughataa",
  GAS_PROGRAMME_NATIONAL: "Agent GAS Programme national",
  FORMATION_SANITAIRE: "Agent formation sanitaire",
  AUDITEUR: "Auditeur",
};

const LIBELLES_TYPE_NOTIF = {
  VALIDEE: "Validée",
  MODIFIEE: "Modifiée",
  SCINDEE: "Scindée",
  REJETEE_POUR_CORRECTION: "Rejetée — à corriger",
  RUPTURE_STOCK: "Rupture de stock",
};

// Libellés dédiés au filtre "Niveau" de l'onglet Stocks — mêmes termes que
// l'écran "Stock du réseau", pour rester cohérent d'un écran à l'autre.
const LIBELLE_NIVEAU_STOCK = {
  CAMEC: "CAMEC",
  GAS_DRS: "Région (DRS)",
  GAS_MOUGHATAA: "Moughataa",
  FORMATION_SANITAIRE: "Formation sanitaire",
  GAS_PROGRAMME_NATIONAL: "GAS Programme national",
};
// Seuls ces deux types d'établissement peuvent être marqués en
// approvisionnement direct CAMEC (Moughataa ou formation sanitaire
// exceptionnels, pour raisons géographiques).
const TYPES_ELIGIBLES_APPRO_DIRECT = ["GAS_MOUGHATAA", "FORMATION_SANITAIRE"];

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
  const token = localStorage.getItem("SYGIMS_token");

  const [onglet, setOnglet] = useState("etablissements");
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [message, setMessage] = useState(null);

  const [drsListe, setDrsListe] = useState([]);
  const [moughataas, setMoughataas] = useState([]);
  const [programmes, setProgrammes] = useState([]);
  const [roles, setRoles] = useState([]);
  const [etablissements, setEtablissements] = useState([]);
  const [utilisateurs, setUtilisateurs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [lots, setLots] = useState([]);
  const [produits, setProduits] = useState([]);
  const [verrous, setVerrous] = useState([]);

  const [filtreLotProduit, setFiltreLotProduit] = useState("");
  const [filtreLotNiveau, setFiltreLotNiveau] = useState("");
  const [filtreLotDateDebut, setFiltreLotDateDebut] = useState("");
  const [filtreLotDateFin, setFiltreLotDateFin] = useState("");

  // Résultat de la dernière réconciliation Stock.quantiteTotale / somme des
  // lots réels (voir reconcilierStocksLots ci-dessous) — affiché sous forme
  // de détail dépliable pour que l'admin voie précisément ce qui a été corrigé.
  const [reconciliationEnCours, setReconciliationEnCours] = useState(false);
  const [reconciliationResultat, setReconciliationResultat] = useState(null);

  const [filtreEtablissement, setFiltreEtablissement] = useState("");
  const [filtreType, setFiltreType] = useState("");
  const [filtreDateDebut, setFiltreDateDebut] = useState("");
  const [filtreDateFin, setFiltreDateFin] = useState("");

  const [filtreEtabType, setFiltreEtabType] = useState("");
  const [filtreEtabDrs, setFiltreEtabDrs] = useState("");
  const [filtreEtabMoughataa, setFiltreEtabMoughataa] = useState("");
  const [filtreEtabStatut, setFiltreEtabStatut] = useState("");

  const [filtreUserEtablissement, setFiltreUserEtablissement] = useState("");
  const [filtreUserRole, setFiltreUserRole] = useState("");
  const [filtreUserStatut, setFiltreUserStatut] = useState("");

  const [formEtab, setFormEtab] = useState({
    nom: "",
    type: "FORMATION_SANITAIRE",
    aStockPhysique: true,
    drsId: "",
    moughataaId: "",
    programmeId: "",
    adresse: "",
    approvisionnementDirectCamec: false,
  });

  const [formUser, setFormUser] = useState({
    nomComplet: "",
    identifiant: "",
    motDePasse: "",
    telephone: "",
    estAdminSysteme: false,
  });

  const [formRattachement, setFormRattachement] = useState({});

  const [formDrs, setFormDrs] = useState({ nom: "", code: "" });
  const [editionDrsId, setEditionDrsId] = useState(null);
  const [editionDrsForm, setEditionDrsForm] = useState({});

  const [formMoughataa, setFormMoughataa] = useState({ nom: "", drsId: "" });
  const [editionMoughataaId, setEditionMoughataaId] = useState(null);
  const [editionMoughataaForm, setEditionMoughataaForm] = useState({});

  const [editionEtabId, setEditionEtabId] = useState(null);
  const [editionEtabForm, setEditionEtabForm] = useState({});

  const [editionUserId, setEditionUserId] = useState(null);
  const [editionUserForm, setEditionUserForm] = useState({});

  const [etablissementAVerrouiller, setEtablissementAVerrouiller] = useState("");
  const [verrouillageEnCours, setVerrouillageEnCours] = useState(false);

  // Import en masse des formations sanitaires (voir importerFosaSubmit).
  const [fichierImportFosa, setFichierImportFosa] = useState(null);
  const [importFosaEnCours, setImportFosaEnCours] = useState(false);
  const [resultatImportFosa, setResultatImportFosa] = useState(null);

  async function chargerTout() {
    setChargement(true);
    setErreur(null);
    try {
      const [d, m, p, r, e, u, n, l, prod, verr] = await Promise.all([
        appelApi("/admin/drs", { method: "GET" }, token),
        appelApi("/admin/moughataa", { method: "GET" }, token),
        appelApi("/admin/programmes", { method: "GET" }, token),
        appelApi("/admin/roles", { method: "GET" }, token),
        appelApi("/admin/etablissements", { method: "GET" }, token),
        appelApi("/admin/utilisateurs", { method: "GET" }, token),
        appelApi("/admin/notifications", { method: "GET" }, token),
        appelApi("/admin/stocks", { method: "GET" }, token),
        appelApi("/produits", { method: "GET" }, token),
        appelApi("/verrouillage", { method: "GET" }, token),
      ]);
      setDrsListe(d);
      setMoughataas(m);
      setProgrammes(p);
      setRoles(r);
      setEtablissements(e);
      setUtilisateurs(u);
      setNotifications(n);
      setLots(l);
      setProduits(prod);
      setVerrous(verr);
    } catch (err) {
      setErreur(err.message);
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    chargerTout();
  }, []);

  // Recale Stock.quantiteTotale sur la somme réelle des lots en base, pour
  // chaque produit/établissement — corrige l'écart historique qui pouvait
  // laisser certains stocks affichés avec une quantité théorique sans lot
  // réel correspondant (donc sans numéro de lot ni péremption affichables
  // dans Stock du réseau).
  async function reconcilierStocksLots() {
    if (!window.confirm("Recaler tous les stocks sur la quantité réelle de leurs lots ? Cette action corrige les écarts existants.")) return;
    setErreur(null);
    setMessage(null);
    setReconciliationResultat(null);
    setReconciliationEnCours(true);
    try {
      const resultat = await appelApi("/admin/reconcilier-stocks-lots", { method: "POST" }, token);
      setMessage(resultat.message);
      setReconciliationResultat(resultat.detail || []);
      chargerTout();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setReconciliationEnCours(false);
    }
  }

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
        approvisionnementDirectCamec: false,
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

  // Bascule l'exception "approvisionnement direct CAMEC" pour un
  // établissement existant, directement depuis le tableau — sans repasser
  // par le formulaire de création.
  async function basculerApprovisionnementDirect(etab) {
    setErreur(null);
    try {
      await appelApi(
        `/admin/etablissements/${etab.id}`,
        { method: "PATCH", body: JSON.stringify({ approvisionnementDirectCamec: !etab.approvisionnementDirectCamec }) },
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

  async function creerDrs(ev) {
    ev.preventDefault();
    setErreur(null);
    setMessage(null);
    try {
      await appelApi("/admin/drs", { method: "POST", body: JSON.stringify(formDrs) }, token);
      setMessage(`DRS "${formDrs.nom}" créée avec succès.`);
      setFormDrs({ nom: "", code: "" });
      chargerTout();
    } catch (err) {
      setErreur(err.message);
    }
  }

  function demarrerEditionDrs(d) {
    setEditionDrsId(d.id);
    setEditionDrsForm({ nom: d.nom, code: d.code });
  }

  async function enregistrerEditionDrs(id) {
    setErreur(null);
    try {
      await appelApi(`/admin/drs/${id}`, { method: "PATCH", body: JSON.stringify(editionDrsForm) }, token);
      setEditionDrsId(null);
      chargerTout();
    } catch (err) {
      setErreur(err.message);
    }
  }

  async function supprimerDrsAction(d) {
    if (!window.confirm(`Supprimer définitivement la DRS "${d.nom}" ? Impossible si des établissements y sont encore rattachés.`)) return;
    setErreur(null);
    try {
      await appelApi(`/admin/drs/${d.id}`, { method: "DELETE" }, token);
      setMessage(`DRS "${d.nom}" supprimée.`);
      chargerTout();
    } catch (err) {
      setErreur(err.message);
    }
  }

  async function creerMoughataaSubmit(ev) {
    ev.preventDefault();
    setErreur(null);
    setMessage(null);
    if (!formMoughataa.drsId) {
      setErreur("Choisis une DRS pour cette Moughataa.");
      return;
    }
    try {
      await appelApi("/admin/moughataa", { method: "POST", body: JSON.stringify(formMoughataa) }, token);
      setMessage(`Moughataa "${formMoughataa.nom}" créée avec succès.`);
      setFormMoughataa({ nom: "", drsId: "" });
      chargerTout();
    } catch (err) {
      setErreur(err.message);
    }
  }

  function demarrerEditionMoughataa(m) {
    setEditionMoughataaId(m.id);
    setEditionMoughataaForm({ nom: m.nom, drsId: m.drsId });
  }

  async function enregistrerEditionMoughataa(id) {
    setErreur(null);
    try {
      await appelApi(`/admin/moughataa/${id}`, { method: "PATCH", body: JSON.stringify(editionMoughataaForm) }, token);
      setEditionMoughataaId(null);
      chargerTout();
    } catch (err) {
      setErreur(err.message);
    }
  }

  async function supprimerMoughataaAction(m) {
    if (!window.confirm(`Supprimer définitivement la Moughataa "${m.nom}" ? Impossible si des établissements y sont encore rattachés.`)) return;
    setErreur(null);
    try {
      await appelApi(`/admin/moughataa/${m.id}`, { method: "DELETE" }, token);
      setMessage(`Moughataa "${m.nom}" supprimée.`);
      chargerTout();
    } catch (err) {
      setErreur(err.message);
    }
  }

  function demarrerEditionEtab(e) {
    setEditionEtabId(e.id);
    setEditionEtabForm({
      nom: e.nom,
      adresse: e.adresse || "",
      drsId: e.drsId || "",
      moughataaId: e.moughataaId || "",
      programmeId: e.programmeId || "",
    });
  }

  async function enregistrerEditionEtab(id) {
    setErreur(null);
    try {
      await appelApi(`/admin/etablissements/${id}`, { method: "PATCH", body: JSON.stringify(editionEtabForm) }, token);
      setEditionEtabId(null);
      chargerTout();
    } catch (err) {
      setErreur(err.message);
    }
  }

  async function supprimerEtablissementAction(e) {
    if (!window.confirm(`Supprimer définitivement "${e.nom}" ? Impossible si des données (stocks, réquisitions, utilisateurs) y sont encore liées — préfère "Désactiver" dans ce cas.`)) return;
    setErreur(null);
    try {
      await appelApi(`/admin/etablissements/${e.id}`, { method: "DELETE" }, token);
      setMessage(`"${e.nom}" supprimé.`);
      chargerTout();
    } catch (err) {
      setErreur(err.message);
    }
  }

  function demarrerEditionUser(u) {
    setEditionUserId(u.id);
    setEditionUserForm({ nomComplet: u.nomComplet, identifiant: u.identifiant, telephone: u.telephone || "" });
  }

  async function enregistrerEditionUser(id) {
    setErreur(null);
    try {
      await appelApi(`/admin/utilisateurs/${id}`, { method: "PATCH", body: JSON.stringify(editionUserForm) }, token);
      setEditionUserId(null);
      chargerTout();
    } catch (err) {
      setErreur(err.message);
    }
  }

  async function retirerRattachementAction(userId, rattachementId, libelle) {
    if (!window.confirm(`Retirer le rattachement "${libelle}" ? Le compte reste actif, seul ce lien est supprimé.`)) return;
    setErreur(null);
    try {
      await appelApi(`/admin/utilisateurs/${userId}/rattachements/${rattachementId}`, { method: "DELETE" }, token);
      setMessage("Rattachement retiré.");
      chargerTout();
    } catch (err) {
      setErreur(err.message);
    }
  }

  // Verrouille manuellement un établissement précis (hors CAMEC) — verrou
  // total, indépendamment de toute cascade de rôle. Utile pour un cas
  // particulier non couvert par le verrouillage en cascade (ex. un
  // établissement isolé, ou une correction manuelle).
  async function verrouillerEtablissementAction(ev) {
    ev.preventDefault();
    if (!etablissementAVerrouiller) {
      setErreur("Choisis un établissement à verrouiller.");
      return;
    }
    setErreur(null);
    setMessage(null);
    setVerrouillageEnCours(true);
    try {
      await appelApi(`/verrouillage/etablissements/${etablissementAVerrouiller}`, { method: "POST" }, token);
      setMessage("Établissement verrouillé.");
      setEtablissementAVerrouiller("");
      chargerTout();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setVerrouillageEnCours(false);
    }
  }

  // Lève tous les verrous (total ou par programme) d'un établissement — seul
  // ADMIN peut le faire, quel que soit le rôle qui les a posés à l'origine.
  async function deverrouillerEtablissementAction(etablissementId, nom) {
    if (!window.confirm(`Lever tous les verrous de saisie initiale pour "${nom}" ? L'établissement pourra à nouveau utiliser /stocks/entree librement.`)) return;
    setErreur(null);
    setMessage(null);
    try {
      const resultat = await appelApi(`/verrouillage/etablissements/${etablissementId}`, { method: "DELETE" }, token);
      setMessage(resultat.message);
      chargerTout();
    } catch (err) {
      setErreur(err.message);
    }
  }

  // Import en masse de formations sanitaires depuis un fichier Excel/CSV —
  // voir POST /admin/etablissements/import-fosa. multipart/form-data, donc
  // pas d'appelApi ici (celui-ci force Content-Type: application/json) :
  // fetch direct, en laissant le navigateur fixer le boundary multipart.
  async function importerFosaSubmit(ev) {
    ev.preventDefault();
    if (!fichierImportFosa) {
      setErreur("Choisis un fichier Excel ou CSV avant d'importer.");
      return;
    }
    setErreur(null);
    setMessage(null);
    setResultatImportFosa(null);
    setImportFosaEnCours(true);
    try {
      const formData = new FormData();
      formData.append("fichier", fichierImportFosa);
      const res = await fetch(`${API_URL}/admin/etablissements/import-fosa`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erreur || "Échec de l'import.");
      setMessage(data.message);
      setResultatImportFosa(data.resultats);
      setFichierImportFosa(null);
      chargerTout();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setImportFosaEnCours(false);
    }
  }

  // Génère un fichier CSV téléchargeable avec les identifiants et mots de
  // passe des comptes créés avec succès — seul moment où le mot de passe en
  // clair est visible, donc seul moment où il peut être récupéré pour
  // distribution aux responsables.
  function telechargerIdentifiantsFosa() {
    const lignesOk = (resultatImportFosa || []).filter((r) => r.statut === "ok");
    if (lignesOk.length === 0) return;
    const echapper = (v) => `"${(v || "").toString().replace(/"/g, '""')}"`;
    const entetes = ["FOSA", "Moughataa", "Responsable", "Identifiant", "Mot de passe"];
    const lignesCsv = lignesOk.map((r) =>
      [r.nomFosa, r.moughataa, r.responsable, r.identifiant, r.motDePasse].map(echapper).join(";")
    );
    const contenu = [entetes.join(";"), ...lignesCsv].join("\n");
    const blob = new Blob(["\uFEFF" + contenu], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const lien = document.createElement("a");
    lien.href = url;
    lien.download = `identifiants_fosa_${new Date().toISOString().slice(0, 10)}.csv`;
    lien.click();
    URL.revokeObjectURL(url);
  }

  // Regroupe les lignes de verrous par établissement, pour n'afficher qu'une
  // ligne par établissement dans le tableau (avec le détail des programmes
  // concernés si le verrou n'est pas total).
  const verrousParEtablissement = verrous.reduce((acc, v) => {
    if (!acc[v.etablissementId]) {
      acc[v.etablissementId] = { etablissement: v.etablissement, lignes: [] };
    }
    acc[v.etablissementId].lignes.push(v);
    return acc;
  }, {});

  const etablissementsVerrouillables = etablissements.filter((e) => e.type !== "CAMEC");

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
          className={onglet === "regions" ? "admin-onglet-actif" : "admin-onglet"}
          onClick={() => setOnglet("regions")}
        >
          Régions
        </button>
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
        <button
          className={onglet === "notifications" ? "admin-onglet-actif" : "admin-onglet"}
          onClick={() => setOnglet("notifications")}
        >
          Notifications
        </button>
        <button
          className={onglet === "stocks" ? "admin-onglet-actif" : "admin-onglet"}
          onClick={() => setOnglet("stocks")}
        >
          Stocks
        </button>
        <button
          className={onglet === "verrouillage" ? "admin-onglet-actif" : "admin-onglet"}
          onClick={() => setOnglet("verrouillage")}
        >
          Verrouillage
        </button>
      </div>

      {chargement ? (
        <p>Chargement...</p>
      ) : onglet === "regions" ? (
        <>
          <form className="admin-formulaire" onSubmit={creerDrs}>
            <h2>Créer une DRS</h2>
            <div className="admin-grille">
              <div className="admin-champ">
                <label>Nom</label>
                <input
                  type="text"
                  required
                  value={formDrs.nom}
                  onChange={(e) => setFormDrs((f) => ({ ...f, nom: e.target.value }))}
                />
              </div>
              <div className="admin-champ">
                <label>Code</label>
                <input
                  type="text"
                  required
                  value={formDrs.code}
                  onChange={(e) => setFormDrs((f) => ({ ...f, code: e.target.value }))}
                />
              </div>
            </div>
            <button type="submit" className="admin-bouton">Créer la DRS</button>
          </form>

          <table className="admin-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Code</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {drsListe.map((d) => (
                <tr key={d.id}>
                  {editionDrsId === d.id ? (
                    <>
                      <td>
                        <input
                          type="text"
                          value={editionDrsForm.nom}
                          onChange={(e) => setEditionDrsForm((f) => ({ ...f, nom: e.target.value }))}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={editionDrsForm.code}
                          onChange={(e) => setEditionDrsForm((f) => ({ ...f, code: e.target.value }))}
                        />
                      </td>
                      <td>{d.actif ? "Actif" : "Désactivé"}</td>
                      <td>
                        <button className="admin-lien-action" onClick={() => enregistrerEditionDrs(d.id)}>Enregistrer</button>
                        <button className="admin-lien-action" onClick={() => setEditionDrsId(null)}>Annuler</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{d.nom}</td>
                      <td>{d.code}</td>
                      <td>{d.actif ? "Actif" : "Désactivé"}</td>
                      <td>
                        <button className="admin-lien-action" onClick={() => demarrerEditionDrs(d)}>Modifier</button>
                        <button className="admin-lien-action" onClick={() => supprimerDrsAction(d)}>Supprimer</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          <form className="admin-formulaire" onSubmit={creerMoughataaSubmit}>
            <h2>Créer une Moughataa</h2>
            <div className="admin-grille">
              <div className="admin-champ">
                <label>Nom</label>
                <input
                  type="text"
                  required
                  value={formMoughataa.nom}
                  onChange={(e) => setFormMoughataa((f) => ({ ...f, nom: e.target.value }))}
                />
              </div>
              <div className="admin-champ">
                <label>DRS</label>
                <select
                  value={formMoughataa.drsId}
                  onChange={(e) => setFormMoughataa((f) => ({ ...f, drsId: e.target.value }))}
                >
                  <option value="">—</option>
                  {drsListe.map((d) => (
                    <option key={d.id} value={d.id}>{d.nom}</option>
                  ))}
                </select>
              </div>
            </div>
            <button type="submit" className="admin-bouton">Créer la Moughataa</button>
          </form>

          <table className="admin-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>DRS</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {moughataas.map((m) => (
                <tr key={m.id}>
                  {editionMoughataaId === m.id ? (
                    <>
                      <td>
                        <input
                          type="text"
                          value={editionMoughataaForm.nom}
                          onChange={(e) => setEditionMoughataaForm((f) => ({ ...f, nom: e.target.value }))}
                        />
                      </td>
                      <td>
                        <select
                          value={editionMoughataaForm.drsId}
                          onChange={(e) => setEditionMoughataaForm((f) => ({ ...f, drsId: e.target.value }))}
                        >
                          {drsListe.map((d) => (
                            <option key={d.id} value={d.id}>{d.nom}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <button className="admin-lien-action" onClick={() => enregistrerEditionMoughataa(m.id)}>Enregistrer</button>
                        <button className="admin-lien-action" onClick={() => setEditionMoughataaId(null)}>Annuler</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{m.nom}</td>
                      <td>{m.drs?.nom || "—"}</td>
                      <td>
                        <button className="admin-lien-action" onClick={() => demarrerEditionMoughataa(m)}>Modifier</button>
                        <button className="admin-lien-action" onClick={() => supprimerMoughataaAction(m)}>Supprimer</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </>
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
                  onChange={(e) =>
                    setFormEtab((f) => ({
                      ...f,
                      type: e.target.value,
                      drsId: "",
                      moughataaId: "",
                      programmeId: "",
                      approvisionnementDirectCamec: false,
                    }))
                  }
                >
                  {Object.entries(LIBELLES_TYPE_ETAB).map(([val, lib]) => (
                    <option key={val} value={val}>{lib}</option>
                  ))}
                </select>
              </div>
              {formEtab.type === "GAS_DRS" && (
                <div className="admin-champ">
                  <label>DRS</label>
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
              )}
              {(formEtab.type === "GAS_MOUGHATAA" || formEtab.type === "FORMATION_SANITAIRE") && (
                <div className="admin-champ">
                  <label>Moughataa</label>
                  <select
                    value={formEtab.moughataaId}
                    onChange={(e) => setFormEtab((f) => ({ ...f, moughataaId: e.target.value }))}
                  >
                    <option value="">—</option>
                    {moughataas.map((m) => (
                      <option key={m.id} value={m.id}>{m.nom} ({m.drs?.nom})</option>
                    ))}
                  </select>
                </div>
              )}
              {formEtab.type === "GAS_PROGRAMME_NATIONAL" && (
                <div className="admin-champ">
                  <label>Programme</label>
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
              )}
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
              {TYPES_ELIGIBLES_APPRO_DIRECT.includes(formEtab.type) && (
                <div className="admin-champ admin-champ-case">
                  <label>
                    <input
                      type="checkbox"
                      checked={formEtab.approvisionnementDirectCamec}
                      onChange={(e) =>
                        setFormEtab((f) => ({ ...f, approvisionnementDirectCamec: e.target.checked }))
                      }
                    />
                    {" "}Approvisionnement direct CAMEC (exception géographique)
                  </label>
                </div>
              )}
            </div>
            <button type="submit" className="admin-bouton">Créer l'établissement</button>
          </form>

          <form className="admin-formulaire" onSubmit={importerFosaSubmit}>
            <h2>Importer des formations sanitaires en masse</h2>
            <p className="admin-reconciliation-note">
              Fichier Excel (.xlsx) ou CSV avec les colonnes : <strong>Nom FOSA</strong>, <strong>Moughataa</strong>
              {" "}(nom exact tel que créé dans Régions), <strong>Responsable</strong> (nom complet),{" "}
              <strong>Telephone</strong> (optionnel), <strong>Identifiant</strong> (optionnel — généré automatiquement
              si vide). Un compte et un mot de passe sont créés pour chaque ligne valide.
            </p>
            <div className="admin-grille">
              <div className="admin-champ">
                <label>Fichier</label>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => setFichierImportFosa(e.target.files?.[0] || null)}
                />
              </div>
            </div>
            <button type="submit" className="admin-bouton" disabled={importFosaEnCours}>
              {importFosaEnCours ? "Import en cours..." : "Importer"}
            </button>
          </form>

          {resultatImportFosa && (
            <div className="admin-reconciliation">
              <div className="admin-rattachement-ligne">
                <span>
                  {resultatImportFosa.filter((r) => r.statut === "ok").length} créée(s) avec succès sur{" "}
                  {resultatImportFosa.length} ligne(s).
                </span>
                {resultatImportFosa.some((r) => r.statut === "ok") && (
                  <button className="admin-lien-action" onClick={telechargerIdentifiantsFosa}>
                    Télécharger les identifiants (CSV)
                  </button>
                )}
              </div>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Ligne</th>
                    <th>FOSA</th>
                    <th>Résultat</th>
                  </tr>
                </thead>
                <tbody>
                  {resultatImportFosa.map((r) => (
                    <tr key={r.ligne} className={r.statut === "erreur" ? "admin-ligne-inactive" : ""}>
                      <td>{r.ligne}</td>
                      <td>{r.nomFosa}</td>
                      <td>{r.statut === "ok" ? `Créée (identifiant : ${r.identifiant})` : r.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="admin-filtres">
            <div className="admin-champ">
              <label>Type</label>
              <select value={filtreEtabType} onChange={(e) => setFiltreEtabType(e.target.value)}>
                <option value="">Tous</option>
                {Object.entries(LIBELLES_TYPE_ETAB).map(([val, lib]) => (
                  <option key={val} value={val}>{lib}</option>
                ))}
              </select>
            </div>
            <div className="admin-champ">
              <label>DRS</label>
              <select value={filtreEtabDrs} onChange={(e) => setFiltreEtabDrs(e.target.value)}>
                <option value="">Toutes</option>
                {drsListe.map((d) => (
                  <option key={d.id} value={d.nom}>{d.nom}</option>
                ))}
              </select>
            </div>
            <div className="admin-champ">
              <label>Moughataa</label>
              <select value={filtreEtabMoughataa} onChange={(e) => setFiltreEtabMoughataa(e.target.value)}>
                <option value="">Toutes</option>
                {moughataas.map((m) => (
                  <option key={m.id} value={m.nom}>{m.nom}</option>
                ))}
              </select>
            </div>
            <div className="admin-champ">
              <label>Statut</label>
              <select value={filtreEtabStatut} onChange={(e) => setFiltreEtabStatut(e.target.value)}>
                <option value="">Tous</option>
                <option value="actif">Actif</option>
                <option value="inactif">Désactivé</option>
              </select>
            </div>
          </div>

          <table className="admin-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Type</th>
                <th>Programme</th>
                <th>Approvisionnement direct</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {etablissements
                .filter((e) => !filtreEtabType || e.type === filtreEtabType)
                .filter((e) => !filtreEtabDrs || e.drs?.nom === filtreEtabDrs)
                .filter((e) => !filtreEtabMoughataa || e.moughataa?.nom === filtreEtabMoughataa)
                .filter((e) => !filtreEtabStatut || (filtreEtabStatut === "actif" ? e.actif : !e.actif))
                .map((e) => (
                <tr key={e.id} className={!e.actif ? "admin-ligne-inactive" : ""}>
                  {editionEtabId === e.id ? (
                    <>
                      <td>
                        <input
                          type="text"
                          value={editionEtabForm.nom}
                          onChange={(ev) => setEditionEtabForm((f) => ({ ...f, nom: ev.target.value }))}
                        />
                      </td>
                      <td>{LIBELLES_TYPE_ETAB[e.type] || e.type}</td>
                      <td>
                        {e.type === "GAS_PROGRAMME_NATIONAL" ? (
                          <select
                            value={editionEtabForm.programmeId}
                            onChange={(ev) => setEditionEtabForm((f) => ({ ...f, programmeId: ev.target.value }))}
                          >
                            <option value="">—</option>
                            {programmes.map((p) => (
                              <option key={p.id} value={p.id}>{p.nom}</option>
                            ))}
                          </select>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>—</td>
                      <td>{e.actif ? "Actif" : "Désactivé"}</td>
                      <td>
                        <button className="admin-lien-action" onClick={() => enregistrerEditionEtab(e.id)}>Enregistrer</button>
                        <button className="admin-lien-action" onClick={() => setEditionEtabId(null)}>Annuler</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{e.nom}</td>
                      <td>{LIBELLES_TYPE_ETAB[e.type] || e.type}</td>
                      <td>{e.programme?.nom || "—"}</td>
                      <td>
                        {TYPES_ELIGIBLES_APPRO_DIRECT.includes(e.type) ? (
                          <button
                            className="admin-lien-action"
                            onClick={() => basculerApprovisionnementDirect(e)}
                          >
                            {e.approvisionnementDirectCamec ? "Oui — désactiver" : "Non — activer"}
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>{e.actif ? "Actif" : "Désactivé"}</td>
                      <td>
                        <button className="admin-lien-action" onClick={() => demarrerEditionEtab(e)}>Modifier</button>
                        <button className="admin-lien-action" onClick={() => basculerActifEtablissement(e)}>
                          {e.actif ? "Désactiver" : "Réactiver"}
                        </button>
                        <button className="admin-lien-action" onClick={() => supprimerEtablissementAction(e)}>Supprimer</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : onglet === "utilisateurs" ? (
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

          <div className="admin-filtres">
            <div className="admin-champ">
              <label>Établissement</label>
              <select value={filtreUserEtablissement} onChange={(e) => setFiltreUserEtablissement(e.target.value)}>
                <option value="">Tous</option>
                {etablissements.map((e) => (
                  <option key={e.id} value={e.nom}>{e.nom}</option>
                ))}
              </select>
            </div>
            <div className="admin-champ">
              <label>Rôle</label>
              <select value={filtreUserRole} onChange={(e) => setFiltreUserRole(e.target.value)}>
                <option value="">Tous</option>
                {roles.map((r) => (
                  <option key={r} value={r}>{LIBELLES_ROLE[r] || r}</option>
                ))}
              </select>
            </div>
            <div className="admin-champ">
              <label>Statut</label>
              <select value={filtreUserStatut} onChange={(e) => setFiltreUserStatut(e.target.value)}>
                <option value="">Tous</option>
                <option value="actif">Actif</option>
                <option value="inactif">Désactivé</option>
              </select>
            </div>
          </div>

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
              {utilisateurs
                .filter((u) => !filtreUserEtablissement || u.etablissements.some((r) => r.etablissement.nom === filtreUserEtablissement))
                .filter((u) => !filtreUserRole || u.etablissements.some((r) => r.role === filtreUserRole))
                .filter((u) => !filtreUserStatut || (filtreUserStatut === "actif" ? u.actif : !u.actif))
                .map((u) => (
                <tr key={u.id} className={!u.actif ? "admin-ligne-inactive" : ""}>
                  {editionUserId === u.id ? (
                    <>
                      <td>
                        <input
                          type="text"
                          value={editionUserForm.nomComplet}
                          onChange={(e) => setEditionUserForm((f) => ({ ...f, nomComplet: e.target.value }))}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={editionUserForm.identifiant}
                          onChange={(e) => setEditionUserForm((f) => ({ ...f, identifiant: e.target.value }))}
                        />
                      </td>
                      <td>—</td>
                      <td>{u.actif ? "Actif" : "Désactivé"}</td>
                      <td>
                        <button className="admin-lien-action" onClick={() => enregistrerEditionUser(u.id)}>Enregistrer</button>
                        <button className="admin-lien-action" onClick={() => setEditionUserId(null)}>Annuler</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{u.nomComplet}{u.estAdminSysteme ? " (Admin)" : ""}</td>
                      <td>{u.identifiant}</td>
                      <td>
                        {u.etablissements.map((r) => (
                          <div key={r.id} className="admin-rattachement-ligne">
                            {LIBELLES_ROLE[r.role] || r.role} — {r.etablissement.nom}
                            <button
                              className="admin-lien-action"
                              onClick={() =>
                                retirerRattachementAction(
                                  u.id,
                                  r.id,
                                  `${LIBELLES_ROLE[r.role] || r.role} — ${r.etablissement.nom}`
                                )
                              }
                            >
                              Retirer
                            </button>
                          </div>
                        ))}
                      </td>
                      <td>{u.actif ? "Actif" : "Désactivé"}</td>
                      <td>
                        <button className="admin-lien-action" onClick={() => demarrerEditionUser(u)}>Modifier</button>
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
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : onglet === "notifications" ? (
        <>
          <div className="admin-filtres">
            <div className="admin-champ">
              <label>Établissement (destinataire)</label>
              <select value={filtreEtablissement} onChange={(e) => setFiltreEtablissement(e.target.value)}>
                <option value="">Tous</option>
                {etablissements.map((e) => (
                  <option key={e.id} value={e.nom}>{e.nom}</option>
                ))}
              </select>
            </div>
            <div className="admin-champ">
              <label>Type</label>
              <select value={filtreType} onChange={(e) => setFiltreType(e.target.value)}>
                <option value="">Tous</option>
                {Object.entries(LIBELLES_TYPE_NOTIF).map(([val, lib]) => (
                  <option key={val} value={val}>{lib}</option>
                ))}
              </select>
            </div>
            <div className="admin-champ">
              <label>Du</label>
              <input type="date" value={filtreDateDebut} onChange={(e) => setFiltreDateDebut(e.target.value)} />
            </div>
            <div className="admin-champ">
              <label>Au</label>
              <input type="date" value={filtreDateFin} onChange={(e) => setFiltreDateFin(e.target.value)} />
            </div>
          </div>

          <table className="admin-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Message</th>
                <th>Destinataire</th>
                <th>Auteur</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {notifications
                .filter((n) => !filtreEtablissement || n.etablissement?.nom === filtreEtablissement)
                .filter((n) => !filtreType || n.type === filtreType)
                .filter((n) => !filtreDateDebut || new Date(n.createdAt) >= new Date(filtreDateDebut))
                .filter((n) => !filtreDateFin || new Date(n.createdAt) <= new Date(filtreDateFin + "T23:59:59"))
                .map((n) => (
                  <tr key={n.id}>
                    <td>{LIBELLES_TYPE_NOTIF[n.type] || n.type}</td>
                    <td>{n.message}</td>
                    <td>{n.etablissement?.nom || "—"}</td>
                    <td>{n.etablissementAuteur?.nom || "—"}</td>
                    <td>
                      {new Date(n.createdAt).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </>
      ) : onglet === "stocks" ? (
        <>
          <div className="admin-reconciliation">
            <button
              type="button"
              className="admin-bouton"
              onClick={reconcilierStocksLots}
              disabled={reconciliationEnCours}
            >
              {reconciliationEnCours ? "Réconciliation en cours..." : "Réconcilier stocks / lots"}
            </button>
            <p className="admin-reconciliation-note">
              Recale la quantité théorique de chaque stock sur la somme réelle de ses lots —
              à lancer si des produits affichent un stock sans numéro de lot ni péremption dans "Stock du réseau".
            </p>
            {reconciliationResultat && (
              reconciliationResultat.length === 0 ? (
                <p className="admin-message">Aucun écart détecté : tous les stocks sont déjà cohérents avec leurs lots.</p>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Établissement</th>
                      <th>Produit</th>
                      <th>Avant</th>
                      <th>Après (réel)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reconciliationResultat.map((d, i) => (
                      <tr key={i}>
                        <td>{d.etablissement || "—"}</td>
                        <td>{d.produit || "—"}</td>
                        <td>{d.avant}</td>
                        <td>{d.apres}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}
          </div>

          <div className="admin-filtres">
            <div className="admin-champ">
              <label>Produit</label>
              <select value={filtreLotProduit} onChange={(e) => setFiltreLotProduit(e.target.value)}>
                <option value="">Tous</option>
                {produits.map((p) => (
                  <option key={p.id} value={p.id}>{p.nom}</option>
                ))}
              </select>
            </div>
            <div className="admin-champ">
              <label>Niveau</label>
              <select value={filtreLotNiveau} onChange={(e) => setFiltreLotNiveau(e.target.value)}>
                <option value="">Tous</option>
                {Object.entries(LIBELLE_NIVEAU_STOCK).map(([val, lib]) => (
                  <option key={val} value={val}>{lib}</option>
                ))}
              </select>
            </div>
            <div className="admin-champ">
              <label>Péremption du</label>
              <input type="date" value={filtreLotDateDebut} onChange={(e) => setFiltreLotDateDebut(e.target.value)} />
            </div>
            <div className="admin-champ">
              <label>Péremption au</label>
              <input type="date" value={filtreLotDateFin} onChange={(e) => setFiltreLotDateFin(e.target.value)} />
            </div>
          </div>

          <table className="admin-table">
            <thead>
              <tr>
                <th>Produit</th>
                <th>Établissement</th>
                <th>Niveau</th>
                <th>Numéro de lot</th>
                <th>Péremption</th>
                <th>Quantité</th>
              </tr>
            </thead>
            <tbody>
              {lots
                .filter((l) => !filtreLotProduit || l.produitId === filtreLotProduit)
                .filter((l) => !filtreLotNiveau || l.etablissement?.type === filtreLotNiveau)
                .filter((l) => !filtreLotDateDebut || new Date(l.datePeremption) >= new Date(filtreLotDateDebut))
                .filter((l) => !filtreLotDateFin || new Date(l.datePeremption) <= new Date(filtreLotDateFin + "T23:59:59"))
                .map((l) => (
                  <tr key={l.id}>
                    <td>{l.produit?.nom || "—"}</td>
                    <td>{l.etablissement?.nom || "—"}</td>
                    <td>{LIBELLE_NIVEAU_STOCK[l.etablissement?.type] || l.etablissement?.type || "—"}</td>
                    <td>{l.numeroLot}</td>
                    <td>
                      {new Date(l.datePeremption).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                    </td>
                    <td>{l.quantite}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </>
      ) : (
        <>
          <form className="admin-formulaire" onSubmit={verrouillerEtablissementAction}>
            <h2>Verrouiller un établissement</h2>
            <p className="admin-reconciliation-note">
              Verrou total et immédiat sur /stocks/entree pour l'établissement choisi (CAMEC exclue : elle est
              toujours libre). Pour verrouiller une zone entière d'un coup, ce sont les gestionnaires de zone
              (GAS Moughataa, DRS, Programme national) qui le font depuis leur propre tableau de bord.
            </p>
            <div className="admin-grille">
              <div className="admin-champ">
                <label>Établissement</label>
                <select
                  value={etablissementAVerrouiller}
                  onChange={(e) => setEtablissementAVerrouiller(e.target.value)}
                >
                  <option value="">—</option>
                  {etablissementsVerrouillables.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nom} ({LIBELLES_TYPE_ETAB[e.type] || e.type})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button type="submit" className="admin-bouton" disabled={verrouillageEnCours}>
              {verrouillageEnCours ? "Verrouillage..." : "Verrouiller"}
            </button>
          </form>

          <table className="admin-table">
            <thead>
              <tr>
                <th>Établissement</th>
                <th>Type</th>
                <th>Portée</th>
                <th>Posé par</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(verrousParEtablissement).map(([etablissementId, groupe]) => (
                <tr key={etablissementId}>
                  <td>{groupe.etablissement?.nom || "—"}</td>
                  <td>{LIBELLES_TYPE_ETAB[groupe.etablissement?.type] || groupe.etablissement?.type || "—"}</td>
                  <td>
                    {groupe.lignes.some((v) => v.programmeId === null)
                      ? "Total"
                      : groupe.lignes.map((v) => v.programme?.nom).filter(Boolean).join(", ")}
                  </td>
                  <td>
                    {groupe.lignes
                      .map((v) => `${v.posePar?.nomComplet || "—"} (${LIBELLES_ROLE[v.posePar?.role] || v.posePar?.role || "—"})`)
                      .join(" / ")}
                  </td>
                  <td>
                    {new Date(groupe.lignes[0].dateVerrouillage).toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </td>
                  <td>
                    <button
                      className="admin-lien-action"
                      onClick={() => deverrouillerEtablissementAction(etablissementId, groupe.etablissement?.nom)}
                    >
                      Déverrouiller
                    </button>
                  </td>
                </tr>
              ))}
              {Object.keys(verrousParEtablissement).length === 0 && (
                <tr>
                  <td colSpan={6}>Aucun verrou actif actuellement.</td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}