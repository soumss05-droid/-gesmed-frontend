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

const DELAI_AVANT_RELANCE_HEURES = 48;

function heuresEcoulees(depuis) {
  return (Date.now() - new Date(depuis).getTime()) / (1000 * 60 * 60);
}

function CarteRequisition({ requisition, estFille = false, onRelancer, relanceEtat }) {
  const peutRelancer =
    requisition.statut === "EN_ATTENTE" &&
    heuresEcoulees(requisition.dateDerniereMaj || requisition.dateCreation) >= DELAI_AVANT_RELANCE_HEURES;

  const etat = relanceEtat?.[requisition.id];

  return (
    <div className={`suivi-carte ${estFille ? "suivi-carte-fille" : ""}`}>
      <div className="suivi-carte-entete">
        <span className="suivi-numero">N°{requisition.numero}</span>
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

      {peutRelancer && (
        <div className="suivi-relance">
          <button
            className="suivi-bouton-relance"
            disabled={etat?.enCours}
            onClick={() => onRelancer(requisition.id)}
          >
            {etat?.enCours ? "Envoi..." : "Relancer"}
          </button>
          {etat?.message && (
            <span className={`suivi-relance-message ${etat.succes ? "suivi-relance-ok" : "suivi-relance-erreur"}`}>
              {etat.message}
            </span>
          )}
        </div>
      )}

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
            <CarteRequisition
              key={fille.id}
              requisition={fille}
              estFille
              onRelancer={onRelancer}
              relanceEtat={relanceEtat}
            />
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
  const [relanceEtat, setRelanceEtat] = useState({});

  async function relancer(requisitionId) {
    setRelanceEtat((etats) => ({ ...etats, [requisitionId]: { enCours: true } }));
    try {
      const token = localStorage.getItem("SYGIMS_token");
      const res = await fetch(`${API_URL}/requisitions/${requisitionId}/relancer`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erreur || "Impossible de relancer cette réquisition.");
      setRelanceEtat((etats) => ({
        ...etats,
        [requisitionId]: { enCours: false, succes: true, message: "Relance envoyée." },
      }));
    } catch (err) {
      setRelanceEtat((etats) => ({
        ...etats,
        [requisitionId]: { enCours: false, succes: false, message: err.message || "Échec de la relance." },
      }));
    }
  }

  async function charger() {
    setChargement(true);
    setErreur(null);
    try {
      const token = localStorage.getItem("SYGIMS_token");
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
            <CarteRequisition key={r.id} requisition={r} onRelancer={relancer} relanceEtat={relanceEtat} />
          ))}
        </div>
      )}
    </div>
  );
}