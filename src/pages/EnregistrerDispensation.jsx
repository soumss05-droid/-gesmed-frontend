import { useEffect, useMemo, useState } from "react";
import "./EnregistrerDispensation.css";
import BoutonsExport from "../components/BoutonsExport";

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

export default function EnregistrerDispensation({ session, onRetour }) {
  const [produits, setProduits] = useState([]);
  const [produitId, setProduitId] = useState("");
  const [quantite, setQuantite] = useState("");
  const [typeBeneficiaire, setTypeBeneficiaire] = useState("");
  const [beneficiaire, setBeneficiaire] = useState("");
  const [chargementProduits, setChargementProduits] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [succes, setSucces] = useState(false);

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
        setErreur(err.message || "Connexion instable, réessayez.");
      } finally {
        setChargementProduits(false);
      }
    }
    chargerProduits();
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
      setPageDetailRapport(0);
    } catch (err) {
      setErreurRapport(err.message || "Connexion instable, réessayez.");
    } finally {
      setChargementRapport(false);
    }
  }

  const typeChoisi = TYPES_BENEFICIAIRE.find((t) => t.valeur === typeBeneficiaire);

  async function envoyerDispensation(e) {
    e.preventDefault();
    setErreur(null);

    if (!produitId || !quantite || Number(quantite) <= 0) {
      setErreur("Choisis un produit et une quantité valide.");
      return;
    }
    if (!typeBeneficiaire) {
      setErreur("Précise à qui cette dispensation est destinée.");
      return;
    }
    if (!beneficiaire.trim()) {
      setErreur("Précise le nom, le téléphone ou le code du bénéficiaire.");
      return;
    }

    setEnvoi(true);
    try {
      const token = localStorage.getItem("SYGIMS_token");
      const res = await fetch(`${API_URL}/stocks/dispensation`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          produitId,
          quantite: Number(quantite),
          typeBeneficiaire,
          beneficiaire: beneficiaire.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erreur || "La dispensation n'a pas pu être enregistrée.");

      const produitNom = produits.find((p) => p.id === produitId)?.nom || "";
      setDerniereDispensation({ ...data.dispensation, produitNom, typeBeneficiaire, beneficiaire: beneficiaire.trim() });
      setSucces(true);
      chargerRapportDispensation();
    } catch (err) {
      setErreur(err.message || "Connexion instable, réessayez.");
    } finally {
      setEnvoi(false);
    }
  }

  function reinitialiserFormulaire() {
    setProduitId("");
    setQuantite("");
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
    <div className="dispensation-page">
      <header className="dispensation-header">
        <button className="dispensation-retour" onClick={onRetour}>← Retour</button>
        <h1>{succes ? "Dispensation enregistrée" : "Enregistrer une dispensation"}</h1>
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
                    <strong>{nomEtablissement || "Formation sanitaire"}</strong>
                    <span className="ordonnance-soustitre">Bordereau de dispensation</span>
                  </div>
                  <div className="ordonnance-meta">
                    {derniereDispensation.numero && <span>N° {derniereDispensation.numero}</span>}
                    <span>{new Date(derniereDispensation.dateDispensation || Date.now()).toLocaleDateString("fr-FR")}</span>
                  </div>
                </div>

                <div className="ordonnance-beneficiaire">
                  <span className="ordonnance-label">{typeDerniereDispensation?.labelChamp || "Destinataire"} :</span>
                  <span className="ordonnance-valeur">{derniereDispensation.beneficiaire}</span>
                </div>

                <table className="ordonnance-table">
                  <thead>
                    <tr><th>Produit</th><th>Quantité</th></tr>
                  </thead>
                  <tbody>
                    <tr><td>{derniereDispensation.produitNom}</td><td>{derniereDispensation.quantite}</td></tr>
                  </tbody>
                </table>

                {nomAgent && <p className="ordonnance-agent">Dispensé par : {nomAgent}</p>}

                <div className="ordonnance-signature">
                  <span>Cachet et signature</span>
                  <span className="ordonnance-case-signature"></span>
                </div>
              </div>
            ))}
          </div>

          <BoutonsExport cibleId="facture-dispensation" nomFichier={`facture-dispensation-${derniereDispensation.numero ?? ""}`} />

          <div className="dispensation-facture-actions no-print">
            <button className="dispensation-bouton" onClick={reinitialiserFormulaire}>Nouvelle dispensation</button>
            <button className="dispensation-bouton dispensation-bouton-secondaire" onClick={onRetour}>Retour au tableau de bord</button>
          </div>
        </>
      ) : (
        <>
          <section className="inventaire-carte dispensation-carte">
          <h2>Dispensation</h2>
          <p className="inventaire-sous-titre-carte">
            Enregistre ce que ton établissement donne : produit, quantité et bénéficiaire.
          </p>

          {chargementProduits && <p>Chargement du catalogue produits...</p>}

          {!chargementProduits && (
            <form className="dispensation-form" onSubmit={envoyerDispensation}>
              <label className="dispensation-label">
                Produit
                <select value={produitId} onChange={(e) => setProduitId(e.target.value)}>
                  <option value="">Choisir un produit…</option>
                  {produits.map((p) => (
                    <option key={p.id} value={p.id}>{p.nom}</option>
                  ))}
                </select>
              </label>

              <label className="dispensation-label">
                Quantité donnée
                <input type="number" min="1" value={quantite} onChange={(e) => setQuantite(e.target.value)} />
              </label>

              <label className="dispensation-label">
                Destiné à
                <select value={typeBeneficiaire} onChange={(e) => setTypeBeneficiaire(e.target.value)}>
                  <option value="">Choisir…</option>
                  {TYPES_BENEFICIAIRE.map((t) => (
                    <option key={t.valeur} value={t.valeur}>{t.label}</option>
                  ))}
                </select>
              </label>

              {typeChoisi && (
                <label className="dispensation-label">
                  {typeChoisi.labelChamp}
                  <input
                    type="text"
                    value={beneficiaire}
                    onChange={(e) => setBeneficiaire(e.target.value)}
                    placeholder={typeChoisi.placeholder}
                  />
                </label>
              )}

              {erreur && <p className="dispensation-erreur" role="alert">{erreur}</p>}

              <button type="submit" className="dispensation-bouton" disabled={envoi}>
                {envoi ? "Envoi…" : "Enregistrer"}
              </button>
            </form>
          )}
          </section>
        </>
      )}

      {/* ---------------------------------------------------------------
          Rapport de dispensation — même présentation que lorsqu'il vivait
          dans la page Inventaire physique (classes inventaire-rapport-*),
          toujours visible sous le formulaire ou l'ordonnance.
      ---------------------------------------------------------------- */}
      <section className="inventaire-carte">
        <h2>Rapport de dispensation</h2>
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

            <BoutonsExport cibleId="rapport-dispensation" nomFichier="rapport-dispensation" />
          </>
        )}
      </section>
    </div>
  );
}