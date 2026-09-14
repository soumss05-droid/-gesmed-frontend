import { useEffect, useState } from "react";
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

        if (resCmm.ok) setCmm(await resCmm.json());
      } catch (err) {
        setErreur(err.message || "Connexion instable, réessayez.");
      } finally {
        setChargement(false);
      }
    }
    charger();
  }, []);

  return (
    <div className="reseau-page">
      <header className="reseau-header">
        <button className="reseau-retour" onClick={onRetour}>← Retour</button>
        <h1>Stock du réseau</h1>
      </header>

      {erreur && <p className="reseau-erreur" role="alert">{erreur}</p>}
      {chargement && <p>Chargement...</p>}

      {!chargement && cmm.length > 0 && (
        <div className="reseau-carte">
          <h2>CMM — 6 derniers mois (consommation réelle du réseau)</h2>
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
        </div>
      )}

      {!chargement &&
        donnees.map((etab) => (
          <div className="reseau-carte" key={etab.etablissementId}>
            <h2>{etab.etablissementNom}</h2>
            {etab.stocks.length === 0 ? (
              <p className="reseau-vide">Aucun produit suivi à ce niveau.</p>
            ) : (
              <table className="reseau-table">
                <thead>
                  <tr>
                    <th>Produit</th>
                    <th>Quantité</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {etab.stocks.map((s) => (
                    <tr key={s.produitId}>
                      <td>{s.produit}</td>
                      <td>{s.quantiteTotale}</td>
                      <td className={`reseau-statut reseau-statut--${s.statut.toLowerCase()}`}>
                        {LIBELLE_STATUT[s.statut] || s.statut}
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
          </div>
        ))}
    </div>
  );
}