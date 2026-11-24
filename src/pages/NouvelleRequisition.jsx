import { useEffect, useMemo, useState } from "react";
import "./NouvelleRequisition.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

function ligneVide() {
  return { produitId: "", quantiteDemandee: "" };
}

export default function NouvelleRequisition({ onRetour }) {
  const [produits, setProduits] = useState([]);
  const [suggestions, setSuggestions] = useState({}); // { produitId: { cmm, stockDisponible, quantiteSuggeree } }
  const [lignes, setLignes] = useState([ligneVide()]);
  const [justification, setJustification] = useState("");
  const [chargementProduits, setChargementProduits] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [succes, setSucces] = useState(false);
  const [numeroCree, setNumeroCree] = useState(null);

  useEffect(() => {
    async function chargerDonnees() {
      try {
        const token = localStorage.getItem("SYGIMS_token");
        const [resProduits, resSuggestions] = await Promise.all([
          fetch(`${API_URL}/produits`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/stocks/commande-suggeree`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (!resProduits.ok) throw new Error("Impossible de charger le catalogue produits.");
        setProduits(await resProduits.json());

        // La quantité suggérée est un plus pour guider la commande — si
        // elle échoue, on continue sans bloquer la création de réquisition.
        if (resSuggestions.ok) {
          const donneesSuggestions = await resSuggestions.json();
          const parProduit = {};
          for (const s of donneesSuggestions) parProduit[s.produitId] = s;
          setSuggestions(parProduit);
        }
      } catch (err) {
        setErreur(err.message || "Connexion instable, réessayez.");
      } finally {
        setChargementProduits(false);
      }
    }
    chargerDonnees();
  }, []);

  function modifierLigne(index, champ, valeur) {
    setLignes((prev) =>
      prev.map((l, i) => {
        if (i !== index) return l;
        const miseAJour = { ...l, [champ]: valeur };
        // Quand on choisit un produit, on pré-remplit avec la quantité
        // suggérée (CMM × 1 mois − stock disponible), sans écraser une
        // quantité déjà saisie manuellement.
        if (champ === "produitId" && !l.quantiteDemandee) {
          const suggestion = suggestions[valeur];
          if (suggestion && suggestion.quantiteSuggeree > 0) {
            miseAJour.quantiteDemandee = String(suggestion.quantiteSuggeree);
          }
        }
        return miseAJour;
      })
    );
  }

  function ajouterLigne() {
    setLignes((prev) => [...prev, ligneVide()]);
  }

  function supprimerLigne(index) {
    setLignes((prev) => prev.filter((_, i) => i !== index));
  }

  // Une ligne est "non recommandée" quand on connaît la quantité suggérée
  // pour ce produit (CMM × 1 mois − stock disponible) et que la quantité
  // saisie s'en écarte — dans ce cas une justification devient obligatoire
  // plutôt que simplement proposée.
  function ligneEstNonRecommandee(ligne) {
    if (!ligne.produitId || ligne.quantiteDemandee === "") return false;
    const suggestion = suggestions[ligne.produitId];
    if (!suggestion) return false;
    return Number(ligne.quantiteDemandee) !== suggestion.quantiteSuggeree;
  }

  const aUneQuantiteNonRecommandee = lignes.some(ligneEstNonRecommandee);

  // ---- Choix rapide des produits : recherche par premieres lettres + cases a cocher ----
  const [recherche, setRecherche] = useState("");

  function normaliser(texte) {
    return String(texte || "")
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase();
  }

  const groupes = useMemo(() => {
    const mots = normaliser(recherche).split(/[^a-z0-9]+/).filter(Boolean);
    const affiches =
      mots.length === 0
        ? produits
        : produits.filter((p) => {
            const motsProduit = normaliser(p.nom).split(/[^a-z0-9]+/).filter(Boolean);
            return mots.every((m) => motsProduit.some((mp) => mp.startsWith(m)));
          });
    const parCategorie = new Map();
    for (const p of affiches) {
      const cle = p.categorie || "";
      if (!parCategorie.has(cle)) parCategorie.set(cle, []);
      parCategorie.get(cle).push(p);
    }
    return [...parCategorie.entries()];
  }, [produits, recherche]);

  const selectionnes = new Set(lignes.map((l) => l.produitId).filter(Boolean));
  const nbSelection = selectionnes.size;

  function lignePourProduit(produitId) {
    const suggestion = suggestions[produitId];
    return {
      produitId,
      quantiteDemandee: suggestion && suggestion.quantiteSuggeree > 0 ? String(suggestion.quantiteSuggeree) : "",
    };
  }

  function basculerProduit(produitId) {
    setLignes((prev) => {
      if (prev.some((l) => l.produitId === produitId)) {
        const reste = prev.filter((l) => l.produitId !== produitId);
        return reste.length > 0 ? reste : [ligneVide()];
      }
      const indexVide = prev.findIndex((l) => !l.produitId);
      const nouvelle = lignePourProduit(produitId);
      if (indexVide >= 0) {
        return prev.map((l, i) =>
          i === indexVide ? { ...nouvelle, quantiteDemandee: l.quantiteDemandee || nouvelle.quantiteDemandee } : l
        );
      }
      return [...prev, nouvelle];
    });
  }

  async function envoyerRequisition(e) {
    e.preventDefault();
    setErreur(null);

    const lignesValides = lignes.filter((l) => l.produitId && Number(l.quantiteDemandee) > 0);
    if (lignesValides.length === 0) {
      setErreur("Ajoute au moins un produit avec une quantité valide.");
      return;
    }

    if (aUneQuantiteNonRecommandee && !justification.trim()) {
      setErreur(
        "Une justification est obligatoire : au moins une quantité demandée diffère de la quantité suggérée."
      );
      return;
    }

    setEnvoi(true);
    try {
      const token = localStorage.getItem("SYGIMS_token");
      const res = await fetch(`${API_URL}/requisitions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          lignes: lignesValides.map((l) => ({
            produitId: l.produitId,
            quantiteDemandee: Number(l.quantiteDemandee),
          })),
          justification: justification || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erreur || "La réquisition n'a pas pu être créée.");
      setNumeroCree(data.numero);
      setSucces(true);
    } catch (err) {
      setErreur(err.message || "Connexion instable, réessayez.");
    } finally {
      setEnvoi(false);
    }
  }

  if (succes) {
    return (
      <div className="requisition-page">
        <div className="requisition-confirmation">
          <h1>Réquisition envoyée</h1>
          <p>
            {numeroCree ? `Réquisition N°${numeroCree} — elle` : "Elle"} a été transmise au SASSM pour validation.
          </p>
          <p className="requisition-suggestion">
            Note ce numéro pour la retrouver plus tard via « Rechercher un dossier ».
          </p>
          <button className="requisition-bouton" onClick={onRetour}>
            Retour au tableau de bord
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="requisition-page">
      <header className="requisition-header">
        <button className="requisition-retour" onClick={onRetour}>← Retour</button>
        <h1>Nouvelle réquisition</h1>
      </header>

      {chargementProduits && <p>Chargement du catalogue produits...</p>}

      {!chargementProduits && (
        <form className="requisition-form" onSubmit={envoyerRequisition}>
          <div className="requisition-choix">
            <div className="requisition-choix-entete">
              <input
                type="search"
                className="requisition-recherche"
                placeholder="Rechercher un produit (premi&egrave;res lettres)&hellip;"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                autoComplete="off"
              />
              <span className="requisition-choix-compteur">{nbSelection} s&eacute;lectionn&eacute;(s)</span>
            </div>
            <div className="requisition-choix-liste">
              {groupes.length === 0 && <p className="requisition-choix-vide">Aucun produit ne correspond.</p>}
              {groupes.map(([categorie, liste]) => (
                <div key={categorie || "sans-categorie"}>
                  {categorie && <p className="requisition-choix-categorie">{categorie}</p>}
                  {liste.map((p) => (
                    <label
                      className={"requisition-choix-ligne" + (selectionnes.has(p.id) ? " requisition-choix-ligne--coche" : "")}
                      key={p.id}
                    >
                      <input type="checkbox" checked={selectionnes.has(p.id)} onChange={() => basculerProduit(p.id)} />
                      <span>{p.nom}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>
          {nbSelection > 0 && <p className="requisition-suggestion">Produits de la commande :</p>}

          {lignes.map((ligne, index) => {
            const suggestion = suggestions[ligne.produitId];
            const nonRecommandee = ligneEstNonRecommandee(ligne);
            return (
              <div className="requisition-ligne-bloc" key={index}>
                <div className="requisition-ligne">
                  <select value={ligne.produitId} onChange={(e) => modifierLigne(index, "produitId", e.target.value)}>
                    <option value="">Choisir un produit…</option>
                    {produits.map((p) => (
                      <option key={p.id} value={p.id} disabled={lignes.some((autre, j) => j !== index && autre.produitId === p.id)}>{p.nom}</option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min="1"
                    placeholder="Quantité"
                    value={ligne.quantiteDemandee}
                    onChange={(e) => modifierLigne(index, "quantiteDemandee", e.target.value)}
                  />

                  {lignes.length > 1 && (
                    <button type="button" className="requisition-supprimer" onClick={() => supprimerLigne(index)} aria-label="Supprimer cette ligne">✕</button>
                  )}
                </div>

                {ligne.produitId && suggestion && (
                  <p className="requisition-suggestion">
                    Consommation moyenne mensuelle : {suggestion.cmm} — Stock disponible : {suggestion.stockDisponible} — Suggéré : {suggestion.quantiteSuggeree}
                  </p>
                )}

                {nonRecommandee && (
                  <p className="requisition-suggestion" style={{ color: "#b45309", fontWeight: 600 }}>
                    ⚠️ Quantité différente de la suggestion ({suggestion.quantiteSuggeree}) — une justification est obligatoire.
                  </p>
                )}
              </div>
            );
          })}

          <button type="button" className="requisition-ajouter" onClick={ajouterLigne}>+ Ajouter un produit</button>

          <label className="requisition-label">
            Justification {aUneQuantiteNonRecommandee ? "(obligatoire — quantité différente de la suggestion)" : "(optionnel)"}
            <textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              rows={3}
              required={aUneQuantiteNonRecommandee}
            />
          </label>

          {erreur && <p className="requisition-erreur" role="alert">{erreur}</p>}

          <button type="submit" className="requisition-bouton" disabled={envoi}>
            {envoi ? "Envoi…" : "Envoyer la réquisition"}
          </button>
        </form>
      )}
    </div>
  );
}