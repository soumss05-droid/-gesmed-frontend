import { useEffect, useMemo, useState } from "react";
import "./StockReseau.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const LIBELLE_STATUT = {
  RUPTURE: "Rupture",
  SOUS_SEUIL: "Sous seuil",
  NORMAL: "Normal",
  SURSTOCK: "Surstock",
};

export default function StockReseau({ onRetour }) {
  const [donnees, setDonnees] = useState([]);
  const [cmm, setCmm] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [recherche, setRecherche] = useState("");
  const [seulementRuptures, setSeulementRuptures] = useState(false);
  const [etablissementsOuverts, setEtablissementsOuverts] = useState({});
  const [filtreRegion, setFiltreRegion] = useState("");
  const [filtreMoughataa, setFiltreMoughataa] = useState("");

  useEffect(() => {
    async function charger() {
      try {
        const token = localStorage.getItem("gesmed_token");
        const [resReseau, resCmm] = await Promise.all([
          fetch(`${API_URL}/stocks/reseau`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/stocks/cmm`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        const dataReseau = await resReseau.json();
        if (!resReseau.ok) throw new Error(dataReseau.erreur || "Impossible de charger le stock du réseau.");
        setDonnees(dataReseau);
        // Tous les établissements démarrent ouverts par défaut.
        const ouverts = {};
        for (const e of dataReseau) ouverts[e.etablissementId] = true;
        setEtablissementsOuverts(ouverts);

        if (resCmm.ok) setCmm(await resCmm.json());
      } catch (err) {
        setErreur(err.message || "Connexion instable, réessayez.");
      } finally {
        setChargement(false);
      }
    }
    charger();
  }, []);

  function basculerEtablissement(id) {
    setEtablissementsOuverts((o) => ({ ...o, [id]: !o[id] }));
  }

  // -------------------------------------------------------------------------
  // Listes disponibles pour le filtrage en cascade — dérivées des données
  // déjà chargées, sans appel serveur supplémentaire. La liste des
  // Moughataa se limite à celles de la région choisie, pour que le
  // deuxième filtre reste cohérent avec le premier.
  // -------------------------------------------------------------------------
  const regionsDisponibles = useMemo(() => {
    const noms = new Set(donnees.map((e) => e.regionNom).filter(Boolean));
    return Array.from(noms).sort();
  }, [donnees]);

  const moughataasDisponibles = useMemo(() => {
    const noms = new Set(
      donnees
        .filter((e) => !filtreRegion || e.regionNom === filtreRegion)
        .map((e) => e.moughataaNom)
        .filter(Boolean)
    );
    return Array.from(noms).sort();
  }, [donnees, filtreRegion]);

  // -------------------------------------------------------------------------
  // Résumé global et filtrage — calculés à partir des données déjà chargées,
  // sans appel serveur supplémentaire.
  // -------------------------------------------------------------------------
  const resume = useMemo(() => {
    let totalRuptures = 0;
    let totalSousSeuil = 0;
    let totalPerimes = 0;
    for (const etab of donnees) {
      totalRuptures += etab.stocks.filter((s) => s.statut === "RUPTURE").length;
      totalSousSeuil += etab.stocks.filter((s) => s.statut === "SOUS_SEUIL").length;
      totalPerimes += etab.lotsPerimes?.length || 0;
    }
    return { totalRuptures, totalSousSeuil, totalPerimes, totalEtablissements: donnees.length };
  }, [donnees]);

  const donneesFiltrees = useMemo(() => {
    const rechercheMin = recherche.trim().toLowerCase();
    return donnees
      .filter((etab) => !filtreRegion || etab.regionNom === filtreRegion)
      .filter((etab) => !filtreMoughataa || etab.moughataaNom === filtreMoughataa)
      .map((etab) => ({
        ...etab,
        stocks: etab.stocks.filter((s) => {
          const correspondNom = !rechercheMin || s.produit.toLowerCase().includes(rechercheMin);
          const correspondStatut = !seulementRuptures || s.statut === "RUPTURE" || s.statut === "SOUS_SEUIL";
          return correspondNom && correspondStatut;
        }),
      }))
      .filter((etab) => etab.stocks.length > 0 || (!rechercheMin && !seulementRuptures));
  }, [donnees, recherche, seulementRuptures, filtreRegion, filtreMoughataa]);

  return (
    <div className="reseau-page">
      <header className="reseau-header">
        <button className="reseau-retour" onClick={onRetour}>← Retour</button>
        <h1>Stock du réseau</h1>
      </header>

      {erreur && <p className="reseau-erreur" role="alert">{erreur}</p>}

      {chargement ? (
        <p>Chargement...</p>
      ) : (
        <>
          <div className="reseau-resume">
            <div className="reseau-resume-carte">
              <span className="reseau-resume-valeur">{resume.totalEtablissements}</span>
              <span className="reseau-resume-titre">Établissements</span>
            </div>
            <div className="reseau-resume-carte reseau-resume-carte--rouge">
              <span className="reseau-resume-valeur">{resume.totalRuptures}</span>
              <span className="reseau-resume-titre">En rupture</span>
            </div>
            <div className="reseau-resume-carte reseau-resume-carte--dore">
              <span className="reseau-resume-valeur">{resume.totalSousSeuil}</span>
              <span className="reseau-resume-titre">Sous le seuil</span>
            </div>
            <div className="reseau-resume-carte reseau-resume-carte--dore">
              <span className="reseau-resume-valeur">{resume.totalPerimes}</span>
              <span className="reseau-resume-titre">Lots périmés</span>
            </div>
          </div>

          <div className="reseau-filtres">
            <input
              type="text"
              className="reseau-recherche"
              placeholder="Rechercher un produit..."
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
            />
            <label className="reseau-case">
              <input
                type="checkbox"
                checked={seulementRuptures}
                onChange={(e) => setSeulementRuptures(e.target.checked)}
              />
              Alertes seulement (rupture / sous seuil)
            </label>
          </div>

          {(regionsDisponibles.length > 1 || moughataasDisponibles.length > 1) && (
            <div className="reseau-filtres reseau-filtres-cascade">
              {regionsDisponibles.length > 1 && (
                <select
                  value={filtreRegion}
                  onChange={(e) => {
                    setFiltreRegion(e.target.value);
                    setFiltreMoughataa(""); // On repart de zéro sur la Moughataa si la région change.
                  }}
                >
                  <option value="">Toutes les régions</option>
                  {regionsDisponibles.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              )}
              {moughataasDisponibles.length > 1 && (
                <select value={filtreMoughataa} onChange={(e) => setFiltreMoughataa(e.target.value)}>
                  <option value="">Toutes les Moughataa</option>
                  {moughataasDisponibles.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {cmm.length > 0 && (
            <details className="reseau-carte reseau-cmm">
              <summary>CMM — 6 derniers mois (consommation réelle du réseau)</summary>
              <table className="reseau-table">
                <thead>
                  <tr>
                    <th>Produit</th>
                    <th>CMM (unités/mois)</th>
                  </tr>
                </thead>
                <tbody>
                  {cmm.map((c) => (
                    <tr key={c.produit}>
                      <td>{c.produit}</td>
                      <td>{c.cmm}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}

          {donneesFiltrees.length === 0 ? (
            <p className="reseau-vide">Aucun résultat pour cette recherche.</p>
          ) : (
            donneesFiltrees.map((etab) => {
              const ouvert = etablissementsOuverts[etab.etablissementId];
              const nbAlertes = etab.stocks.filter((s) => s.statut === "RUPTURE" || s.statut === "SOUS_SEUIL").length;
              return (
                <div className="reseau-carte" key={etab.etablissementId}>
                  <button className="reseau-carte-entete" onClick={() => basculerEtablissement(etab.etablissementId)}>
                    <span className="reseau-carte-titre">
                      {etab.etablissementNom}
                      {nbAlertes > 0 && <span className="reseau-badge-alerte">{nbAlertes}</span>}
                    </span>
                    <span className={`reseau-chevron ${ouvert ? "reseau-chevron--ouvert" : ""}`}>▾</span>
                  </button>

                  {ouvert && (
                    <>
                      {etab.stocks.length === 0 ? (
                        <p className="reseau-vide">Aucun produit suivi à ce niveau.</p>
                      ) : (
                        <table className="reseau-table">
                          <thead>
                            <tr>
                              <th>Produit</th>
                              <th>Stock théorique</th>
                              <th>Statut</th>
                            </tr>
                          </thead>
                          <tbody>
                            {etab.stocks.map((s) => (
                              <tr key={s.produitId}>
                                <td>{s.produit}</td>
                                <td>{s.quantiteTotale}</td>
                                <td>
                                  {s.statut ? (
                                    <span className={`reseau-badge-statut reseau-badge-statut--${s.statut.toLowerCase()}`}>
                                      {LIBELLE_STATUT[s.statut] || s.statut}
                                    </span>
                                  ) : (
                                    <span className="reseau-badge-statut">—</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}

                      {etab.lotsPerimes && etab.lotsPerimes.length > 0 && (
                        <div className="reseau-perimes">
                          <h3>⚠ Lots périmés</h3>
                          <table className="reseau-table">
                            <thead>
                              <tr>
                                <th>Produit</th>
                                <th>N° de lot</th>
                                <th>Périmé le</th>
                                <th>Quantité restante</th>
                              </tr>
                            </thead>
                            <tbody>
                              {etab.lotsPerimes.map((l, i) => (
                                <tr key={i}>
                                  <td>{l.produit}</td>
                                  <td>{l.numeroLot}</td>
                                  <td>{new Date(l.datePeremption).toLocaleDateString("fr-FR")}</td>
                                  <td>{l.quantite}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })
          )}
        </>
      )}
    </div>
  );
}