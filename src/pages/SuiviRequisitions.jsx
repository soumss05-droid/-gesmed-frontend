import { useEffect, useState } from "react";
import "./SuiviRequisitions.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const LIBELLES_STATUT = {
  BROUILLON: "Brouillon",
  EN_ATTENTE: "En attente",
  REJETEE_POUR_CORRECTION: "Rejetée — à corriger",
  VALIDEE: "Validée",
  REJETEE: "Rejetée",
  EXPEDIEE: "Expédiée",
  CLOTUREE: "Clôturée",
  SCINDEE: "Scindée",
};

function classeStatut(statut) {
  if (statut === "REJETEE_POUR_CORRECTION" || statut === "REJETEE") return "suivi-badge-rouge";
  if (statut === "VALIDEE" || statut === "CLOTUREE" || statut === "EXPEDIEE") return "suivi-badge-vert";
  if (statut === "SCINDEE") return "suivi-badge-dore";
  return "suivi-badge-neutre"; // EN_ATTENTE, BROUILLON
}

function CarteRequisition({ requisition, estFille = false }) {
  return (
    <div className={`suivi-carte ${estFille ? "suivi-carte-fille" : ""}`}>
      <div className="suivi-carte-entete">
        <span className={`suivi-badge ${classeStatut(requisition.statut)}`}>
          {LIBELLES_STATUT[requisition.statut] || requisition.statut}
        </span>
        <span className="suivi-date">
          {new Date(requisition.dateCreation).toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })}
        </span>
      </div>

      <p className="suivi-niveau">
        Niveau actuel : <strong>{requisition.niveauActuel?.nom || "—"}</strong>
      </p>

      {requisition.justification && (
        <p className="suivi-justification">{requisition.justification}</p>
      )}

      <ul className="suivi-lignes">
        {requisition.lignes.map((l) => (
          <li key={l.id}>
            {l.produit.nom} — demandé {l.quantiteDemandee}, validé {l.quantiteValidee}
          </li>
        ))}
      </ul>

      {requisition.requisitionsEnfants && requisition.requisitionsEnfants.length > 0 && (
        <div className="suivi-enfants">
          <p className="suivi-enfants-titre">
            Scindée en {requisition.requisitionsEnfants.length} réquisition(s) :
          </p>
          {requisition.requisitionsEnfants.map((fille) => (
            <CarteRequisition key={fille.id} requisition={fille} estFille />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SuiviRequisitions({ onRetour }) {
  const [requisitions, setRequisitions] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);

  async function charger() {
    setChargement(true);
    setErreur(null);
    try {
      const token = localStorage.getItem("gesmed_token");
      const res = await fetch(`${API_URL}/requisitions/mes-requisitions`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erreur || "Impossible de charger tes réquisitions.");
      setRequisitions(data);
    } catch (err) {
      setErreur(err.message || "Connexion instable, réessayez.");
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    charger();
  }, []);

  return (
    <div className="suivi-page">
      <header className="suivi-header">
        <button className="suivi-retour" onClick={onRetour}>← Retour</button>
        <h1>Suivi de mes réquisitions</h1>
      </header>

      <p className="suivi-sous-titre">
        Réquisitions que tu as créées ou commandées, avec leur statut et niveau actuel dans le circuit.
      </p>

      {erreur && <p className="suivi-erreur" role="alert">{erreur}</p>}

      {chargement ? (
        <p>Chargement...</p>
      ) : requisitions.length === 0 ? (
        <p className="suivi-vide">Aucune réquisition pour l'instant.</p>
      ) : (
        <div className="suivi-liste">
          {requisitions.map((r) => (
            <CarteRequisition key={r.id} requisition={r} />
          ))}
        </div>
      )}
    </div>
  );
}