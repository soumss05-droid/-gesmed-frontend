import { useEffect, useState } from "react";
import "./Ecarts.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export default function Ecarts({ onRetour }) {
  const [onglet, setOnglet] = useState("bl");
  const [ecartsBl, setEcartsBl] = useState([]);
  const [ecartsInventaire, setEcartsInventaire] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [message, setMessage] = useState(null);
  const [motifs, setMotifs] = useState({}); // { id: "texte du motif" }
  const [enCours, setEnCours] = useState(null); // id de la ligne en cours de traitement

  async function charger() {
    setChargement(true);
    setErreur(null);
    try {
      const token = localStorage.getItem("gesmed_token");
      const entetes = { Authorization: `Bearer ${token}` };
      const [resBl, resInv] = await Promise.all([
        fetch(`${API_URL}/ecarts/en-attente`, { headers: entetes }),
        fetch(`${API_URL}/inventaires/ecarts-en-attente`, { headers: entetes }),
      ]);
      if (!resBl.ok) throw new Error("Impossible de charger les écarts de bordereaux.");
      if (!resInv.ok) throw new Error("Impossible de charger les écarts d'inventaire.");
      setEcartsBl(await resBl.json());
      setEcartsInventaire(await resInv.json());
    } catch (err) {
      setErreur(err.message || "Connexion instable, réessayez.");
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    charger();
  }, []);

  function majMotif(id, valeur) {
    setMotifs((m) => ({ ...m, [id]: valeur }));
  }

  async function traiterBl(ligneId, decision) {
    const motif = (motifs[ligneId] || "").trim();
    if (!motif) {
      setErreur("Un motif est obligatoire avant de trancher un écart.");
      return;
    }
    setErreur(null);
    setMessage(null);
    setEnCours(ligneId);
    try {
      const token = localStorage.getItem("gesmed_token");
      const res = await fetch(`${API_URL}/ecarts/${ligneId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ decision, motif }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erreur || "La décision n'a pas pu être enregistrée.");
      setMessage(`Écart de bordereau ${decision === "debloquer" ? "débloqué" : "maintenu"} avec succès.`);
      setEcartsBl((liste) => liste.filter((e) => e.id !== ligneId));
    } catch (err) {
      setErreur(err.message || "Connexion instable, réessayez.");
    } finally {
      setEnCours(null);
    }
  }

  async function traiterInventaire(ligneId, decision) {
    const motif = (motifs[ligneId] || "").trim();
    if (!motif) {
      setErreur("Un motif est obligatoire avant de trancher un écart.");
      return;
    }
    setErreur(null);
    setMessage(null);
    setEnCours(ligneId);
    try {
      const token = localStorage.getItem("gesmed_token");
      const res = await fetch(`${API_URL}/inventaires/lignes/${ligneId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ decision, motif }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erreur || "La décision n'a pas pu être enregistrée.");
      setMessage(`Écart d'inventaire ${decision === "debloquer" ? "débloqué" : "maintenu"} avec succès.`);
      setEcartsInventaire((liste) => liste.filter((e) => e.id !== ligneId));
    } catch (err) {
      setErreur(err.message || "Connexion instable, réessayez.");
    } finally {
      setEnCours(null);
    }
  }

  return (
    <div className="ecarts-page">
      <header className="ecarts-header">
        <button className="ecarts-retour" onClick={onRetour}>← Retour</button>
        <h1>Écarts en attente</h1>
      </header>

      <p className="ecarts-sous-titre">
        Un motif est obligatoire pour chaque décision. "Débloquer" ajuste le stock pour correspondre au
        constat ; "Maintenir" laisse le stock système inchangé et classe l'écart sans correction.
      </p>

      {erreur && <p className="ecarts-erreur" role="alert">{erreur}</p>}
      {message && <p className="ecarts-message">{message}</p>}

      <div className="ecarts-onglets">
        <button className={onglet === "bl" ? "ecarts-onglet-actif" : "ecarts-onglet"} onClick={() => setOnglet("bl")}>
          Bordereaux de livraison ({ecartsBl.length})
        </button>
        <button className={onglet === "inventaire" ? "ecarts-onglet-actif" : "ecarts-onglet"} onClick={() => setOnglet("inventaire")}>
          Inventaire physique ({ecartsInventaire.length})
        </button>
      </div>

      {chargement ? (
        <p>Chargement...</p>
      ) : onglet === "bl" ? (
        ecartsBl.length === 0 ? (
          <p className="ecarts-vide">Aucun écart de bordereau en attente.</p>
        ) : (
          <div className="ecarts-liste">
            {ecartsBl.map((e) => (
              <div className="ecarts-carte" key={e.id}>
                <div className="ecarts-carte-entete">
                  <strong>{e.produit?.nom}</strong>
                  <span className="ecarts-badge">
                    {e.bl?.etablissementExpediteur?.nom} → {e.bl?.etablissementDestinataire?.nom}
                  </span>
                </div>
                <p className="ecarts-detail">
                  Envoyé : {e.quantiteEnvoyee} — Reçu déclaré : {e.quantiteRecue} — Écart :{" "}
                  <strong className={e.ecart < 0 ? "ecarts-negatif" : "ecarts-positif"}>
                    {e.ecart > 0 ? `+${e.ecart}` : e.ecart}
                  </strong>
                </p>
                <textarea
                  className="ecarts-motif"
                  placeholder="Motif de la décision (obligatoire)..."
                  value={motifs[e.id] || ""}
                  onChange={(ev) => majMotif(e.id, ev.target.value)}
                  rows={2}
                />
                <div className="ecarts-actions">
                  <button
                    className="ecarts-bouton-maintenir"
                    disabled={enCours === e.id}
                    onClick={() => traiterBl(e.id, "maintenir")}
                  >
                    Maintenir
                  </button>
                  <button
                    className="ecarts-bouton-debloquer"
                    disabled={enCours === e.id}
                    onClick={() => traiterBl(e.id, "debloquer")}
                  >
                    Débloquer
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : ecartsInventaire.length === 0 ? (
        <p className="ecarts-vide">Aucun écart d'inventaire en attente.</p>
      ) : (
        <div className="ecarts-liste">
          {ecartsInventaire.map((e) => (
            <div className="ecarts-carte" key={e.id}>
              <div className="ecarts-carte-entete">
                <strong>{e.lot?.produit?.nom}</strong>
                <span className="ecarts-badge">{e.lot?.etablissement?.nom}</span>
              </div>
              <p className="ecarts-detail">
                Système : {e.quantiteSysteme} — Compté : {e.quantitePhysique} — Écart :{" "}
                <strong className={e.ecart < 0 ? "ecarts-negatif" : "ecarts-positif"}>
                  {e.ecart > 0 ? `+${e.ecart}` : e.ecart}
                </strong>
              </p>
              <p className="ecarts-meta">
                Inventaire par {e.inventaire?.effectuePar?.nomComplet} le{" "}
                {new Date(e.inventaire?.dateInventaire).toLocaleDateString("fr-FR")}
              </p>
              <textarea
                className="ecarts-motif"
                placeholder="Motif de la décision (obligatoire)..."
                value={motifs[e.id] || ""}
                onChange={(ev) => majMotif(e.id, ev.target.value)}
                rows={2}
              />
              <div className="ecarts-actions">
                <button
                  className="ecarts-bouton-maintenir"
                  disabled={enCours === e.id}
                  onClick={() => traiterInventaire(e.id, "maintenir")}
                >
                  Maintenir
                </button>
                <button
                  className="ecarts-bouton-debloquer"
                  disabled={enCours === e.id}
                  onClick={() => traiterInventaire(e.id, "debloquer")}
                >
                  Débloquer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}