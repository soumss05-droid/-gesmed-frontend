import { useEffect, useState } from "react";
import "./Rapports.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function Rapports({ onRetour }) {
  const [kpis, setKpis] = useState(null);
  const [produitsRupture, setProduitsRupture] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);

  async function charger() {
    setChargement(true);
    setErreur(null);
    try {
      const token = localStorage.getItem("gesmed_token");
      const [resKpis, resRupture] = await Promise.all([
        fetch(`${API_URL}/rapports/tableau-de-bord`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/rapports/produits-en-rupture`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (!resKpis.ok) throw new Error("Impossible de charger le tableau de bord.");
      if (!resRupture.ok) throw new Error("Impossible de charger les produits en rupture.");
      setKpis(await resKpis.json());
      setProduitsRupture(await resRupture.json());
    } catch (err) {
      setErreur(err.message || "Connexion instable, réessayez.");
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    charger();
  }, []);

  // Export CSV entièrement côté navigateur — pas de dépendance externe, pas
  // d'appel serveur supplémentaire : on transforme les données déjà
  // chargées et on déclenche un téléchargement natif.
  function exporterCsv() {
    const lignes = [
      ["Produit", "Structures touchées"],
      ...produitsRupture.map((p) => [p.produit, p.structuresTouchees]),
    ];
    const contenu = lignes.map((ligne) => ligne.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([contenu], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const lien = document.createElement("a");
    lien.href = url;
    lien.download = `produits-en-rupture-${new Date().toISOString().slice(0, 10)}.csv`;
    lien.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="rapports-page">
      <header className="rapports-header">
        <button className="rapports-retour" onClick={onRetour}>← Retour</button>
        <h1>Rapports</h1>
      </header>

      {erreur && <p className="rapports-erreur" role="alert">{erreur}</p>}

      {chargement ? (
        <p>Chargement...</p>
      ) : (
        <>
          <div className="rapports-grid">
            <div className="rapports-carte">
              <span className="rapports-carte-valeur">{kpis.referencesEnStock}</span>
              <span className="rapports-carte-titre">Références en stock</span>
            </div>
            <div className="rapports-carte rapports-carte-rouge">
              <span className="rapports-carte-valeur">{kpis.ruptures}</span>
              <span className="rapports-carte-titre">En rupture</span>
            </div>
            <div className="rapports-carte rapports-carte-dore">
              <span className="rapports-carte-valeur">{kpis.sousSeuil}</span>
              <span className="rapports-carte-titre">Sous le seuil</span>
            </div>
            <div className="rapports-carte rapports-carte-dore">
              <span className="rapports-carte-valeur">{kpis.lotsBientotPerimes}</span>
              <span className="rapports-carte-titre">Lots périmant sous 3 mois</span>
            </div>
            <div className="rapports-carte">
              <span className="rapports-carte-valeur">{kpis.requisitionsEnAttente}</span>
              <span className="rapports-carte-titre">Réquisitions en attente</span>
            </div>
            {kpis.ecartsEnAttente !== undefined && (
              <div className="rapports-carte">
                <span className="rapports-carte-valeur">{kpis.ecartsEnAttente}</span>
                <span className="rapports-carte-titre">Écarts en attente (national)</span>
              </div>
            )}
          </div>

          <div className="rapports-section-entete">
            <h2>Produits les plus souvent en rupture</h2>
            {produitsRupture.length > 0 && (
              <button className="rapports-bouton-export" onClick={exporterCsv}>
                Exporter en CSV
              </button>
            )}
          </div>

          {produitsRupture.length === 0 ? (
            <p className="rapports-vide">Aucun produit en rupture pour l'instant — bonne nouvelle.</p>
          ) : (
            <table className="rapports-table">
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Structures touchées</th>
                </tr>
              </thead>
              <tbody>
                {produitsRupture.map((p) => (
                  <tr key={p.produit}>
                    <td>{p.produit}</td>
                    <td>{p.structuresTouchees}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}