import { useEffect, useMemo, useState } from "react";
import "./EnregistrerDispensation.css";
import "./DispensationPanier.css";
import "./DispensationMobile.css";
import "./DispensationMontants.css";
import "./DispensationAnnulation.css";
import BoutonsExport from "../components/BoutonsExport";
import { useLangue, SelecteurLangue } from "../i18n.jsx";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

// "label" : texte affiché dans la liste déroulante "Destiné à".
// "labelChamp" : texte affiché au-dessus du champ de saisie qui apparaît
// une fois le type choisi — volontairement différent du libellé de la liste
// pour demander précisément la bonne information selon le type (le
// responsable du labo, pas le nom du labo lui-même ; le service précis pour
// "Autre service", etc.). "Responsable labo/maternité" plutôt que
// "laborantin(e)" ou "responsable" seul, pour rester neutre côté genre.
const TYPES_BENEFICIAIRE = [
  { valeur: "PATIENT", label: "Patient", labelChamp: "Patient", placeholder: "Nom, téléphone ou code patient" },
  { valeur: "LABORATOIRE", label: "Laboratoire", labelChamp: "Responsable labo", placeholder: "Nom du responsable labo" },
  { valeur: "MATERNITE", label: "Maternité", labelChamp: "Responsable maternité", placeholder: "Nom du/de la responsable" },
  { valeur: "SERVICE", label: "Autre service", labelChamp: "Service", placeholder: "Nom du service" },
];

const LIBELLES_TYPE_BENEFICIAIRE = Object.fromEntries(TYPES_BENEFICIAIRE.map((t) => [t.valeur, t.label]));

const LIGNES_PAR_PAGE_RAPPORT = 15;

// Regroupement des categories de produits en programmes (filtre de la liste).
const PROGRAMMES = [
  { cle: "VIH", label: "VIH" },
  { cle: "HEP", label: "H\u00e9patites" },
  { cle: "TB", label: "Tuberculose" },
  { cle: "PALU", label: "Paludisme" },
  { cle: "IO", label: "Infections opportunistes" },
  { cle: "AUTRES", label: "Autres produits" },
];

function programmeDe(categorie) {
  const c = String(categorie || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (c.startsWith("arv") || c.startsWith("tests rapides")) return "VIH";
  if (c.startsWith("hepatites")) return "HEP";
  if (c.startsWith("tb") || c.startsWith("cartouches")) return "TB";
  if (c.startsWith("paludisme")) return "PALU";
  if (c.startsWith("io -") || c.startsWith("io ")) return "IO";
  return "AUTRES";
}

export default function EnregistrerDispensation({ session, onRetour }) {
  const { t: tr, dir } = useLangue();
  const [produits, setProduits] = useState([]);
  const [produitId, setProduitId] = useState("");
  const [quantite, setQuantite] = useState("");
  const [typeBeneficiaire, setTypeBeneficiaire] = useState("");
  const [beneficiaire, setBeneficiaire] = useState("");
  const [chargementProduits, setChargementProduits] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [succes, setSucces] = useState(false);
  const [panier, setPanier] = useState([]); // lignes { produitId, quantite }
  const [apercu, setApercu] = useState(null);
  const [recherche, setRecherche] = useState("");
  const [categorieFiltre, setCategorieFiltre] = useState("");
  const [programmeFiltre, setProgrammeFiltre] = useState("");
  const [demandesAnnulation, setDemandesAnnulation] = useState([]);
  const [annulationEnCours, setAnnulationEnCours] = useState(null);
  const [motifAnnulation, setMotifAnnulation] = useState("");
  const [envoiAnnulation, setEnvoiAnnulation] = useState(false);
  const [erreurAnnulation, setErreurAnnulation] = useState(null);
  const [messageAnnulation, setMessageAnnulation] = useState(null);

  // Dernière dispensation enregistrée — sert à générer l'ordonnance/le
  // bordereau juste après l'enregistrement, avec le nom du produit (le
  // serveur ne renvoie que des ids) retrouvé dans le catalogue déjà chargé.
  const [derniereDispensation, setDerniereDispensation] = useState(null);

  // Rapport de dispensation par période — anciennement affiché dans la page
  // Inventaire physique, déplacé ici : une formation sanitaire n'a pas de
  // "zone" d'établissements sous elle, ce qui a du sens à sa place c'est la
  // répartition de SES dispensations, exactement ce que fait cette page.
  const [dateDebutRapport, setDateDebutRapport] = useState("");
  const [dateFinRapport, setDateFinRapport] = useState("");
  const [rapportDispensation, setRapportDispensation] = useState(null);
  const [chargementRapport, setChargementRapport] = useState(false);
  const [erreurRapport, setErreurRapport] = useState(null);
  // Le détail ligne par ligne peut vite devenir très long : paginé, pour que
  // l'écran reste lisible même avec beaucoup de dispensations.
  const [pageDetailRapport, setPageDetailRapport] = useState(0);

  const nomEtablissement = session?.utilisateur?.etablissement || rapportDispensation?.etablissement || null;
  const nomAgent = session?.utilisateur?.nomComplet || null;

  useEffect(() => {
    async function chargerProduits() {
      try {
        const token = localStorage.getItem("SYGIMS_token");
        const res = await fetch(`${API_URL}/produits`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error("Impossible de charger le catalogue produits.");
        setProduits(await res.json());
      } catch (err) {
        setErreur(tr(err.message || "Connexion instable, réessayez."));
      } finally {
        setChargementProduits(false);
      }
    }
    chargerProduits();
    chargerDemandesAnnulation();
    chargerRapportDispensation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function chargerRapportDispensation() {
    setChargementRapport(true);
    setErreurRapport(null);
    try {
      const token = localStorage.getItem("SYGIMS_token");
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
      chargerDemandesAnnulation();
      setPageDetailRapport(0);
    } catch (err) {
      setErreurRapport(tr(err.message || "Connexion instable, réessayez."));
    } finally {
      setChargementRapport(false);
    }
  }

  const typeChoisi = TYPES_BENEFICIAIRE.find((t) => t.valeur === typeBeneficiaire);

  function normaliser(texte) {
    return String(texte || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  const categories = useMemo(
    () => Array.from(new Set(produits.map((p) => p.categorie).filter(Boolean))).sort(),
    [produits]
  );

  const programmesDispo = useMemo(
    () => PROGRAMMES.filter((g) => categories.some((c) => programmeDe(c) === g.cle)),
    [categories]
  );

  const categoriesProgramme = useMemo(
    () => (programmeFiltre ? categories.filter((c) => programmeDe(c) === programmeFiltre) : []),
    [categories, programmeFiltre]
  );

  const produitsFiltres = useMemo(() => {
    const t = normaliser(recherche.trim());
    return produits.filter(
      (p) =>
        (!programmeFiltre || programmeDe(p.categorie) === programmeFiltre) &&
        (!categorieFiltre || p.categorie === categorieFiltre) &&
        (!t || normaliser(p.nom).includes(t))
    );
  }, [produits, recherche, programmeFiltre, categorieFiltre]);

  function nomProduit(id) {
    const p = produits.find((x) => x.id === id);
    return p ? p.nom : "";
  }

  function ajouterAuPanier(id) {
    setPanier((actuel) => {
      const existe = actuel.find((l) => l.produitId === id);
      if (existe) {
        return actuel.map((l) => (l.produitId === id ? { ...l, quantite: String(Number(l.quantite || 0) + 1) } : l));
      }
      return [...actuel, { produitId: id, quantite: "1" }];
    });
    setErreur(null);
  }

  function changerQuantite(id, valeur) {
    setPanier((actuel) => actuel.map((l) => (l.produitId === id ? { ...l, quantite: valeur } : l)));
  }

  function retirerDuPanier(id) {
    setPanier((actuel) => actuel.filter((l) => l.produitId !== id));
  }

  async function envoyerDispensation(e) {
    e.preventDefault();
    setErreur(null);

    if (panier.length === 0) {
      setErreur(tr("Ajoute au moins un produit au panier."));
      return;
    }
    if (panier.some((l) => !(Number(l.quantite) > 0))) {
      setErreur(tr("Chaque produit du panier doit avoir une quantité valide."));
      return;
    }
    if (!typeBeneficiaire) {
      setErreur(tr("Précise à qui cette dispensation est destinée."));
      return;
    }
    if (!beneficiaire.trim()) {
      setErreur(tr("Précise le nom, le téléphone ou le code du bénéficiaire."));
      return;
    }

    setEnvoi(true);
    try {
      const token = localStorage.getItem("SYGIMS_token");
      const res = await fetch(API_URL + "/stocks/dispensation/panier", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({
          lignes: panier.map((l) => ({ produitId: l.produitId, quantite: Number(l.quantite) })),
          typeBeneficiaire,
          beneficiaire: beneficiaire.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erreur || "La dispensation n'a pas pu être enregistrée.");

      const creees = data.dispensations || [];
      const numeros = creees.map((d) => d.numero).filter((n) => n !== null && n !== undefined);
      let numero;
      if (numeros.length === 1) numero = String(numeros[0]);
      else if (numeros.length > 1) numero = numeros[0] + "-" + numeros[numeros.length - 1];

      setDerniereDispensation({
        numero,
        dateDispensation: creees[0] ? creees[0].dateDispensation : null,
        lignes: creees.map((d) => ({
          produitNom: d.nomProduit || nomProduit(d.produitId),
          quantite: d.quantite,
          prixUnitaire: d.prixUnitaire === null || d.prixUnitaire === undefined ? null : Number(d.prixUnitaire),
          montantTotal: d.montantTotal === null || d.montantTotal === undefined ? null : Number(d.montantTotal),
        })),
        typeBeneficiaire,
        beneficiaire: beneficiaire.trim(),
      });
      setSucces(true);
      chargerRapportDispensation();
    } catch (err) {
      setErreur(tr(err.message || "Connexion instable, réessayez."));
    } finally {
      setEnvoi(false);
    }
  }

  async function chargerDemandesAnnulation() {
    try {
      const token = localStorage.getItem("SYGIMS_token");
      const res = await fetch(API_URL + "/stocks/dispensation/demandes-annulation", {
        headers: { Authorization: "Bearer " + token },
        cache: "no-store",
      });
      if (!res.ok) return;
      setDemandesAnnulation(await res.json());
    } catch (err) {
      // Silencieux : l'etat des demandes est un complement, il ne doit pas bloquer l'ecran.
    }
  }

  // Derniere demande connue pour chaque dispensation (la liste arrive de la plus recente a la plus ancienne).
  const demandeParDispensation = useMemo(() => {
    const m = {};
    for (const d of demandesAnnulation) {
      if (!m[d.dispensationId]) m[d.dispensationId] = d;
    }
    return m;
  }, [demandesAnnulation]);

  function ouvrirAnnulation(ligne) {
    setAnnulationEnCours(ligne);
    setMotifAnnulation("");
    setErreurAnnulation(null);
    setMessageAnnulation(null);
  }

  async function envoyerDemandeAnnulation() {
    if (!annulationEnCours) return;
    if (motifAnnulation.trim().length < 5) {
      setErreurAnnulation(tr("Le motif est obligatoire (5 caractères minimum)."));
      return;
    }
    setEnvoiAnnulation(true);
    setErreurAnnulation(null);
    try {
      const token = localStorage.getItem("SYGIMS_token");
      const res = await fetch(API_URL + "/stocks/dispensation/" + annulationEnCours.id + "/demande-annulation", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ motif: motifAnnulation.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erreur || "La demande n'a pas pu être envoyée.");
      setAnnulationEnCours(null);
      setMessageAnnulation(tr(data.message || "Demande d'annulation envoyée."));
      chargerDemandesAnnulation();
    } catch (err) {
      setErreurAnnulation(tr(err.message || "Connexion instable, réessayez."));
    } finally {
      setEnvoiAnnulation(false);
    }
  }

  function formaterMontant(valeur) {
    const nombre = valeur === null || valeur === undefined ? 0 : Number(valeur);
    return nombre.toLocaleString("fr-FR", { maximumFractionDigits: 2 }) + " " + tr("MRU");
  }

  function totalFacture(lignes) {
    let somme = 0;
    for (const l of lignes || []) {
      if (l.montantTotal !== null && l.montantTotal !== undefined) somme += Number(l.montantTotal);
    }
    return Math.round(somme * 100) / 100;
  }

  function actionAnnulation(l) {
    const demande = demandeParDispensation[l.id];
    if (demande && demande.statut === "EN_ATTENTE") {
      return <span className="annulation-etat annulation-etat-attente">{tr("Annulation demandée")}</span>;
    }
    return (
      <>
        {demande && demande.statut === "REFUSEE" && (
          <span className="annulation-etat annulation-etat-refus">
            {tr("Annulation refusée")}{demande.commentaireDecision ? " : " + demande.commentaireDecision : ""}
          </span>
        )}
        <button type="button" className="annulation-lien" onClick={() => ouvrirAnnulation(l)}>
          {demande && demande.statut === "REFUSEE" ? tr("Redemander") : tr("Demander l'annulation")}
        </button>
      </>
    );
  }

  // Apercu des montants du panier : calcule par le serveur (memes regles que l'enregistrement).
  useEffect(() => {
    const lignes = panier
      .filter((l) => Number(l.quantite) > 0)
      .map((l) => ({ produitId: l.produitId, quantite: Number(l.quantite) }));
    if (lignes.length === 0) {
      setApercu(null);
      return undefined;
    }
    let annule = false;
    const minuteur = setTimeout(async () => {
      try {
        const token = localStorage.getItem("SYGIMS_token");
        const res = await fetch(API_URL + "/stocks/dispensation/panier/apercu", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
          body: JSON.stringify({ lignes }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!annule) setApercu(data);
      } catch (err) {
        // Silencieux : l'apercu est un complement, il ne doit pas bloquer la saisie.
      }
    }, 350);
    return () => {
      annule = true;
      clearTimeout(minuteur);
    };
  }, [panier]);

  // L'apercu est "a jour" quand il correspond exactement aux quantites actuelles du panier.
  const apercuAJour =
    !!apercu &&
    panier.length > 0 &&
    panier.every((l) => {
      const a = apercu.lignes.find((x) => String(x.produitId) === String(l.produitId));
      return !!a && a.quantite === Number(l.quantite);
    });
  const manqueDeStock = apercuAJour && apercu.lignes.some((x) => !x.suffisant);

  function detailLigne(id) {
    const ligne = panier.find((l) => String(l.produitId) === String(id));
    const a = apercu && apercu.lignes.find((x) => String(x.produitId) === String(id));
    if (!a || !ligne || a.quantite !== Number(ligne.quantite)) return null;
    return (
      <small className={a.suffisant ? "disp-ligne-detail" : "disp-ligne-detail disp-ligne-manque"}>
        {formaterMontant(a.montantTotal)}
        {" \u00b7 " + tr("stock") + " : " + a.stockDisponible}
        {a.suffisant ? "" : " (" + tr("insuffisant") + ")"}
      </small>
    );
  }

  function reinitialiserFormulaire() {
    setPanier([]);
    setRecherche("");
    setCategorieFiltre("");
    setProgrammeFiltre("");
    setTypeBeneficiaire("");
    setBeneficiaire("");
    setSucces(false);
    setDerniereDispensation(null);
    setErreur(null);
  }

  const totalPagesDetailRapport = rapportDispensation
    ? Math.max(1, Math.ceil(rapportDispensation.lignes.length / LIGNES_PAR_PAGE_RAPPORT))
    : 1;

  const lignesDetailRapportPage = useMemo(() => {
    if (!rapportDispensation) return [];
    const debut = pageDetailRapport * LIGNES_PAR_PAGE_RAPPORT;
    return rapportDispensation.lignes.slice(debut, debut + LIGNES_PAR_PAGE_RAPPORT);
  }, [rapportDispensation, pageDetailRapport]);

  const typeDerniereDispensation = derniereDispensation
    ? TYPES_BENEFICIAIRE.find((t) => t.valeur === derniereDispensation.typeBeneficiaire)
    : null;

  return (
    <div dir={dir} className={"dispensation-page" + (succes ? "" : " dispensation-page-large")}>
      <header className="dispensation-header">
        <button className="dispensation-retour" onClick={onRetour}>{tr("← Retour")}</button>
        <h1>{succes ? tr("Dispensation enregistrée") : tr("Enregistrer une dispensation")}</h1>
        <SelecteurLangue />
      </header>

      {succes && derniereDispensation ? (
        <>
          {/* Deux exemplaires identiques, pensés pour tenir chacun sur une
              moitié de page A4 à l'impression (voir .ordonnance-copie en
              print dans le CSS) — un exemplaire pour le registre de
              l'établissement, un pour le bénéficiaire. */}
          <div id="facture-dispensation" className="ordonnance-feuille">
            {[0, 1].map((i) => (
              <div className="ordonnance-copie" key={i}>
                <div className="ordonnance-entete">
                  <div className="ordonnance-etablissement">
                    <strong>{nomEtablissement || tr("Formation sanitaire")}</strong>
                    <span className="ordonnance-soustitre">{tr("Bordereau de dispensation")}</span>
                  </div>
                  <div className="ordonnance-meta">
                    {derniereDispensation.numero && <span>{tr("N°")} {derniereDispensation.numero}</span>}
                    <span>{new Date(derniereDispensation.dateDispensation || Date.now()).toLocaleDateString("fr-FR")}</span>
                  </div>
                </div>

                <div className="ordonnance-beneficiaire">
                  <span className="ordonnance-label">{tr(typeDerniereDispensation?.labelChamp || "Destinataire")} :</span>
                  <span className="ordonnance-valeur">{derniereDispensation.beneficiaire}</span>
                </div>

                <table className="ordonnance-table">
                  <thead>
                    <tr><th>{tr("Produit")}</th><th>{tr("Quantité")}</th><th>{tr("Prix unitaire")}</th><th>{tr("Montant")}</th></tr>
                  </thead>
                  <tbody>
                    {(derniereDispensation.lignes || []).map((l, k) => (
                      [
                      <tr key={k}>
                        <td>{l.produitNom}</td>
                        <td>{l.quantite}</td>
                        <td style={{ textAlign: "right" }}>{formaterMontant(l.prixUnitaire)}</td>
                        <td style={{ textAlign: "right" }}>{formaterMontant(l.montantTotal)}</td>
                      </tr>,
                      k === (derniereDispensation.lignes || []).length - 1 ? (
                        <tr key="total" className="ordonnance-total">
                          <td colSpan={3} style={{ textAlign: "right", fontWeight: 700 }}>{tr("Total")}</td>
                          <td style={{ textAlign: "right", fontWeight: 700 }}>
                            {formaterMontant(totalFacture(derniereDispensation.lignes))}
                          </td>
                        </tr>
                      ) : null,
                    ]
                    ))}
                  </tbody>
                </table>

                {nomAgent && <p className="ordonnance-agent">{tr("Dispensé par :")} {nomAgent}</p>}

                <div className="ordonnance-signature">
                  <span>{tr("Cachet et signature")}</span>
                  <span className="ordonnance-case-signature"></span>
                </div>
              </div>
            ))}
          </div>

          <BoutonsExport cibleId="facture-dispensation" nomFichier={`facture-dispensation-${derniereDispensation.numero ?? ""}`} />

          <div className="dispensation-facture-actions no-print">
            <button className="dispensation-bouton" onClick={reinitialiserFormulaire}>{tr("Nouvelle dispensation")}</button>
            <button className="dispensation-bouton dispensation-bouton-secondaire" onClick={onRetour}>{tr("Retour au tableau de bord")}</button>
          </div>
        </>
      ) : (
        <>
          {panier.length > 0 && (
            <button
              type="button"
              className="disp-barre-panier"
              onClick={() => {
                const el = document.getElementById("disp-panier");
                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              {tr("Voir le panier")} ({panier.length})
            </button>
          )}
          <div className="disp-grille">
            <section id="disp-catalogue" className="inventaire-carte disp-catalogue">
              <h2>{tr("Produits")} ({produitsFiltres.length}/{produits.length})</h2>
              <input
                type="search"
                className="disp-recherche"
                placeholder={tr("Rechercher un produit (ex. amox, para...)")}
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                disabled={chargementProduits}
              />
              {programmesDispo.length > 0 && (
                <div className="disp-categories">
                  <button
                    type="button"
                    className={programmeFiltre === "" ? "disp-cat disp-cat-active" : "disp-cat"}
                    onClick={() => { setProgrammeFiltre(""); setCategorieFiltre(""); }}
                  >
                    {tr("Tous")}
                  </button>
                  {programmesDispo.map((g) => (
                    <button
                      key={g.cle}
                      type="button"
                      className={programmeFiltre === g.cle ? "disp-cat disp-cat-active" : "disp-cat"}
                      onClick={() => { setProgrammeFiltre(g.cle); setCategorieFiltre(""); }}
                    >
                      {tr(g.label)}
                    </button>
                  ))}
                </div>
              )}
              {programmeFiltre && categoriesProgramme.length > 1 && (
                <select
                  className="disp-recherche"
                  value={categorieFiltre}
                  onChange={(e) => setCategorieFiltre(e.target.value)}
                >
                  <option value="">{tr("Toutes les cat\u00e9gories")}</option>
                  {categoriesProgramme.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              )}
              {chargementProduits ? (
                <p>{tr("Chargement du catalogue...")}</p>
              ) : produitsFiltres.length === 0 ? (
                <p className="disp-vide">{tr("Aucun produit trouvé.")}</p>
              ) : (
                <ul className="disp-liste">
                  {produitsFiltres.map((p) => {
                    const dansPanier = panier.find((l) => l.produitId === p.id);
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          className={dansPanier ? "disp-produit disp-produit-choisi" : "disp-produit"}
                          onClick={() => ajouterAuPanier(p.id)}
                        >
                          <span>{p.nom}</span>
                          {dansPanier && <span className="disp-badge">{dansPanier.quantite}</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section id="disp-panier" className="inventaire-carte disp-panier">
              <h2>{tr("Panier")} ({panier.length})</h2>
              <button
                type="button"
                className="disp-retour-produits"
                onClick={() => {
                  const el = document.getElementById("disp-catalogue");
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                {"\u2191"} {tr("Retour aux produits")}
              </button>
              {panier.length === 0 ? (
                <p className="disp-vide">{tr("Clique sur un produit pour l'ajouter.")}</p>
              ) : (
                <ul className="disp-lignes">
                  {panier.map((l) => (
                    <li key={l.produitId} className="disp-ligne">
                      <span className="disp-ligne-nom">
                        {nomProduit(l.produitId)}
                        {detailLigne(l.produitId)}
                      </span>
                      <input
                        type="number"
                        min="1"
                        value={l.quantite}
                        onChange={(e) => changerQuantite(l.produitId, e.target.value)}
                        aria-label={tr("Quantité")}
                      />
                      <button
                        type="button"
                        className="disp-retirer"
                        onClick={() => retirerDuPanier(l.produitId)}
                        aria-label={tr("Retirer ce produit")}
                      >
                        {"\u2715"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {panier.length > 0 && (
                <p className="disp-total">
                  <span>{tr("Total")}</span>
                  <strong>{apercuAJour ? formaterMontant(apercu.montantTotalPanier) : tr("Calcul\u2026")}</strong>
                </p>
              )}
              {manqueDeStock && (
                <p className="dispensation-erreur" role="alert">
                  {tr("Stock insuffisant pour au moins un produit du panier.")}
                </p>
              )}

              <form className="dispensation-form" onSubmit={envoyerDispensation}>
                <label className="dispensation-label">
                  {tr("Destiné à")}
                  <select value={typeBeneficiaire} onChange={(e) => setTypeBeneficiaire(e.target.value)}>
                    <option value="">{tr("Choisir")}{"\u2026"}</option>
                    {TYPES_BENEFICIAIRE.map((t) => (
                      <option key={t.valeur} value={t.valeur}>{tr(t.label)}</option>
                    ))}
                  </select>
                </label>

                {typeChoisi && (
                  <label className="dispensation-label">
                    {tr(typeChoisi.labelChamp)}
                    <input
                      type="text"
                      value={beneficiaire}
                      onChange={(e) => setBeneficiaire(e.target.value)}
                      placeholder={tr(typeChoisi.placeholder)}
                    />
                  </label>
                )}

                {erreur && <p className="dispensation-erreur" role="alert">{erreur}</p>}

                <button type="submit" className="dispensation-bouton" disabled={envoi || panier.length === 0 || manqueDeStock}>
                  {envoi ? tr("Envoi\u2026") : tr("Enregistrer la dispensation")}
                </button>
              </form>
            </section>
          </div>
        </>
      )}

      {/* ---------------------------------------------------------------
          Rapport de dispensation — même présentation que lorsqu'il vivait
          dans la page Inventaire physique (classes inventaire-rapport-*),
          toujours visible sous le formulaire ou l'ordonnance.
      ---------------------------------------------------------------- */}
      <section className="inventaire-carte">
        <h2>{tr("Rapport de dispensation")}</h2>
        <p className="inventaire-sous-titre-carte">
          {tr("Répartition de tes dispensations par type de bénéficiaire, sur la période de ton choix.")}
        </p>

        <div className="inventaire-rapport-controles">
          <label className="inventaire-champ-inline">
            {tr("Du")}
            <input
              type="date"
              value={dateDebutRapport}
              onChange={(e) => setDateDebutRapport(e.target.value)}
            />
          </label>
          <label className="inventaire-champ-inline">
            {tr("Au")}
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
            {chargementRapport ? "..." : tr("Générer le rapport")}
          </button>
        </div>

        {erreurRapport && <p className="inventaire-erreur" role="alert">{erreurRapport}</p>}

        {rapportDispensation && (
          <>
            <div id="rapport-dispensation" className="zone-imprimable">
              <div className="inventaire-rapport-entete">
                <h3>{tr("Rapport de dispensation")}</h3>
                <p>
                  <strong>{rapportDispensation.etablissement || tr("Formation sanitaire")}</strong>
                  {" — "}
                  {rapportDispensation.periode.dateDebut || rapportDispensation.periode.dateFin
                    ? `${tr("du")} ${rapportDispensation.periode.dateDebut || "—"} ${tr("au")} ${rapportDispensation.periode.dateFin || "—"}`
                    : tr("tout l'historique")}
                </p>
                <p className="inventaire-rapport-entete-genere">
                  {tr("Généré le")} {new Date().toLocaleDateString("fr-FR")}
                </p>
              </div>

              {rapportDispensation.totalDispensations === 0 ? (
                <p className="inventaire-vide">{tr("Aucune dispensation sur cette période.")}</p>
              ) : (
                <div className="inventaire-rapport-detail">
                  <div className="inventaire-table-scroll inventaire-rapport-table-scroll">
                    <table className="inventaire-table inventaire-table-rapport">
                      <thead>
                        <tr>
                          <th>{tr("Date")}</th>
                          <th>{tr("Produit")}</th>
                          <th>{tr("Quantité")}</th>
                          <th>{tr("Type")}</th>
                          <th>{tr("Bénéficiaire")}</th>
                          <th className="no-print">{tr("Action")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lignesDetailRapportPage.map((l, index) => (
                          <tr key={l.id} className={index % 2 === 1 ? "inventaire-ligne-alternee" : undefined}>
                            <td>{new Date(l.date).toLocaleDateString("fr-FR")}</td>
                            <td>{l.produit}</td>
                            <td>{l.quantite}</td>
                            <td>{tr(LIBELLES_TYPE_BENEFICIAIRE[l.typeBeneficiaire] || l.typeBeneficiaire)}</td>
                            <td>{l.beneficiaire}</td>
                            <td className="no-print">{actionAnnulation(l)}</td>
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
                        {tr("← Précédent")}
                      </button>
                      <span>{tr("Page")} {pageDetailRapport + 1} / {totalPagesDetailRapport}</span>
                      <button
                        type="button"
                        className="inventaire-bouton-secondaire"
                        onClick={() => setPageDetailRapport((p) => Math.min(totalPagesDetailRapport - 1, p + 1))}
                        disabled={pageDetailRapport >= totalPagesDetailRapport - 1}
                      >
                        {tr("Suivant →")}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <BoutonsExport cibleId="rapport-dispensation" nomFichier="rapport-dispensation" />
            {annulationEnCours && (
              <div className="annulation-fond no-print" role="dialog" aria-modal="true">
                <div className="annulation-boite">
                  <h3>{tr("Demander l'annulation")}</h3>
                  <p className="annulation-resume">
                    {annulationEnCours.produit}
                    {" \u2014 " + tr("quantité") + " "}
                    {annulationEnCours.quantite}
                    {annulationEnCours.beneficiaire ? " \u2014 " + annulationEnCours.beneficiaire : ""}
                  </p>
                  <p className="annulation-aide">
                    {tr("Cette demande sera examinée par le MCM ou le SASSM de votre Moughataa. Le stock ne sera remis qu'après leur validation.")}
                  </p>
                  <label className="annulation-label">
                    {tr("Motif de l'annulation (obligatoire)")}
                    <textarea value={motifAnnulation} onChange={(e) => setMotifAnnulation(e.target.value)} rows={3} />
                  </label>
                  {erreurAnnulation && <p className="annulation-erreur" role="alert">{erreurAnnulation}</p>}
                  <div className="annulation-actions">
                    <button
                      type="button"
                      className="inventaire-bouton-secondaire"
                      onClick={() => setAnnulationEnCours(null)}
                      disabled={envoiAnnulation}
                    >
                      {tr("Fermer")}
                    </button>
                    <button type="button" className="dispensation-bouton" onClick={envoyerDemandeAnnulation} disabled={envoiAnnulation}>
                      {envoiAnnulation ? tr("Envoi\u2026") : tr("Envoyer la demande")}
                    </button>
                  </div>
                </div>
              </div>
            )}
            {messageAnnulation && <p className="annulation-message no-print" role="status">{messageAnnulation}</p>}
          </>
        )}
      </section>
    </div>
  );
}