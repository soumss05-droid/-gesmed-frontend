import { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

async function appeler(chemin, options, token) {
  const res = await fetch(`${API_URL}${chemin}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options && options.headers ? options.headers : {}),
    },
  });
  let donnees = null;
  try {
    donnees = await res.json();
  } catch {
    donnees = null;
  }
  if (!res.ok) {
    throw new Error((donnees && donnees.erreur) || "Erreur serveur.");
  }
  return donnees;
}

const styles = {
  carte: {
    background: "#fff",
    border: "1px solid #d9dee5",
    borderRadius: 8,
    padding: 20,
    width: "100%",
    boxSizing: "border-box",
  },
  note: { color: "#5b6573", fontSize: 14, margin: "6px 0 16px" },
  ligne: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "10px 0",
    borderBottom: "1px solid #eef1f4",
  },
  libelle: { flex: 1, fontSize: 15 },
  champ: { width: 140, padding: "6px 8px", fontSize: 15, textAlign: "right" },
  suffixe: { width: 20, color: "#5b6573" },
  bouton: {
    marginTop: 18,
    padding: "9px 18px",
    fontSize: 15,
    cursor: "pointer",
  },
  erreur: { color: "#b3261e", marginTop: 12 },
  succes: { color: "#1b6e3c", marginTop: 12 },
};

export default function MargesBenefice({ token }) {
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [message, setMessage] = useState(null);
  const [defaut, setDefaut] = useState("0");
  const [niveaux, setNiveaux] = useState([]); // [{ niveau, libelle }]
  const [valeurs, setValeurs] = useState({}); // { HOPITAL: "20", ... }

  function appliquer(donnees) {
    setDefaut(String(donnees.defaut ?? 0));
    setNiveaux(donnees.niveaux.map((n) => ({ niveau: n.niveau, libelle: n.libelle })));
    const v = {};
    for (const n of donnees.niveaux) {
      v[n.niveau] = n.marge === null || n.marge === undefined ? "" : String(n.marge);
    }
    setValeurs(v);
  }

  useEffect(() => {
    let actif = true;
    async function charger() {
      setChargement(true);
      setErreur(null);
      try {
        const donnees = await appeler("/admin/marges", { method: "GET" }, token);
        if (actif) appliquer(donnees);
      } catch (e) {
        if (actif) setErreur(e.message);
      } finally {
        if (actif) setChargement(false);
      }
    }
    charger();
    return () => {
      actif = false;
    };
  }, [token]);

  async function enregistrer(ev) {
    ev.preventDefault();
    setErreur(null);
    setMessage(null);

    if (String(defaut).trim() === "" || !Number.isFinite(Number(defaut)) || Number(defaut) < 0) {
      setErreur("La marge par défaut est obligatoire (0 si aucune marge).");
      return;
    }
    const corps = { defaut: Number(defaut), niveaux: {} };
    for (const n of niveaux) {
      const v = String(valeurs[n.niveau] ?? "").trim();
      if (v === "") {
        corps.niveaux[n.niveau] = "";
      } else if (!Number.isFinite(Number(v)) || Number(v) < 0) {
        setErreur(`La marge « ${n.libelle} » doit être un nombre positif ou vide.`);
        return;
      } else {
        corps.niveaux[n.niveau] = Number(v);
      }
    }

    setEnCours(true);
    try {
      const donnees = await appeler("/admin/marges", { method: "PUT", body: JSON.stringify(corps) }, token);
      appliquer(donnees);
      setMessage("Marges enregistrées. Elles s'appliquent uniquement aux nouvelles dispensations.");
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(false);
    }
  }

  if (chargement) return <p>Chargement des marges…</p>;

  return (
    <form style={styles.carte} onSubmit={enregistrer}>
      <h2>Marges de bénéfice</h2>
      <p style={styles.note}>
        La marge s'ajoute au prix d'achat saisi à l'entrée du stock, au moment de la dispensation à la
        formation sanitaire. Exemple : prix de 100 MRU avec une marge de 20 % donne 120 MRU. Un niveau
        laissé vide utilise la marge par défaut. Les dispensations déjà enregistrées ne changent pas.
      </p>

      <div style={styles.ligne}>
        <label style={styles.libelle} htmlFor="marge-defaut">
          <strong>Marge par défaut</strong> (niveau non renseigné ou sans marge propre)
        </label>
        <input
          id="marge-defaut"
          style={styles.champ}
          type="number"
          min="0"
          max="1000"
          step="0.1"
          value={defaut}
          onChange={(e) => setDefaut(e.target.value)}
          required
        />
        <span style={styles.suffixe}>%</span>
      </div>

      {niveaux.map((n) => (
        <div style={styles.ligne} key={n.niveau}>
          <label style={styles.libelle} htmlFor={`marge-${n.niveau}`}>
            {n.libelle}
          </label>
          <input
            id={`marge-${n.niveau}`}
            style={styles.champ}
            type="number"
            min="0"
            max="1000"
            step="0.1"
            placeholder="défaut"
            value={valeurs[n.niveau] ?? ""}
            onChange={(e) => setValeurs({ ...valeurs, [n.niveau]: e.target.value })}
          />
          <span style={styles.suffixe}>%</span>
        </div>
      ))}

      {erreur && <p style={styles.erreur}>{erreur}</p>}
      {message && <p style={styles.succes}>{message}</p>}

      <button style={styles.bouton} type="submit" disabled={enCours}>
        {enCours ? "Enregistrement…" : "Enregistrer les marges"}
      </button>
    </form>
  );
}