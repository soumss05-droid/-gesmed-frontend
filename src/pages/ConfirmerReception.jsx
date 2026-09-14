import { useEffect, useState } from "react";
import "./ConfirmerReception.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function ConfirmerReception({ onRetour }) {
  const [bls, setBls] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [message, setMessage] = useState(null);
  const [enCours, setEnCours] = useState(null);

  async function charger() {
    setChargement(true);
    setErreur(null);
    try {
      const token = localStorage.getItem("gesmed_token");
      const res = await fetch(`${API_URL}/distribution/reception/en-attente`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erreur || "Impossible de charger les bordereaux.");
      setBls(
        data.map((bl) => ({
          ...bl,
          lignesEditees: bl.lignes.map((l) => ({ ...l, quantiteRecue: l.quantiteEnvoyee })),
        }))
      );
    } catch (err) {
      setErreur(err.message || "Connexion instable, réessayez.");
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    charger();
  }, []);

  function modifierQuantiteRecue(blId, ligneId, valeur) {
    setBls((prev) =>
      prev.map((bl) =>
        bl.id !== blId
          ? bl
          : {
              ...bl,
              lignesEditees: bl.lignesEditees.map((l) =>
                l.id === ligneId ? { ...l, quantiteRecue: valeur } : l
              ),
            }
      )
    );
  }

  async function confirmer(bl) {
    setEnCours(bl.id);
    setErreur(null);
    setMessage(null);
    try {
      const token = localStorage.getItem("gesmed_token");
      const res = await fetch(`${API_URL}/distribution/reception/${bl.id}/confirmer`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          lignes: bl.lignesEditees.map((l) => ({
            blLigneId: l.id,
            quantiteRecue: Number(l.quantiteRecue),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erreur || "La confirmation a échoué.");

      const auMoinsUnEcart = bl.lignesEditees.some(
        (l) => Number(l.quantiteRecue) !== l.quantiteEnvoyee
      );
      setMessage(
        auMoinsUnEcart
          ? "Réception confirmée avec écart(s) — en attente d'arbitrage."
          : "Réception confirmée, stock mis à jour."
      );
      setBls((prev) => prev.filter((b) => b.id !== bl.id));
    } catch (err) {
      setErreur(err.message || "Connexion instable, réessayez.");
    } finally {
      setEnCours(null);
    }
  }

  return (
    <div className="reception-page">
      <header className="reception-header">
        <button className="reception-retour" onClick={onRetour}>← Retour</button>
        <h1>Bordereaux à confirmer</h1>
      </header>

      {erreur && <p className="reception-erreur" role="alert">{erreur}</p>}
      {message && <p className="reception-message">{message}</p>}
      {chargement && <p>Chargement...</p>}

      {!chargement && bls.length === 0 && !erreur && (
        <p className="reception-vide">Aucun bordereau en attente de réception.</p>
      )}

      {!chargement &&
        bls.map((bl) => (
          <div className="reception-carte" key={bl.id}>
            <div className="reception-carte__entete">
              <strong>De : {bl.etablissementExpediteur?.nom}</strong>
              <span>{new Date(bl.dateEnvoi).toLocaleDateString("fr-FR")}</span>
            </div>

            <table className="reception-table">
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>N° de lot</th>
                  <th>Envoyé</th>
                  <th>Reçu</th>
                </tr>
              </thead>
              <tbody>
                {bl.lignesEditees.map((ligne) => (
                  <tr key={ligne.id}>
                    <td>{ligne.produit?.nom}</td>
                    <td>{ligne.lot?.numeroLot}</td>
                    <td>{ligne.quantiteEnvoyee}</td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        value={ligne.quantiteRecue}
                        onChange={(e) => modifierQuantiteRecue(bl.id, ligne.id, e.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="reception-actions">
              <button
                className="reception-bouton"
                disabled={enCours === bl.id}
                onClick={() => confirmer(bl)}
              >
                {enCours === bl.id ? "..." : "Confirmer la réception"}
              </button>
            </div>
          </div>
        ))}
    </div>
  );
}