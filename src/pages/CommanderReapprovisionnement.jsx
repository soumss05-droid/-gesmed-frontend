// CommanderReapprovisionnement.jsx
import { useEffect, useState } from "react";
import BoutonsExport from "../components/BoutonsExport";
import "./CommanderReapprovisionnement.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

// Pour la recherche : sans accents ni majuscules.
function normaliser(texte) {
  return String(texte || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

// Quantité saisie sous forme de nombre (0 si vide ou invalide).
function quantiteSaisie(valeur) {
  const n = Number(valeur);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export default function CommanderReapprovisionnement({ session, onRetour }) {
  const [suggestions, setSuggestions] = useState([]);
  const [quantites, setQuantites] = useState({});
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [message, setMessage] = useState(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [justification, setJustification] = useState("");
  const [derniereCommande, setDerniereCommande] = useState(null);
  const [recherche, setRecherche] = useState("");
  const [afficherTous, setAfficherTous] = useState(false);

  async function chargerSuggestions() {
    setChargement(true);
    setErreur(null);
    try {
      const token = localStorage.getItem("SYGIMS_token");
      const res = await fetch(`${API_URL}/stocks/commande-suggeree`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erreur || "Impossible de calculer la commande suggérée.");
      setSuggestions(data);

      const initial = {};
      for (const s of data) {
        if (s.quantiteSuggeree > 0) initial[s.produitId] = String(s.quantiteSuggeree);
      }
      setQuantites(initial);
    } catch (err) {
      setErreur(err.message || "Connexion instable, réessayez.");
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    chargerSuggestions();
  }, []);

  function majQuantite(produitId, valeur) {
    setQuantites((q) => ({ ...q, [produitId]: valeur }));
  }

  // Règle commune à tous les niveaux : toute quantité qui diffère de la
  // suggestion (dans un sens ou dans l'autre) doit être justifiée.
  const ecarts = suggestions.filter((s) => quantiteSaisie(quantites[s.produitId]) !== s.quantiteSuggeree);
  const justificationObligatoire = ecarts.length > 0;

  async function soumettre(ev) {
    ev.preventDefault();
    setErreur(null);
    setMessage(null);

    const lignes = Object.entries(quantites)
      .filter(([, valeur]) => valeur !== "" && Number(valeur) > 0)
      .map(([produitId, valeur]) => ({ produitId, quantite: Number(valeur) }));

    if (lignes.length === 0) {
      setErreur("Indique au moins une quantité à commander.");
      return;
    }

    if (justificationObligatoire && justification.trim() === "") {
      setErreur(
        `Une justification est obligatoire : ${ecarts.length} produit(s) ont une quantité différente de la suggestion.`
      );
      return;
    }

    const lignesAvecNoms = lignes.map((l) => ({
      ...l,
      produit: suggestions.find((s) => s.produitId === l.produitId)?.produit || l.produitId,
    }));

    setEnvoiEnCours(true);
    try {
      const token = localStorage.getItem("SYGIMS_token");
      const res = await fetch(`${API_URL}/requisitions/reapprovisionnement`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ lignes, justification: justification || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erreur || "La commande a échoué.");

      const requisitionsCreees = data.requisitions || [];
      const numeros = requisitionsCreees.map((r) => r.numero).filter((n) => n !== undefined && n !== null);
      const nb = requisitionsCreees.length;

      setMessage(
        nb > 1
          ? `Commande envoyée — scindée en ${nb} réquisitions (plusieurs programmes concernés) : N°${numeros.join(", N°")}.`
          : numeros.length > 0
          ? `Commande envoyée avec succès — N°${numeros[0]}.`
          : "Commande envoyée avec succès."
      );
      setDerniereCommande({
        numeros: numeros.length > 0 ? numeros : ["—"],
        lignes: lignesAvecNoms,
        justification,
        etablissementNom: data.etablissementNom || "",
        envoyeLe: new Date(),
        groupes: requisitionsCreees.map((r) => ({
          numero: r.numero,
          destinataire: r.niveauActuel && r.niveauActuel.nom ? r.niveauActuel.nom : "",
          lignes: (r.lignes || []).map((l) => ({
            produit: (suggestions.find((s) => s.produitId === l.produitId) || {}).produit || l.produitId,
            quantite: l.quantiteDemandee,
          })),
        })),
      });
      setQuantites({});
      setJustification("");
      chargerSuggestions();
    } catch (err) {
      setErreur(err.message || "Connexion instable, réessayez.");
    } finally {
      setEnvoiEnCours(false);
    }
  }

  // Produits affichés : recherche (dans tous les produits), sinon liste courte
  // (suggestion > 0 ou quantité déjà saisie), sinon tous si demandé.
  const terme = normaliser(recherche.trim());
  const produitsVisibles = suggestions.filter((s) => {
    if (terme) return normaliser(s.produit).includes(terme);
    if (afficherTous) return true;
    return s.quantiteSuggeree > 0 || Number(quantites[s.produitId]) > 0;
  });
  const nbSaisis = Object.values(quantites).filter((v) => v !== "" && Number(v) > 0).length;

  return (
    <div className="reappro-page">
      <header className="reappro-header">
        <button className="reappro-retour" onClick={onRetour}>← Retour</button>
        <h1>Commander un réapprovisionnement</h1>
      </header>

      <p className="reappro-sous-titre">
        Quantités suggérées automatiquement à partir de ta distribution moyenne mensuelle (DMM) et du stock
        disponible sur tout ton territoire. Ajuste librement avant d'envoyer ; toute quantité différente de la
        suggestion doit être justifiée.
      </p>

      {erreur && <p className="reappro-erreur" role="alert">{erreur}</p>}

      {message && (
        <div className="reappro-message">
          <p>{message}</p>
          {derniereCommande && (
            <div id="confirmation-commande" className="reappro-confirmation">
              <div style={{ textAlign: "center", lineHeight: 1.4, borderBottom: "1px solid #444", paddingBottom: "10px", marginBottom: "12px" }}>
                <div style={{ fontWeight: 700 }}>{"R\u00e9publique Islamique de Mauritanie"}</div>
                <div style={{ fontSize: "12px" }}>{"Honneur - Fraternit\u00e9 - Justice"}</div>
                <div style={{ fontWeight: 700, marginTop: "6px" }}>{"Minist\u00e8re de la Sant\u00e9"}</div>
                <div style={{ fontSize: "12px" }}>{"Programme National de Lutte contre le Sida, les H\u00e9patites et les IST (PNLS)"}</div>
                {derniereCommande.etablissementNom && (
                  <div style={{ marginTop: "6px" }}>{"\u00c9tablissement demandeur : " + derniereCommande.etablissementNom}</div>
                )}
              </div>
              <h2>
                {derniereCommande.numeros.length > 1
                  ? `Commande de réapprovisionnement — N°${derniereCommande.numeros.join(", N°")}`
                  : `Commande de réapprovisionnement — N°${derniereCommande.numeros[0]}`}
              </h2>
              {false && (
                <p className="reappro-confirmation-meta">
                  Établissement : {session.utilisateur.etablissementNom}
                </p>
              )}
              <p className="reappro-confirmation-meta">
                Envoyée le {derniereCommande.envoyeLe.toLocaleDateString("fr-FR")} à {derniereCommande.envoyeLe.toLocaleTimeString("fr-FR")}
              </p>
              {derniereCommande.groupes.map((g) => (
                <div key={g.numero} style={{ marginBottom: "14px" }}>
                  <p style={{ fontWeight: 700, margin: "10px 0 4px" }}>
                    {"R\u00e9quisition N\u00b0" + g.numero + (g.destinataire ? " \u2014 destin\u00e9e \u00e0 : " + g.destinataire : "")}
                  </p>
                  <table className="reappro-table-confirmation">
                    <thead>
                      <tr>
                        <th>Produit</th>
                        <th>{"Quantit\u00e9 command\u00e9e"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.lignes.map((l, i) => (
                        <tr key={i}>
                          <td>{l.produit}</td>
                          <td>{l.quantite}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
              {derniereCommande.justification && (
                <p className="reappro-confirmation-justif">
                  <strong>Justification :</strong> {derniereCommande.justification}
                </p>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", gap: "24px", marginTop: "28px", fontSize: "13px" }}>
                <div style={{ flex: 1, textAlign: "center" }}>
                  {"Le demandeur (nom, signature, cachet)"}
                  <div style={{ borderBottom: "1px solid #444", height: "56px", marginTop: "6px" }}></div>
                </div>
                <div style={{ flex: 1, textAlign: "center" }}>
                  {"Visa du responsable"}
                  <div style={{ borderBottom: "1px solid #444", height: "56px", marginTop: "6px" }}></div>
                </div>
              </div>
              <BoutonsExport
                cibleId="confirmation-commande"
                nomFichier={`commande-${derniereCommande.numeros.join("-")}`}
              />
            </div>
          )}
        </div>
      )}

      {chargement ? (
        <p>Calcul des besoins en cours...</p>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "12px",
              alignItems: "center",
              margin: "12px 0 6px",
            }}
          >
            <input
              type="search"
              name="recherche-produit"
              aria-label="Rechercher un produit"
              placeholder="Rechercher un produit..."
              autoComplete="off"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              style={{ flex: "1 1 240px", minWidth: 0, padding: "8px 10px" }}
            />
            <button
              type="button"
              onClick={() => setAfficherTous((v) => !v)}
              style={{ padding: "8px 12px", cursor: "pointer" }}
            >
              {afficherTous
                ? "Voir seulement les produits à commander"
                : `Voir tous les produits (${suggestions.length})`}
            </button>
          </div>
          <p className="reappro-sous-titre" style={{ margin: "0 0 10px" }}>
            Affichage de {produitsVisibles.length} produit(s) sur {suggestions.length} — {nbSaisis} quantité(s)
            saisie(s) à envoyer.
          </p>

          <form className="reappro-formulaire" onSubmit={soumettre}>
            <table className="reappro-table">
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>DMM</th>
                  <th>Stock disponible</th>
                  <th>Suggéré</th>
                  <th>Quantité à commander</th>
                </tr>
              </thead>
              <tbody>
                {produitsVisibles.length === 0 && (
                  <tr>
                    <td colSpan={5}>
                      {terme
                        ? "Aucun produit ne correspond à cette recherche."
                        : "Aucun produit à commander d'après les besoins calculés. Utilise la recherche ou « Voir tous les produits »."}
                    </td>
                  </tr>
                )}
                {produitsVisibles.map((s) => {
                  const differe = quantiteSaisie(quantites[s.produitId]) !== s.quantiteSuggeree;
                  return (
                    <tr key={s.produitId}>
                      <td>{s.produit}</td>
                      <td>{s.cmm}</td>
                      <td>{s.stockDisponible}</td>
                      <td className={s.quantiteSuggeree > 0 ? "reappro-suggestion-positive" : ""}>
                        {s.quantiteSuggeree}
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          name={`quantite-${s.produitId}`}
                          autoComplete="off"
                          value={quantites[s.produitId] ?? ""}
                          onChange={(e) => majQuantite(s.produitId, e.target.value)}
                        />
                        {differe && (
                          <small style={{ display: "block", color: "#b45309", marginTop: "2px" }}>
                            Différent de la suggestion ({s.quantiteSuggeree})
                          </small>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {justificationObligatoire && (
              <p style={{ color: "#b45309", margin: "12px 0 0" }} role="status">
                {ecarts.length} produit(s) différent(s) de la suggestion : justification obligatoire.
              </p>
            )}

            <div className="reappro-champ">
              <label>Justification {justificationObligatoire ? "(obligatoire)" : "(optionnel)"}</label>
              <textarea
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Contexte de cette commande..."
                rows={3}
                aria-required={justificationObligatoire}
              />
            </div>

            <div className="reappro-actions">
              <button type="submit" className="reappro-bouton" disabled={envoiEnCours}>
                {envoiEnCours ? "..." : "Envoyer la commande"}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}