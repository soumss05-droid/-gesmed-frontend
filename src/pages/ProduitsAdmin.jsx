import { useCallback, useEffect, useMemo, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

async function appeler(chemin, options, token) {
  const res = await fetch(`${API_URL}${chemin}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options && options.headers ? options.headers : {}),
    },
  });
  let donnees = null;
  try {
    donnees = await res.json();
  } catch {
    donnees = null;
  }
  if (!res.ok) {
    throw new Error((donnees && donnees.erreur) || "Erreur serveur.");
  }
  return donnees;
}

function normaliser(texte) {
  return String(texte || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

const SANS_CATEGORIE = "Sans catégorie";

export default function ProduitsAdmin({ token }) {
  const [produits, setProduits] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [message, setMessage] = useState(null);
  const [filtreProgramme, setFiltreProgramme] = useState("");
  const [recherche, setRecherche] = useState("");
  const [editionId, setEditionId] = useState(null);
  const [form, setForm] = useState({});
  const [enCours, setEnCours] = useState(false);

  const charger = useCallback(async () => {
    try {
      const donnees = await appeler("/admin/produits", { method: "GET" }, token);
      setProduits(donnees);
      setErreur(null);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setChargement(false);
    }
  }, [token]);

  useEffect(() => {
    charger();
  }, [charger]);

  const programmes = useMemo(() => {
    const vus = new Map();
    for (const p of produits) vus.set(p.programmeId, p.programmeNom);
    return Array.from(vus, ([id, nom]) => ({ id, nom })).sort((a, b) => String(a.nom).localeCompare(String(b.nom), "fr"));
  }, [produits]);

  const categoriesExistantes = useMemo(() => {
    const s = new Set();
    for (const p of produits) if (p.categorie) s.add(p.categorie);
    return Array.from(s).sort((a, b) => a.localeCompare(b, "fr"));
  }, [produits]);

  const groupes = useMemo(() => {
    const terme = normaliser(recherche.trim());
    const filtres = produits.filter((p) => {
      if (filtreProgramme && p.programmeId !== filtreProgramme) return false;
      if (!terme) return true;
      return normaliser(p.nom).includes(terme) || normaliser(p.categorie).includes(terme);
    });
    const parProgramme = new Map();
    for (const p of filtres) {
      if (!parProgramme.has(p.programmeNom)) parProgramme.set(p.programmeNom, new Map());
      const cat = p.categorie || SANS_CATEGORIE;
      const parCat = parProgramme.get(p.programmeNom);
      if (!parCat.has(cat)) parCat.set(cat, []);
      parCat.get(cat).push(p);
    }
    return { total: filtres.length, parProgramme };
  }, [produits, filtreProgramme, recherche]);

  function commencerEdition(p) {
    setMessage(null);
    setErreur(null);
    setEditionId(p.id);
    setForm({
      nom: p.nom || "",
      forme: p.forme || "",
      unite: p.unite || "",
      categorie: p.categorie || "",
      seuilMinDefaut: String(p.seuilMinDefaut),
      seuilMaxDefaut: String(p.seuilMaxDefaut),
    });
  }

  async function enregistrer(id) {
    setErreur(null);
    setMessage(null);
    if (!form.nom.trim()) {
      setErreur("Le nom du produit est obligatoire.");
      return;
    }
    setEnCours(true);
    try {
      await appeler(
        `/admin/produits/${id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            nom: form.nom,
            forme: form.forme,
            unite: form.unite,
            categorie: form.categorie,
            seuilMinDefaut: Number(form.seuilMinDefaut),
            seuilMaxDefaut: Number(form.seuilMaxDefaut),
          }),
        },
        token
      );
      setEditionId(null);
      setMessage("Produit modifié.");
      await charger();
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(false);
    }
  }

  async function supprimer(p) {
    setErreur(null);
    setMessage(null);
    if (!window.confirm(`Supprimer définitivement le produit « ${p.nom} » ?\n\nCette action est irréversible.`)) return;
    setEnCours(true);
    try {
      const rep = await appeler(`/admin/produits/${p.id}`, { method: "DELETE" }, token);
      setMessage(rep.message || "Produit supprimé.");
      await charger();
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(false);
    }
  }

  function changer(champ, valeur) {
    setForm((f) => ({ ...f, [champ]: valeur }));
  }

  if (chargement) return <p>Chargement des produits…</p>;

  return (
    <div>
      <h2>Produits</h2>
      <p className="admin-reconciliation-note">
        Modifiez un produit (nom, forme, unité, catégorie, seuils) ou supprimez-le s'il n'a jamais été utilisé.
        Un produit déjà utilisé (stock, commande, dispensation…) ne peut pas être supprimé.
      </p>

      {erreur && (
        <p className="admin-erreur" role="alert">
          {erreur}
        </p>
      )}
      {message && <p className="admin-message">{message}</p>}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "12px 0" }}>
        <select value={filtreProgramme} onChange={(e) => setFiltreProgramme(e.target.value)}>
          <option value="">Tous les programmes</option>
          {programmes.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nom}
            </option>
          ))}
        </select>
        <input
          type="search"
          placeholder="Rechercher un produit ou une catégorie…"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
          }}
          style={{ minWidth: 260 }}
        />
        <span>{groupes.total} produit(s)</span>
      </div>

      <datalist id="categories-produits">
        {categoriesExistantes.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <table className="admin-table">
        <thead>
          <tr>
            <th>Produit</th>
            <th>Forme</th>
            <th>Unité</th>
            <th>Seuil min</th>
            <th>Seuil max</th>
            <th>Utilisé</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {Array.from(groupes.parProgramme.entries()).map(([programmeNom, parCat]) => [
            <tr key={`prog-${programmeNom}`}>
              <th colSpan={7} style={{ textAlign: "left", background: "#eef2f7" }}>
                {programmeNom}
              </th>
            </tr>,
            ...Array.from(parCat.entries()).flatMap(([categorie, liste]) => [
              <tr key={`cat-${programmeNom}-${categorie}`}>
                <td colSpan={7} style={{ fontWeight: 600, paddingLeft: 20, background: "#f8fafc" }}>
                  {categorie} ({liste.length})
                </td>
              </tr>,
              ...liste.flatMap((p) => {
                if (editionId === p.id) {
                  return [
                    <tr key={p.id}>
                      <td>
                        <input value={form.nom} onChange={(e) => changer("nom", e.target.value)} style={{ width: "100%" }} />
                      </td>
                      <td>
                        <input value={form.forme} onChange={(e) => changer("forme", e.target.value)} style={{ width: 120 }} />
                      </td>
                      <td>
                        <input value={form.unite} onChange={(e) => changer("unite", e.target.value)} style={{ width: 100 }} />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          value={form.seuilMinDefaut}
                          onChange={(e) => changer("seuilMinDefaut", e.target.value)}
                          style={{ width: 70 }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          value={form.seuilMaxDefaut}
                          onChange={(e) => changer("seuilMaxDefaut", e.target.value)}
                          style={{ width: 70 }}
                        />
                      </td>
                      <td>{p.utilisations}</td>
                      <td>
                        <button className="admin-lien-action" disabled={enCours} onClick={() => enregistrer(p.id)}>
                          Enregistrer
                        </button>{" "}
                        <button className="admin-lien-action" disabled={enCours} onClick={() => setEditionId(null)}>
                          Annuler
                        </button>
                      </td>
                    </tr>,
                    <tr key={`${p.id}-cat`}>
                      <td colSpan={7} style={{ paddingLeft: 20 }}>
                        Catégorie :{" "}
                        <input
                          list="categories-produits"
                          value={form.categorie}
                          onChange={(e) => changer("categorie", e.target.value)}
                          placeholder="Choisir ou saisir une catégorie"
                          style={{ width: 320 }}
                        />
                      </td>
                    </tr>,
                  ];
                }
                const utilise = p.utilisations > 0;
                return [
                  <tr key={p.id}>
                    <td>{p.nom}</td>
                    <td>{p.forme || "—"}</td>
                    <td>{p.unite || "—"}</td>
                    <td>{p.seuilMinDefaut}</td>
                    <td>{p.seuilMaxDefaut}</td>
                    <td>{utilise ? "Oui" : "Non"}</td>
                    <td>
                      <button className="admin-lien-action" disabled={enCours} onClick={() => commencerEdition(p)}>
                        Modifier
                      </button>{" "}
                      <button
                        className="admin-lien-action"
                        disabled={enCours || utilise}
                        title={utilise ? "Produit déjà utilisé : suppression impossible" : "Supprimer ce produit"}
                        onClick={() => supprimer(p)}
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>,
                ];
              }),
            ]),
          ])}
          {groupes.total === 0 && (
            <tr>
              <td colSpan={7}>Aucun produit ne correspond à la recherche.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}