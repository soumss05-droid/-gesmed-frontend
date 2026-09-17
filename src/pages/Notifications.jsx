import { useEffect, useState } from "react";
import "./Notifications.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const LIBELLES_TYPE = {
  VALIDEE: "Validée",
  MODIFIEE: "Modifiée",
  SCINDEE: "Scindée",
  REJETEE_POUR_CORRECTION: "Rejetée — à corriger",
  RUPTURE_STOCK: "Rupture de stock",
};

function classeType(type) {
  if (type === "REJETEE_POUR_CORRECTION" || type === "RUPTURE_STOCK") return "notif-badge-rouge";
  if (type === "MODIFIEE" || type === "SCINDEE") return "notif-badge-dore";
  return "notif-badge-vert"; // VALIDEE
}

export default function Notifications({ onRetour }) {
  const [notifications, setNotifications] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);

  async function charger() {
    setChargement(true);
    setErreur(null);
    try {
      const token = localStorage.getItem("gesmed_token");
      const res = await fetch(`${API_URL}/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erreur || "Impossible de charger les notifications.");
      setNotifications(data);
    } catch (err) {
      setErreur(err.message || "Connexion instable, réessayez.");
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    charger();
  }, []);

  async function marquerLue(id) {
    setNotifications((liste) => liste.map((n) => (n.id === id ? { ...n, lue: true } : n)));
    try {
      const token = localStorage.getItem("gesmed_token");
      await fetch(`${API_URL}/notifications/${id}/lue`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // Pas grave si ça échoue silencieusement — un rechargement corrigera l'état.
    }
  }

  const nonLues = notifications.filter((n) => !n.lue).length;

  return (
    <div className="notif-page">
      <header className="notif-header">
        <button className="notif-retour" onClick={onRetour}>← Retour</button>
        <h1>Notifications</h1>
      </header>

      <p className="notif-sous-titre">
        {nonLues > 0 ? `${nonLues} non lue(s).` : "Tout est à jour."}
      </p>

      {erreur && <p className="notif-erreur" role="alert">{erreur}</p>}

      {chargement ? (
        <p>Chargement...</p>
      ) : notifications.length === 0 ? (
        <p className="notif-vide">Aucune notification pour l'instant.</p>
      ) : (
        <div className="notif-liste">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`notif-carte ${n.lue ? "notif-carte-lue" : ""}`}
              onClick={() => !n.lue && marquerLue(n.id)}
            >
              <div className="notif-carte-entete">
                <span className={`notif-badge ${classeType(n.type)}`}>
                  {LIBELLES_TYPE[n.type] || n.type}
                </span>
                <span className="notif-date">
                  {new Date(n.createdAt).toLocaleDateString("fr-FR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="notif-message">{n.message}</p>
              {n.etablissementAuteur && (
                <p className="notif-auteur">Par : {n.etablissementAuteur.nom}</p>
              )}
              {!n.lue && <span className="notif-point"></span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}