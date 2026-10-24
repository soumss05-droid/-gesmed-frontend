import { useCallback, useEffect, useState } from "react";
import "./Destructions.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";
const ROLES_VALIDATION = ["GAS_PROGRAMME_NATIONAL", "ADMIN"];

const LIBELLE_STATUT = {
  EN_ATTENTE: "En attente",
  AUTORISEE: "Autorisée (à détruire)",
  VALIDEE: "Détruite",
  REJETEE: "Rejetée",
};

const LIBELLE_CAUSE = {
  PERIME: "Périmé",
  AVARIE: "Avarié",
};

function formaterDate(valeur) {
  if (!valeur) return "—";
  const d = new Date(valeur);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("fr-FR");
}

function EtiquetteCause({ cause }) {
  const code = cause === "AVARIE" ? "AVARIE" : "PERIME";
  return (
    <span className={"destr-cause destr-cause--" + code.toLowerCase()}>
      {LIBELLE_CAUSE[code]}
    </span>
  );
}

async function appeler(chemin, options) {
  const token = localStorage.getItem("SYGIMS_token");
  const res = await fetch(`${API_URL}${chemin}`, {
    ...(options || {}),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    throw new Error((data && data.erreur) || "Connexion instable, réessayez.");
  }
  return data;
}

export default function Destructions({ session, onRetour }) {
  const role = session && session.utilisateur ? session.utilisateur.role : null;
  const estValidateur = ROLES_VALIDATION.includes(role);

  const [onglet, setOnglet] = useState(estValidateur ? "a-valider" : "a-detruire");
  const [aValider, setAValider] = useState([]);
  const [demandes, setDemandes] = useState([]);
  const [mesLots, setMesLots] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [message, setMessage] = useState(null);
  const [quantites, setQuantites] = useState({});
  const [commentaires, setCommentaires] = useState({});
  const [enCours, setEnCours] = useState({});

  const [lotAvarie, setLotAvarie] = useState("");
  const [quantiteAvarie, setQuantiteAvarie] = useState("");
  const [natureAvarie, setNatureAvarie] = useState("");
  const [envoiAvarie, setEnvoiAvarie] = useState(false);

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const [liste, toutes, lots] = await Promise.all([
        estValidateur ? appeler("/stocks/lots/destructions/a-valider") : Promise.resolve([]),
        appeler("/stocks/lots/destructions/mes-demandes"),
        estValidateur ? Promise.resolve([]) : appeler("/stocks/lots/destructions/mes-lots"),
      ]);
      setAValider(Array.isArray(liste) ? liste : []);
      setDemandes(Array.isArray(toutes) ? toutes : []);
      setMesLots(Array.isArray(lots) ? lots : []);
    } catch (err) {
      setErreur(err.message || "Connexion instable, réessayez.");
    } finally {
      setChargement(false);
    }
  }, [estValidateur]);

  useEffect(() => {
    charger();
  }, [charger]);

  const aDetruire = estValidateur ? [] : demandes.filter((d) => d.statut === "AUTORISEE");
  const lotSelectionne = mesLots.find((l) => l.id === lotAvarie) || null;

  async function decider(d, approuve) {
    setErreur(null);
    setMessage(null);
    const commentaire = (commentaires[d.id] || "").trim();

    if (!approuve && !commentaire) {
      setErreur("Indiquez le motif du rejet pour " + d.produit + ".");
      return;
    }
    if (approuve) {
      const confirme = window.confirm(
        "Autoriser la destruction de " + d.quantiteDemandee + " unité(s) de " + d.produit +
          " (lot " + d.numeroLot + ", " + d.etablissement + ") ?\n\n" +
          "Le stock ne sera pas modifié : le demandeur sera notifié, détruira les produits, puis confirmera la destruction."
      );
      if (!confirme) return;
    }

    setEnCours((e) => ({ ...e, [d.id]: true }));
    try {
      const data = await appeler("/stocks/lots/destructions/" + d.id + "/valider", {
        method: "POST",
        body: JSON.stringify({
          approuve,
          commentaireValidation: commentaire || undefined,
        }),
      });
      setMessage((data && data.message) || "Décision enregistrée.");
      await charger();
    } catch (err) {
      setErreur(err.message || "Connexion instable, réessayez.");
    } finally {
      setEnCours((e) => ({ ...e, [d.id]: false }));
    }
  }

  async function confirmer(d) {
    setErreur(null);
    setMessage(null);
    const saisie = quantites[d.id];
    const quantiteDetruite = saisie === undefined || saisie === "" ? d.quantiteDemandee : Number(saisie);
    if (!Number.isInteger(quantiteDetruite) || quantiteDetruite <= 0) {
      setErreur("Quantité détruite invalide pour " + d.produit + ".");
      return;
    }
    const confirme = window.confirm(
      "Confirmer que " + quantiteDetruite + " unité(s) de " + d.produit +
        " (lot " + d.numeroLot + ") ont été détruites ?\n\n" +
        "Cette opération retire définitivement la quantité de votre stock."
    );
    if (!confirme) return;

    setEnCours((e) => ({ ...e, [d.id]: true }));
    try {
      const data = await appeler("/stocks/lots/destructions/" + d.id + "/confirmer", {
        method: "POST",
        body: JSON.stringify({
          quantiteDetruite,
          commentaire: (commentaires[d.id] || "").trim() || undefined,
        }),
      });
      setMessage((data && data.message) || "Destruction confirmée.");
      await charger();
    } catch (err) {
      setErreur(err.message || "Connexion instable, réessayez.");
    } finally {
      setEnCours((e) => ({ ...e, [d.id]: false }));
    }
  }

  async function declarerAvarie(evenement) {
    evenement.preventDefault();
    setErreur(null);
    setMessage(null);

    if (!lotSelectionne) {
      setErreur("Choisissez le lot concerné.");
      return;
    }
    const quantite = Number(quantiteAvarie);
    if (!Number.isInteger(quantite) || quantite <= 0 || quantite > lotSelectionne.quantite) {
      setErreur("Quantité invalide (maximum " + lotSelectionne.quantite + ").");
      return;
    }
    const nature = natureAvarie.trim();
    if (!nature) {
      setErreur("Indiquez la nature de l'avarie (obligatoire).");
      return;
    }
    const confirme = window.confirm(
      "Déclarer " + quantite + " unité(s) de " + lotSelectionne.produit +
        " (lot " + lotSelectionne.numeroLot + ") comme avariée(s) ?\n\n" +
        "Une demande est envoyée au Programme national. Le stock ne change pas tant que la destruction n'est pas confirmée."
    );
    if (!confirme) return;

    setEnvoiAvarie(true);
    try {
      const data = await appeler("/stocks/lots/" + lotSelectionne.id + "/destruction", {
        method: "POST",
        body: JSON.stringify({
          quantiteDemandee: quantite,
          motifDemande: nature,
          cause: "AVARIE",
        }),
      });
      setMessage((data && data.message) || "Demande envoyée.");
      setLotAvarie("");
      setQuantiteAvarie("");
      setNatureAvarie("");
      await charger();
      setOnglet("demandes");
    } catch (err) {
      setErreur(err.message || "Connexion instable, réessayez.");
    } finally {
      setEnvoiAvarie(false);
    }
  }

  return (
    <div className="destr-page">
      <header className="destr-header">
        <button className="destr-retour" onClick={onRetour}>← Retour</button>
        <h1>Destructions de produits périmés ou avariés</h1>
      </header>

      <p className="destr-intro">
        {estValidateur
          ? "Autorisez ou rejetez les demandes de destruction. Une autorisation ne modifie pas le stock : le demandeur est notifié, détruit les produits, puis confirme la destruction (c'est alors que le stock est retiré)."
          : "Les lots périmés se demandent depuis « Stock du réseau ». Un produit avarié se déclare ici. Une fois la destruction autorisée, détruisez les produits puis confirmez-la : le stock est alors mis à jour."}
      </p>

      <div className="destr-onglets">
        {estValidateur && (
          <button
            className={onglet === "a-valider" ? "destr-onglet-actif" : "destr-onglet"}
            onClick={() => setOnglet("a-valider")}
          >
            {"À valider (" + aValider.length + ")"}
          </button>
        )}
        {!estValidateur && (
          <button
            className={onglet === "a-detruire" ? "destr-onglet-actif" : "destr-onglet"}
            onClick={() => setOnglet("a-detruire")}
          >
            {"À détruire (" + aDetruire.length + ")"}
          </button>
        )}
        {!estValidateur && (
          <button
            className={onglet === "avarie" ? "destr-onglet-actif" : "destr-onglet"}
            onClick={() => setOnglet("avarie")}
          >
            Déclarer une avarie
          </button>
        )}
        <button
          className={onglet === "demandes" ? "destr-onglet-actif" : "destr-onglet"}
          onClick={() => setOnglet("demandes")}
        >
          {estValidateur ? "Toutes les demandes" : "Mes demandes"}
        </button>
        <button className="destr-onglet" onClick={charger} disabled={chargement}>
          {chargement ? "Chargement…" : "Actualiser"}
        </button>
      </div>

      {message && <p className="destr-message">{message}</p>}
      {erreur && <p className="destr-erreur">{erreur}</p>}

      {onglet === "a-valider" && estValidateur && (
        aValider.length === 0 ? (
          <p className="destr-vide">{chargement ? "Chargement…" : "Aucune demande en attente."}</p>
        ) : (
          <div className="destr-table-wrap">
            <table className="destr-table">
              <thead>
                <tr>
                  <th>Établissement</th>
                  <th>Produit</th>
                  <th>Lot</th>
                  <th>Cause</th>
                  <th>Péremption</th>
                  <th className="destr-num">Qté demandée</th>
                  <th>Motif</th>
                  <th>Demandeur</th>
                  <th>Date</th>
                  <th>Décision</th>
                </tr>
              </thead>
              <tbody>
                {aValider.map((d) => (
                  <tr key={d.id}>
                    <td>{d.etablissement}</td>
                    <td>{d.produit}</td>
                    <td>{d.numeroLot}</td>
                    <td><EtiquetteCause cause={d.cause} /></td>
                    <td>{formaterDate(d.datePeremption)}</td>
                    <td className="destr-num">{d.quantiteDemandee}</td>
                    <td>{d.motifDemande || "—"}</td>
                    <td>{d.demandeur}</td>
                    <td>{formaterDate(d.dateDemande)}</td>
                    <td>
                      <div className="destr-decision">
                        <input
                          type="text"
                          placeholder="Commentaire (obligatoire pour rejeter)"
                          value={commentaires[d.id] || ""}
                          onChange={(e) => setCommentaires((c) => ({ ...c, [d.id]: e.target.value }))}
                        />
                        <div className="destr-boutons">
                          <button
                            className="destr-valider"
                            disabled={!!enCours[d.id]}
                            onClick={() => decider(d, true)}
                          >
                            Autoriser
                          </button>
                          <button
                            className="destr-rejeter"
                            disabled={!!enCours[d.id]}
                            onClick={() => decider(d, false)}
                          >
                            Rejeter
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {onglet === "a-detruire" && !estValidateur && (
        aDetruire.length === 0 ? (
          <p className="destr-vide">{chargement ? "Chargement…" : "Aucune destruction autorisée en attente de confirmation."}</p>
        ) : (
          <div className="destr-table-wrap">
            <table className="destr-table">
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Lot</th>
                  <th>Cause</th>
                  <th>Péremption</th>
                  <th className="destr-num">Qté autorisée</th>
                  <th>Autorisation</th>
                  <th>Confirmation de la destruction</th>
                </tr>
              </thead>
              <tbody>
                {aDetruire.map((d) => (
                  <tr key={d.id}>
                    <td>{d.produit}</td>
                    <td>{d.numeroLot}</td>
                    <td><EtiquetteCause cause={d.cause} /></td>
                    <td>{formaterDate(d.datePeremption)}</td>
                    <td className="destr-num">{d.quantiteDemandee}</td>
                    <td>
                      {(d.validateur || "—") + " · " + formaterDate(d.dateValidation)}
                      {d.commentaireValidation && (
                        <>
                          <br />
                          <span className="destr-petit">{d.commentaireValidation}</span>
                        </>
                      )}
                    </td>
                    <td>
                      <div className="destr-decision">
                        <input
                          type="number"
                          min="1"
                          placeholder={"Qté détruite (" + d.quantiteDemandee + ")"}
                          value={quantites[d.id] === undefined ? "" : quantites[d.id]}
                          onChange={(e) => setQuantites((q) => ({ ...q, [d.id]: e.target.value }))}
                        />
                        <input
                          type="text"
                          placeholder="Commentaire (facultatif)"
                          value={commentaires[d.id] || ""}
                          onChange={(e) => setCommentaires((c) => ({ ...c, [d.id]: e.target.value }))}
                        />
                        <div className="destr-boutons">
                          <button
                            className="destr-valider"
                            disabled={!!enCours[d.id]}
                            onClick={() => confirmer(d)}
                          >
                            Confirmer la destruction
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {onglet === "avarie" && !estValidateur && (
        <form className="destr-form" onSubmit={declarerAvarie}>
          <p className="destr-petit">
            Pour un produit abîmé, cassé ou mal conservé dont la date de péremption n'est pas dépassée.
            La demande suit le même circuit : autorisation du Programme national, puis confirmation de la destruction.
          </p>

          <label htmlFor="destr-lot">Lot concerné</label>
          <select
            id="destr-lot"
            value={lotAvarie}
            onChange={(e) => setLotAvarie(e.target.value)}
          >
            <option value="">— Choisir un lot —</option>
            {mesLots.map((l) => (
              <option key={l.id} value={l.id}>
                {l.produit + " · lot " + l.numeroLot + " · péremption " + formaterDate(l.datePeremption) +
                  " · " + l.quantite + " en stock" + (l.perime ? " (périmé)" : "")}
              </option>
            ))}
          </select>
          {mesLots.length === 0 && (
            <span className="destr-petit">
              {chargement ? "Chargement…" : "Aucun lot disponible (stock vide ou demande déjà en cours)."}
            </span>
          )}

          <label htmlFor="destr-qte">
            {"Quantité avariée" + (lotSelectionne ? " (maximum " + lotSelectionne.quantite + ")" : "")}
          </label>
          <input
            id="destr-qte"
            type="number"
            min="1"
            value={quantiteAvarie}
            onChange={(e) => setQuantiteAvarie(e.target.value)}
          />

          <label htmlFor="destr-nature">Nature de l'avarie (obligatoire)</label>
          <input
            id="destr-nature"
            type="text"
            placeholder="Ex. : emballage mouillé, flacons cassés, chaîne du froid rompue"
            value={natureAvarie}
            onChange={(e) => setNatureAvarie(e.target.value)}
          />

          <button type="submit" className="destr-valider destr-envoyer" disabled={envoiAvarie}>
            {envoiAvarie ? "Envoi…" : "Envoyer la demande de destruction"}
          </button>
        </form>
      )}

      {onglet === "demandes" && (
        demandes.length === 0 ? (
          <p className="destr-vide">{chargement ? "Chargement…" : "Aucune demande de destruction."}</p>
        ) : (
          <div className="destr-table-wrap">
            <table className="destr-table">
              <thead>
                <tr>
                  <th>Date</th>
                  {estValidateur && <th>Établissement</th>}
                  <th>Produit</th>
                  <th>Lot</th>
                  <th>Cause</th>
                  <th className="destr-num">Qté demandée</th>
                  <th>Statut</th>
                  <th className="destr-num">Qté détruite</th>
                  <th>Réponse</th>
                </tr>
              </thead>
              <tbody>
                {demandes.map((d) => (
                  <tr key={d.id}>
                    <td>{formaterDate(d.dateDemande)}</td>
                    {estValidateur && <td>{d.etablissement}</td>}
                    <td>{d.produit}</td>
                    <td>{d.numeroLot}</td>
                    <td><EtiquetteCause cause={d.cause} /></td>
                    <td className="destr-num">{d.quantiteDemandee}</td>
                    <td>
                      <span className={"destr-statut destr-statut--" + String(d.statut).toLowerCase()}>
                        {LIBELLE_STATUT[d.statut] || d.statut}
                      </span>
                    </td>
                    <td className="destr-num">{d.quantiteDetruite === null || d.quantiteDetruite === undefined ? "—" : d.quantiteDetruite}</td>
                    <td>
                      {d.statut === "EN_ATTENTE" ? (
                        <span className="destr-petit">En attente de décision</span>
                      ) : (
                        <span>
                          {(d.validateur || "—") + " · " + formaterDate(d.dateValidation)}
                          {d.commentaireValidation && (
                            <>
                              <br />
                              <span className="destr-petit">{d.commentaireValidation}</span>
                            </>
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}