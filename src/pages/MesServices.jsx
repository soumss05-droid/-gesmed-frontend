import { useEffect, useMemo, useState } from "react";
import "./AdminPanel.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const LIBELLES_DEPENDANCE = {
  PRODUITS: "dépend de produits",
  EQUIPEMENT: "dépend d'un équipement",
  PERSONNEL: "dépend du personnel formé",
  AUTRE: "",
};

function jeton() {
  return localStorage.getItem("SYGIMS_token") || localStorage.getItem("gesmed_token");
}

// Grille commune à l'en-tête et aux lignes : colonne service (souple) + colonne Oui/Non (fixe).
const GRILLE = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 150px",
  alignItems: "center",
  columnGap: "16px",
  textAlign: "left",
};

const styleEntete = {
  ...GRILLE,
  padding: "6px 0",
  borderBottom: "2px solid #c9c9c9",
  fontSize: "0.85rem",
  fontWeight: 600,
  opacity: 0.75,
};

const styleLigne = {
  ...GRILLE,
  padding: "10px 0",
  borderBottom: "1px solid #e2e2e2",
};

const styleBoutons = {
  display: "flex",
  gap: "8px",
  justifyContent: "flex-start",
};

function styleChoix(actif, couleur) {
  return {
    flex: "0 0 71px",
    width: "71px",
    padding: "8px 0",
    textAlign: "center",
    borderRadius: "6px",
    border: `1px solid ${couleur}`,
    background: actif ? couleur : "transparent",
    color: actif ? "#fff" : couleur,
    fontWeight: 600,
    cursor: "pointer",
  };
}

export default function MesServices({ onRetour }) {
  const [donnees, setDonnees] = useState(null);
  const [reponses, setReponses] = useState({});
  const [initial, setInitial] = useState({});
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState(null);
  const [erreur, setErreur] = useState(null);

  async function charger() {
    setChargement(true);
    setErreur(null);
    try {
      const res = await fetch(`${API_URL}/offre-service/mes-services`, {
        headers: { Authorization: `Bearer ${jeton()}` },
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erreur || "Impossible de charger les services.");
      const etat = {};
      for (const p of data.programmes) {
        for (const g of p.groupes) {
          for (const s of g.services) etat[s.id] = s.offert;
        }
      }
      setDonnees(data);
      setReponses(etat);
      setInitial(etat);
    } catch (err) {
      setErreur(err.message || "Connexion instable, réessayez.");
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    charger();
  }, []);

  function choisir(serviceId, valeur) {
    setMessage(null);
    setReponses((r) => ({ ...r, [serviceId]: valeur }));
  }

  const modifies = useMemo(
    () => Object.keys(reponses).filter((id) => reponses[id] !== null && reponses[id] !== initial[id]),
    [reponses, initial]
  );

  const total = Object.keys(reponses).length;
  const renseignes = Object.values(reponses).filter((v) => v !== null).length;

  async function enregistrer() {
    setEnCours(true);
    setMessage(null);
    setErreur(null);
    try {
      const res = await fetch(`${API_URL}/offre-service/mes-services`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jeton()}` },
        body: JSON.stringify({ services: modifies.map((id) => ({ serviceId: id, offert: reponses[id] })) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erreur || "Impossible d'enregistrer les services.");
      setInitial({ ...reponses });
      setMessage(data.message || "Services enregistrés.");
    } catch (err) {
      setErreur(err.message || "Connexion instable, réessayez.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="admin-page" style={{ textAlign: "left" }}>
      <header className="admin-header">
        <button className="admin-retour" onClick={onRetour}>← Retour</button>
        <h1>Mes services</h1>
      </header>

      {chargement && <p>Chargement...</p>}
      {erreur && <p className="admin-erreur" role="alert">{erreur}</p>}
      {message && <p className="admin-message">{message}</p>}

      {donnees && (
        <>
          <p>
            <strong>{donnees.etablissement.nom}</strong> — {renseignes} service(s) renseigné(s) sur {total}.
            Indiquez pour chaque service si votre structure l'offre actuellement.
          </p>

          {donnees.programmes.map((programme) => (
            <section key={programme.code} style={{ marginBottom: "28px" }}>
              <h2 style={{ textAlign: "left" }}>{programme.nom}</h2>

              <div style={styleEntete}>
                <div>Service</div>
                <div>Offert ?</div>
              </div>

              {programme.groupes.map((groupe) => (
                <div key={groupe.groupe}>
                  {groupe.groupe !== programme.nom && (
                    <h3 style={{ textAlign: "left", margin: "16px 0 4px" }}>{groupe.groupe}</h3>
                  )}
                  {groupe.services.map((service) => (
                    <div key={service.id} style={styleLigne}>
                      <div style={{ minWidth: 0 }}>
                        <div>{service.nom}</div>
                        {LIBELLES_DEPENDANCE[service.dependance] && (
                          <small style={{ opacity: 0.7, display: "block" }}>
                            {LIBELLES_DEPENDANCE[service.dependance]}
                          </small>
                        )}
                        {service.misAJourLe && (
                          <small style={{ opacity: 0.7, display: "block" }}>
                            Mis à jour le {new Date(service.misAJourLe).toLocaleDateString("fr-FR")}
                          </small>
                        )}
                      </div>
                      <div style={styleBoutons}>
                        <button
                          type="button"
                          aria-pressed={reponses[service.id] === true}
                          style={styleChoix(reponses[service.id] === true, "#1f7a3d")}
                          onClick={() => choisir(service.id, true)}
                        >
                          Oui
                        </button>
                        <button
                          type="button"
                          aria-pressed={reponses[service.id] === false}
                          style={styleChoix(reponses[service.id] === false, "#b3261e")}
                          onClick={() => choisir(service.id, false)}
                        >
                          Non
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </section>
          ))}

          <button className="admin-bouton" onClick={enregistrer} disabled={enCours || modifies.length === 0}>
            {enCours ? "Enregistrement..." : `Enregistrer (${modifies.length} modification(s))`}
          </button>
        </>
      )}
    </div>
  );
}