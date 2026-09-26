import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import "./InventairePhysique.css";
import BoutonsExport from "../components/BoutonsExport";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const LIBELLES_TYPE_BENEFICIAIRE = {
  PATIENT: "Patient",
  LABORATOIRE: "Laboratoire",
  MATERNITE: "Maternité",
  SERVICE: "Autre service",
};

const LIGNES_PAR_PAGE_RAPPORT = 15;

export default function InventairePhysique({ session, onRetour }) {
  const role = session?.utilisateur?.role;
  // Une formation sanitaire compte sa propre consommation patient (CMM).
  // Un GAS Moughataa ou GAS DRS, en comptant son PROPRE dépôt, doit voir son
  // propre rythme de distribution (DMM) — pas la consommation de ses
  // formations sanitaires, qui n'a aucun rapport avec les lots qu'il compte
  // physiquement sous les yeux.
  const utiliseDmm = ["GAS_MOUGHATAA", "MEDECIN_CHEF_MOUGHATAA", "GESTIONNAIRE_DRS", "DIRECTEUR_DRS", "GESTIONNAIRE_CAMEC", "ADMIN"].includes(role);
  const libelleColonneIndicateur = utiliseDmm ? "DMM" : "CMM";
  const estFormationSanitaire = role === "FORMATION_SANITAIRE";

  const [stocks, setStocks] = useState([]);
  const [cmm, setCmm] = useState([]);
  const [produitsListe, setProduitsListe] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(null);
  const [message, setMessage] = useState(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [comptages, setComptages] = useState({}); // { lotId: "12" }
  const [commentaire, setCommentaire] = useState("");
  const [historique, setHistorique] = useState([]);
  const [inventairesZone, setInventairesZone] = useState([]);
  const [chargementZone, setChargementZone] = useState(false);
  const [zoneChargee, setZoneChargee] = useState(false);

  // Onglet actif du panneau du bas : "historique" ou, selon le rôle,
  // "rapport" (formation sanitaire) ou "zone" (GAS Moughataa/DRS). Un seul
  // panneau visible à la fois plutôt que deux liens empilés qui s'ouvrent
  // indépendamment — plus lisible et plus logique.
  const [ongletBas, setOngletBas] = useState("historique");

  // Rapport de dispensation par période — uniquement pour une formation
  // sanitaire, qui n'a pas de "zone" d'établissements en dessous d'elle
  // (contrairement à un GAS Moughataa ou GAS DRS) : ce qui a du sens à sa
  // place, c'est plutôt la répartition de ses propres dispensations par
  // type de bénéficiaire, sur une période qu'elle choisit.
  const [dateDebutRapport, setDateDebutRapport] = useState("");
  const [dateFinRapport, setDateFinRapport] = useState("");
  const [rapportDispensation, setRapportDispensation] = useState(null);
  const [chargementRapport, setChargementRapport] = useState(false);
  const [erreurRapport, setErreurRapport] = useState(null);
  // Le détail ligne par ligne peut vite devenir très long (des centaines de
  // dispensations) : paginé, pour que l'écran reste lisible même avec
  // beaucoup de données.
  const [pageDetailRapport, setPageDetailRapport] = useState(0);

  // Lots physiquement trouvés mais encore inconnus du système (produit sans
  // stock théorique, ou tous les lots système tombés à zéro) — ajoutés comme
  // lignes supplémentaires dans le même tableau, avec une quantité
  // théorique de 0 puisqu'ils n'existent pas encore en base.
  const [nouveauxLots, setNouveauxLots] = useState([]); // [{ produitId, produitNom, numeroLot, datePeremption, quantitePhysique }]
  const [formNouveauLot, setFormNouveauLot] = useState({
    produitId: "",
    numeroLot: "",
    datePeremption: "",
    quantitePhysique: "",
  });

  async function chargerStocks() {
    setChargement(true);
    setErreur(null);
    try {
      const token = localStorage.getItem("gesmed_token");
      const [resStocks, resProduits, resIndicateur] = await Promise.all([
        fetch(`${API_URL}/stocks`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }),
        fetch(`${API_URL}/produits`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }),
        fetch(`${API_URL}/stocks/${utiliseDmm ? "dmm-propre" : "cmm"}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }),
      ]);
      const data = await resStocks.json();
      if (!resStocks.ok) throw new Error(data.erreur || "Impossible de charger le stock.");
      setStocks(data);
      if (resProduits.ok) setProduitsListe(await resProduits.json());
      if (resIndicateur.ok) setCmm(await resIndicateur.json());
    } catch (err) {
      setErreur(err.message || "Connexion instable, réessayez.");
    } finally {
      setChargement(false);
    }
  }

  async function chargerHistorique() {
    try {
      const token = localStorage.getItem("gesmed_token");
      const res = await fetch(`${API_URL}/inventaires`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json();
      if (res.ok) setHistorique(data);
    } catch {
      // L'historique n'est pas critique, on ignore silencieusement l'échec.
    }
  }

  // Vue consolidée en lecture seule de toute la zone (région ou Moughataa
  // selon le rôle) — chargée seulement au premier passage sur l'onglet, pas
  // au chargement initial de l'écran. Non proposée à une formation sanitaire
  // (voir rapportDispensation ci-dessous, qui la remplace pour ce rôle).
  async function chargerInventairesZone() {
    setChargementZone(true);
    try {
      const token = localStorage.getItem("gesmed_token");
      const res = await fetch(`${API_URL}/inventaires/zone`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json();
      if (res.ok) setInventairesZone(data);
      setZoneChargee(true);
    } catch {
      // Reste à l'état précédent si l'appel échoue.
    } finally {
      setChargementZone(false);
    }
  }

  function choisirOnglet(onglet) {
    setOngletBas(onglet);
    if (onglet === "zone" && !zoneChargee) chargerInventairesZone();
  }

  // Rapport de dispensation — appelable à tout moment pour rafraîchir avec
  // les dates actuellement saisies (vide = pas de borne sur ce côté).
  async function chargerRapportDispensation() {
    setChargementRapport(true);
    setErreurRapport(null);
    try {
      const token = localStorage.getItem("gesmed_token");
      const params = new URLSearchParams();
      if (dateDebutRapport) params.set("dateDebut", dateDebutRapport);
      if (dateFinRapport) params.set("dateFin", dateFinRapport);
      const res = await fetch(`${API_URL}/stocks/dispensation/rapport?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erreur || "Impossible de charger le rapport de dispensation.");
      setRapportDispensation(data);
      setPageDetailRapport(0);
    } catch (err) {
      setErreurRapport(err.message || "Connexion instable, réessayez.");
    } finally {
      setChargementRapport(false);
    }
  }

  // useLayoutEffect (et non useEffect) : s'exécute avant que le navigateur
  // affiche la page, donc sans flash visible. Avec un useEffect classique, le
  // navigateur affichait d'abord un instant la page à l'ancienne position de
  // défilement héritée de l'écran précédent (le panneau "Historique des
  // inventaires", en bas) avant de remonter en haut — d'où l'impression de
  // voir l'historique "en premier".
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    chargerStocks();
    chargerHistorique();
    if (estFormationSanitaire) chargerRapportDispensation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function majComptage(lotId, valeur) {
    setComptages((c) => ({ ...c, [lotId]: valeur }));
  }

  // Nom de l'établissement pour l'en-tête du document exporté — disponible
  // pour tous les rôles via session.utilisateur.etablissement (même champ
  // utilisé dans le Dashboard). Fallback sur le rapport de dispensation au
  // cas où, pour une formation sanitaire, ce champ ne serait pas présent.
  const nomEtablissement = session?.utilisateur?.etablissement || rapportDispensation?.etablissement || null;

  // Indicateur par produitId (CMM ou DMM selon le rôle) — regroupé par ID et
  // non par nom, exactement comme côté backend : deux produits différents du
  // catalogue peuvent porter le même nom, et les confondre ferait afficher le
  // CMM/DMM de l'un sur les lots de l'autre.
  const dmmParProduit = useMemo(() => {
    const map = {};
    for (const c of cmm) map[c.produitId] = utiliseDmm ? c.dmm : c.cmm;
    return map;
  }, [cmm, utiliseDmm]);

  // Une seule ligne par lot, tous produits confondus — c'est la vue demandée :
  // Produit / N° de lot / DMM / Quantité théorique / Quantité physique / Écart.
  const lignesLots = useMemo(() => {
    const lignes = [];
    for (const stock of stocks) {
      const lots = stock.lots && stock.lots.length > 0 ? stock.lots : [];
      for (const lot of lots) {
        lignes.push({
          cle: lot.id,
          lotId: lot.id,
          produit: stock.produit,
          numeroLot: lot.numeroLot,
          datePeremption: lot.datePeremption,
          dmm: dmmParProduit[stock.produitId] ?? 0,
          quantiteTheorique: lot.quantite,
          estNouveau: false,
        });
      }
    }
    nouveauxLots.forEach((nl, i) => {
      lignes.push({
        cle: `nouveau-${i}`,
        index: i,
        produit: nl.produitNom,
        numeroLot: nl.numeroLot,
        datePeremption: nl.datePeremption,
        dmm: dmmParProduit[nl.produitId] ?? 0,
        quantiteTheorique: 0,
        estNouveau: true,
        quantitePhysique: nl.quantitePhysique,
      });
    });
    return lignes;
  }, [stocks, nouveauxLots, dmmParProduit]);

  // Produits ayant une ligne de stock théorique mais aucun lot actif — sans
  // cette liste, ils disparaissent purement et simplement du tableau de
  // comptage (rien à afficher), ce qui donne l'impression trompeuse qu'ils
  // n'existent pas du tout dans le système.
  const produitsSansLotActif = useMemo(() => {
    return stocks.filter((s) => !s.lots || s.lots.length === 0).map((s) => s.produit);
  }, [stocks]);

  // Page courante du détail des dispensations — recalculée seulement quand
  // le rapport ou la page change, pas à chaque rendu. Le détail ligne par
  // ligne est désormais tout le rapport (plus de résumé par type/produit ni
  // de chips), donc il est affiché directement, sans bouton pour le
  // masquer/afficher.
  const totalPagesDetailRapport = rapportDispensation
    ? Math.max(1, Math.ceil(rapportDispensation.lignes.length / LIGNES_PAR_PAGE_RAPPORT))
    : 1;

  const lignesDetailRapportPage = useMemo(() => {
    if (!rapportDispensation) return [];
    const debut = pageDetailRapport * LIGNES_PAR_PAGE_RAPPORT;
    return rapportDispensation.lignes.slice(debut, debut + LIGNES_PAR_PAGE_RAPPORT);
  }, [rapportDispensation, pageDetailRapport]);

  function ajouterNouveauLot() {
    const { produitId, numeroLot, datePeremption, quantitePhysique } = formNouveauLot;
    if (!produitId || !numeroLot.trim() || !datePeremption || quantitePhysique === "") return;
    if (Number(quantitePhysique) < 0) return;

    const produit = produitsListe.find((p) => p.id === produitId);
    setNouveauxLots((prev) => [
      ...prev,
      {
        produitId,
        produitNom: produit?.nom || "",
        numeroLot: numeroLot.trim(),
        datePeremption,
        quantitePhysique: Number(quantitePhysique),
      },
    ]);
    setFormNouveauLot({ produitId: "", numeroLot: "", datePeremption: "", quantitePhysique: "" });
  }

  // Le bouton "Ajouter ce lot" reste désactivé tant que les quatre champs ne
  // sont pas remplis correctement — plus besoin d'un message d'erreur qui
  // encombre la page, le bouton grisé suffit à guider l'utilisateur.
  const nouveauLotValide =
    formNouveauLot.produitId &&
    formNouveauLot.numeroLot.trim() &&
    formNouveauLot.datePeremption &&
    formNouveauLot.quantitePhysique !== "" &&
    Number(formNouveauLot.quantitePhysique) >= 0;

  function retirerNouveauLot(index) {
    setNouveauxLots((prev) => prev.filter((_, i) => i !== index));
  }

  async function soumettre(ev) {
    ev.preventDefault();
    setErreur(null);
    setMessage(null);

    const lignesLotsExistants = Object.entries(comptages)
      .filter(([, valeur]) => valeur !== "" && valeur !== null && valeur !== undefined)
      .map(([lotId, valeur]) => ({ lotId, quantitePhysique: Number(valeur) }));

    const lignesNouveauxLots = nouveauxLots.map((l) => ({
      produitId: l.produitId,
      numeroLot: l.numeroLot,
      datePeremption: l.datePeremption,
      quantitePhysique: l.quantitePhysique,
    }));

    const lignes = [...lignesLotsExistants, ...lignesNouveauxLots];

    if (lignes.length === 0) {
      setErreur("Compte au moins un lot avant d'enregistrer.");
      return;
    }
    if (lignes.some((l) => l.quantitePhysique < 0)) {
      setErreur("Les quantités comptées ne peuvent pas être négatives.");
      return;
    }

    setEnvoiEnCours(true);
    try {
      const token = localStorage.getItem("gesmed_token");
      const res = await fetch(`${API_URL}/inventaires`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          type: "PONCTUEL",
          commentaire: commentaire || undefined,
          lignes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erreur || "L'enregistrement de l'inventaire a échoué.");

      const nbEcarts = data.inventaire.lignes.filter((l) => l.ecart !== 0).length;
      setMessage(
        nbEcarts > 0
          ? `Inventaire enregistré — ${nbEcarts} écart(s) détecté(s), à consulter dans les rapports.`
          : "Inventaire enregistré — aucun écart détecté."
      );
      setComptages({});
      setCommentaire("");
      setNouveauxLots([]);
      chargerStocks();
      chargerHistorique();
    } catch (err) {
      setErreur(err.message || "Connexion instable, réessayez.");
    } finally {
      setEnvoiEnCours(false);
    }
  }

  const libelleOngletSecondaire = estFormationSanitaire ? "Rapport de dispensation" : "Situation de la zone";

  return (
    <div className="inventaire-page">
      <header className="inventaire-header">
        <button className="inventaire-retour" onClick={onRetour}>← Retour</button>
        <div>
          <h1>Inventaire physique</h1>
          <p className="inventaire-sous-titre">
            Compare le stock réel compté à ce que le système calcule, pour détecter les écarts.
            Aucun blocage : les écarts sont seulement enregistrés pour les rapports.
          </p>
        </div>
      </header>

      {erreur && <p className="inventaire-erreur" role="alert">{erreur}</p>}
      {message && <p className="inventaire-message">{message}</p>}

      {chargement ? (
        <p>Chargement du stock...</p>
      ) : (
        <>
        <form onSubmit={soumettre}>
          <div id="inventaire-comptage" className="zone-imprimable inventaire-groupe-comptage">
            <section className="inventaire-carte">
              <div className="inventaire-rapport-entete">
                <h3>Comptage du stock physique</h3>
                {nomEtablissement && (
                  <p><strong>{nomEtablissement}</strong></p>
                )}
                <p className="inventaire-rapport-entete-genere">
                  Généré le {new Date().toLocaleDateString("fr-FR")}
                </p>
              </div>

              <h2>Comptage du stock</h2>
              {lignesLots.length === 0 ? (
                <p className="inventaire-vide">
                  Aucun lot actif à compter pour l'instant — utilise la section "Déclarer un nouveau lot" ci-dessous
                  si un produit existe physiquement malgré tout.
                </p>
              ) : (
                <div className="inventaire-table-scroll">
                  <table className="inventaire-table">
                    <thead>
                      <tr>
                        <th>Produit</th>
                        <th>N° de lot</th>
                        <th>{libelleColonneIndicateur}</th>
                        <th>Qté théorique</th>
                        <th>Qté physique</th>
                        <th>Écart</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lignesLots.map((l) => {
                        const saisie = l.estNouveau ? l.quantitePhysique : comptages[l.lotId] ?? "";
                        const ecart = saisie === "" || saisie === undefined ? null : Number(saisie) - l.quantiteTheorique;
                        return (
                          <tr key={l.cle}>
                            <td>{l.produit}</td>
                            <td>{l.numeroLot}{l.estNouveau ? " (nouveau)" : ""}</td>
                            <td>{l.dmm}</td>
                            <td>{l.quantiteTheorique}</td>
                            <td>
                              {l.estNouveau ? (
                                l.quantitePhysique
                              ) : (
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="—"
                                  name={`quantite-comptee-${l.lotId}`}
                                  autoComplete="off"
                                  value={comptages[l.lotId] ?? ""}
                                  onChange={(e) => majComptage(l.lotId, e.target.value)}
                                />
                              )}
                            </td>
                            <td className={ecart === null ? "" : ecart === 0 ? "inventaire-ecart-nul" : ecart < 0 ? "inventaire-ecart-perte" : "inventaire-ecart-surplus"}>
                              {ecart === null ? "—" : ecart > 0 ? `+${ecart}` : ecart}
                            </td>
                            <td className="no-print">
                              {l.estNouveau && (
                                <button type="button" className="inventaire-lien-retirer" onClick={() => retirerNouveauLot(l.index)}>
                                  Retirer
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* -------------------------------------------------------------
                Déclarer un nouveau lot : section entièrement exclue de
                l'impression/export (no-print sur la section elle-même) —
                c'est un formulaire de saisie, il n'a rien à faire sur un
                document imprimé ou exporté.
            --------------------------------------------------------------- */}
            <section className="inventaire-carte no-print">
              <h2>Déclarer un nouveau lot</h2>
              <p className="inventaire-sous-titre-carte">
                Un produit ou un lot existe physiquement mais n'apparaît pas dans le tableau de comptage ci-dessus ?
                Remplis ces champs puis clique sur "Ajouter ce lot" — il sera inclus automatiquement avec le reste
                quand tu enregistreras l'inventaire.
              </p>

              {produitsSansLotActif.length > 0 && (
                <p className="inventaire-sans-lot">
                  Produits actuellement sans lot actif dans le système : {produitsSansLotActif.join(", ")}.
                </p>
              )}
              <div className="inventaire-grille-nouveau-lot">
                <select
                  value={formNouveauLot.produitId}
                  onChange={(e) => setFormNouveauLot((f) => ({ ...f, produitId: e.target.value }))}
                >
                  <option value="">Choisir un produit…</option>
                  {produitsListe.map((p) => (
                    <option key={p.id} value={p.id}>{p.nom}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="N° de lot"
                  value={formNouveauLot.numeroLot}
                  onChange={(e) => setFormNouveauLot((f) => ({ ...f, numeroLot: e.target.value }))}
                />
                <input
                  type="date"
                  value={formNouveauLot.datePeremption}
                  onChange={(e) => setFormNouveauLot((f) => ({ ...f, datePeremption: e.target.value }))}
                />
                <input
                  type="number"
                  min="0"
                  placeholder="Quantité comptée"
                  value={formNouveauLot.quantitePhysique}
                  onChange={(e) => setFormNouveauLot((f) => ({ ...f, quantitePhysique: e.target.value }))}
                />
                <button
                  type="button"
                  className="inventaire-bouton-secondaire"
                  onClick={ajouterNouveauLot}
                  disabled={!nouveauLotValide}
                >
                  Ajouter ce lot
                </button>
              </div>

              {nouveauxLots.length > 0 && (
                <div className="inventaire-lots-ajoutes">
                  <p className="inventaire-lots-ajoutes-titre">
                    Lot(s) ajouté(s), inclus dans le comptage ci-dessus :
                  </p>
                  {nouveauxLots.map((nl, i) => (
                    <div className="inventaire-lot-ajoute" key={i}>
                      <span>{nl.produitNom} — {nl.numeroLot} — {nl.quantitePhysique} unité(s)</span>
                      <button type="button" className="inventaire-lien-retirer" onClick={() => retirerNouveauLot(i)}>
                        Retirer
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="inventaire-carte">
              <div className="inventaire-champ">
                <label>Note (optionnel)</label>
                <textarea
                  value={commentaire}
                  onChange={(e) => setCommentaire(e.target.value)}
                  placeholder="Contexte du comptage, remarques..."
                  rows={3}
                />
              </div>

              <div className="inventaire-actions no-print">
                <button type="submit" className="inventaire-bouton" disabled={envoiEnCours}>
                  {envoiEnCours ? "..." : "Enregistrer l'inventaire"}
                </button>
              </div>
            </section>
          </div>

          <BoutonsExport cibleId="inventaire-comptage" nomFichier="inventaire-comptage" />
        </form>

        {/* -------------------------------------------------------------
            Panneau du bas : un seul onglet actif à la fois, plutôt que
            deux liens qui s'ouvrent indépendamment l'un sous l'autre.
            Placé dans le même bloc que le formulaire (donc affiché
            seulement une fois "Comptage du stock" chargé) pour que les
            titres des onglets n'apparaissent pas avant le reste de la page.
        --------------------------------------------------------------- */}
        <section className="inventaire-carte inventaire-panneau-bas">
        <div className="inventaire-onglets" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={ongletBas === "historique"}
            className={`inventaire-onglet ${ongletBas === "historique" ? "inventaire-onglet-actif" : ""}`}
            onClick={() => choisirOnglet("historique")}
          >
            Historique des inventaires
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={ongletBas === (estFormationSanitaire ? "rapport" : "zone")}
            className={`inventaire-onglet ${ongletBas === (estFormationSanitaire ? "rapport" : "zone") ? "inventaire-onglet-actif" : ""}`}
            onClick={() => choisirOnglet(estFormationSanitaire ? "rapport" : "zone")}
          >
            {libelleOngletSecondaire}
          </button>
        </div>

        {ongletBas === "historique" && (
          <div className="inventaire-panneau-contenu">
            {historique.length === 0 ? (
              <p className="inventaire-vide">Aucun inventaire réalisé pour l'instant.</p>
            ) : (
              historique.map((inv) => (
                <div className="inventaire-historique-carte" key={inv.id}>
                  <div className="inventaire-historique-entete">
                    <strong>{new Date(inv.dateInventaire).toLocaleDateString("fr-FR")}</strong>
                    <span>{inv.effectuePar?.nomComplet}</span>
                  </div>
                  {inv.commentaire && <p className="inventaire-historique-note">{inv.commentaire}</p>}
                  <ul>
                    {inv.lignes.map((l) => (
                      <li key={l.id}>
                        {l.lot.produit.nom} ({l.lot.numeroLot}) — système {l.quantiteSysteme}, compté{" "}
                        {l.quantitePhysique}{" "}
                        <span className={l.ecart === 0 ? "inventaire-ecart-nul" : l.ecart < 0 ? "inventaire-ecart-perte" : "inventaire-ecart-surplus"}>
                          ({l.ecart > 0 ? "+" : ""}{l.ecart})
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        )}

        {ongletBas === "rapport" && estFormationSanitaire && (
          <div className="inventaire-panneau-contenu">
            <p className="inventaire-sous-titre-carte">
              Répartition de tes dispensations par type de bénéficiaire, sur la période de ton choix.
            </p>

            <div className="inventaire-rapport-controles">
              <label className="inventaire-champ-inline">
                Du
                <input
                  type="date"
                  value={dateDebutRapport}
                  onChange={(e) => setDateDebutRapport(e.target.value)}
                />
              </label>
              <label className="inventaire-champ-inline">
                Au
                <input
                  type="date"
                  value={dateFinRapport}
                  onChange={(e) => setDateFinRapport(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="inventaire-bouton-secondaire"
                onClick={chargerRapportDispensation}
                disabled={chargementRapport}
              >
                {chargementRapport ? "..." : "Générer le rapport"}
              </button>
            </div>

            {erreurRapport && <p className="inventaire-erreur" role="alert">{erreurRapport}</p>}

            {rapportDispensation && (
              <>
                <div id="rapport-dispensation" className="zone-imprimable">
                  <div className="inventaire-rapport-entete">
                    <h3>Rapport de dispensation</h3>
                    <p>
                      <strong>{rapportDispensation.etablissement || "Formation sanitaire"}</strong>
                      {" — "}
                      {rapportDispensation.periode.dateDebut || rapportDispensation.periode.dateFin
                        ? `du ${rapportDispensation.periode.dateDebut || "—"} au ${rapportDispensation.periode.dateFin || "—"}`
                        : "tout l'historique"}
                    </p>
                    <p className="inventaire-rapport-entete-genere">
                      Généré le {new Date().toLocaleDateString("fr-FR")}
                    </p>
                  </div>

                  {rapportDispensation.totalDispensations === 0 ? (
                    <p className="inventaire-vide">Aucune dispensation sur cette période.</p>
                  ) : (
                    <div className="inventaire-rapport-detail">
                      <div className="inventaire-table-scroll inventaire-rapport-table-scroll">
                        <table className="inventaire-table inventaire-table-rapport">
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Produit</th>
                              <th>Quantité</th>
                              <th>Type</th>
                              <th>Bénéficiaire</th>
                            </tr>
                          </thead>
                          <tbody>
                            {lignesDetailRapportPage.map((l, index) => (
                              <tr key={l.id} className={index % 2 === 1 ? "inventaire-ligne-alternee" : undefined}>
                                <td>{new Date(l.date).toLocaleDateString("fr-FR")}</td>
                                <td>{l.produit}</td>
                                <td>{l.quantite}</td>
                                <td>{LIBELLES_TYPE_BENEFICIAIRE[l.typeBeneficiaire] || l.typeBeneficiaire}</td>
                                <td>{l.beneficiaire}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {totalPagesDetailRapport > 1 && (
                        <div className="inventaire-pagination no-print">
                          <button
                            type="button"
                            className="inventaire-bouton-secondaire"
                            onClick={() => setPageDetailRapport((p) => Math.max(0, p - 1))}
                            disabled={pageDetailRapport === 0}
                          >
                            ← Précédent
                          </button>
                          <span>Page {pageDetailRapport + 1} / {totalPagesDetailRapport}</span>
                          <button
                            type="button"
                            className="inventaire-bouton-secondaire"
                            onClick={() => setPageDetailRapport((p) => Math.min(totalPagesDetailRapport - 1, p + 1))}
                            disabled={pageDetailRapport >= totalPagesDetailRapport - 1}
                          >
                            Suivant →
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* En dehors de la zone capturée : les 3 boutons ne
                    doivent jamais apparaître dans le PDF/l'image/l'impression. */}
                <BoutonsExport cibleId="rapport-dispensation" nomFichier="rapport-dispensation" />
              </>
            )}
          </div>
        )}

        {ongletBas === "zone" && !estFormationSanitaire && (
          <div className="inventaire-panneau-contenu">
            {chargementZone ? (
              <p>Chargement...</p>
            ) : inventairesZone.length === 0 ? (
              <p className="inventaire-vide">Aucun inventaire réalisé pour l'instant dans la zone.</p>
            ) : (
              inventairesZone.map((inv) => (
                <div className="inventaire-historique-carte" key={inv.id}>
                  <div className="inventaire-historique-entete">
                    <strong>{inv.etablissement?.nom} — {new Date(inv.dateInventaire).toLocaleDateString("fr-FR")}</strong>
                    <span>{inv.effectuePar?.nomComplet}</span>
                  </div>
                  {inv.commentaire && <p className="inventaire-historique-note">{inv.commentaire}</p>}
                  <ul>
                    {inv.lignes.map((l) => (
                      <li key={l.id}>
                        {l.lot.produit.nom} ({l.lot.numeroLot}) — système {l.quantiteSysteme}, compté{" "}
                        {l.quantitePhysique}{" "}
                        <span className={l.ecart === 0 ? "inventaire-ecart-nul" : l.ecart < 0 ? "inventaire-ecart-perte" : "inventaire-ecart-surplus"}>
                          ({l.ecart > 0 ? "+" : ""}{l.ecart})
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        )}
        </section>
        </>
      )}
    </div>
  );
}