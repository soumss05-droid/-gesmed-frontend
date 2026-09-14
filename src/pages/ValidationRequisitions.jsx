import { useEffect, useState } from "react";
import "./ValidationRequisitions.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function ValidationRequisitions({ onRetour }) {
  const [requisitions, setRequisitions] = useState([]);
  const [stocksParProduit, setStocksParProduit] = useState({});
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [message, setMessage] = useState(null);
  const [enCours, setEnCours] = useState(null);

  async function chargerDonnees() {
    setChargement(true);
    setErreur(null);
    try {
      const token = localStorage.getItem("gesmed_token");
      const [resRequisitions, resStocks] = await Promise.all([
        fetch(`${API_URL}/requisitions/a-valider`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/stocks`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (!resRequisitions.ok) throw new Error("Impossible de charger les réquisitions.");
      const data = await resRequisitions.json();
      setRequisitions(
        data.map((r) => ({
          ...r,
          lignesEditees: r.lignes.map((l) => ({ ...l, quantiteValidee: l.quantiteValidee })),
        }))
      );

      if (resStocks.ok) {
        const stocks = await resStocks.json();
        const map = {};
        for (const s of stocks) map[s.produitId] = s.quantiteTotale;
        setStocksParProduit(map);
      }
    } catch (err) {
      setErreur(err.message || "Connexion instable, réessayez.");
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    chargerDonnees();
  }, []);

  function modifierQuantite(requisitionId, ligneId, valeur) {
    setRequisitions((prev) =>
      prev.map((r) =>
        r.id !== requisitionId
          ? r
          : {
              ...r,
              lignesEditees: r.lignesEditees.map((l) =>
                l.id === ligneId ? { ...l, quantiteValidee: valeur } : l
              ),
            }
      )
    );
  }

  async function envoyerDecision(requisition, decision) {
    setEnCours(requisition.id);
    setErreur(null);
    setMessage(null);
    try {
      const token = localStorage.getItem("gesmed_token");
      const body = {
        decision,
        lignes: requisition.lignesEditees.map((l) => ({
          requisitionLigneId: l.id,
          quantiteValidee: Number(l.quantiteValidee),
        })),
      };
      const res = await fetch(`${API_URL}/requisitions/${requisition.id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erreur || "La décision n'a pas pu être enregistrée.");

      if (decision === "valider") {
        if (data.partiel) {
          setMessage("Une partie a été livrée directement depuis votre stock ; le reste a été transmis au niveau supérieur.");
        } else if (data.livreeDirectement) {
          setMessage("Livrée entièrement depuis votre stock — bordereau de livraison généré.");
        } else {
          setMessage("Réquisition transmise au niveau supérieur.");
        }
      }

      setRequisitions((prev) => prev.filter((r) => r.id !== requisition.id));
    } catch (err) {
      setErreur(err.message || "Connexion instable, réessayez.");
    } finally {
      setEnCours(null);
    }
  }

  return (
    <div className="validation-page">
      <header className="validation-header">
        <button className="validation-retour" onClick={onRetour}>← Retour</button>
        <h1>Réquisitions à valider</h1>
      </header>

      {erreur && <p className="validation-erreur" role="alert">{erreur}</p>}
      {message && <p className="validation-message">{message}</p>}

      {chargement && <p>Chargement...</p>}

      {!chargement && requisitions.length === 0 && !erreur && (
        <p className="validation-vide">Aucune réquisition en attente pour l'instant.</p>
      )}

      {!chargement &&
        requisitions.map((r) => (
          <div className="validation-carte" key={r.id}>
            <div className="validation-carte__entete">
              <strong>{r.etablissementDemandeur?.nom}</strong>
              <span>{new Date(r.dateCreation).toLocaleDateString("fr-FR")}</span>
            </div>

            {r.justification && <p className="validation-justification">« {r.justification} »</p>}

            <table className="validation-table">
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Demandé</th>
                  <th>Disponible ici</th>
                  <th>Validé</th>
                </tr>
              </thead>
              <tbody>
                {r.lignesEditees.map((ligne) => {
                  const disponible = stocksParProduit[ligne.produitId] ?? 0;
                  return (
                    <tr key={ligne.id}>
                      <td>{ligne.produit?.nom}</td>
                      <td>{ligne.quantiteDemandee}</td>
                      <td className={disponible >= ligne.quantiteValidee ? "validation-dispo-ok" : "validation-dispo-partiel"}>
                        {disponible}
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          value={ligne.quantiteValidee}
                          onChange={(e) => modifierQuantite(r.id, ligne.id, e.target.value)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="validation-actions">
              <button
                className="validation-bouton validation-bouton--rejeter"
                disabled={enCours === r.id}
                onClick={() => envoyerDecision(r, "rejeter")}
              >
                Rejeter
              </button>
              <button
                className="validation-bouton validation-bouton--valider"
                disabled={enCours === r.id}
                onClick={() => envoyerDecision(r, "valider")}
              >
                {enCours === r.id ? "..." : "Valider"}
              </button>
            </div>
          </div>
        ))}
    </div>
  );
}