import { useEffect, useMemo, useState } from "react";
import "./AdminPanel.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

function jeton() {
  return localStorage.getItem("SYGIMS_token") || localStorage.getItem("gesmed_token");
}

async function appeler(chemin, options = {}) {
  const res = await fetch(`${API_URL}/offre-service-config${chemin}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jeton()}`,
      ...(options.headers || {}),
    },
    cache: "no-store",
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    throw new Error((data && data.erreur) || "Le serveur n'a pas répondu comme prévu. Vérifiez que le backend est démarré.");
  }
  return data;
}

// Grille commune à l'en-tête et aux lignes des services.
const GRILLE_SERVICE = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 110px 110px 80px 200px",
  alignItems: "center",
  columnGap: "12px",
  textAlign: "left",
};

const styleEntete = {
  ...GRILLE_SERVICE,
  padding: "6px 0",
  borderBottom: "2px solid #c9c9c9",
  fontSize: "0.85rem",
  fontWeight: 600,
  opacity: 0.75,
};

const styleLigne = {
  ...GRILLE_SERVICE,
  padding: "10px 0",
  borderBottom: "1px solid #e2e2e2",
};

const styleChampCible = {
  width: "80px",
  padding: "6px 8px",
  borderRadius: "6px",
  border: "1px solid #b5b5b5",
  textAlign: "right",
};

const styleChampTexte = {
  width: "100%",
  boxSizing: "border-box",
  padding: "8px 10px",
  borderRadius: "6px",
  border: "1px solid #b5b5b5",
};

const styleBoutonLien = {
  padding: "7px 10px",
  borderRadius: "6px",
  border: "1px solid #1f5fa8",
  background: "transparent",
  color: "#1f5fa8",
  fontWeight: 600,
  cursor: "pointer",
};

const styleBoite = {
  border: "1px solid #c9c9c9",
  borderRadius: "8px",
  padding: "14px",
  margin: "12px 0",
  textAlign: "left",
};

const styleEtiquette = {
  display: "block",
  fontSize: "0.85rem",
  fontWeight: 600,
  margin: "10px 0 4px",
};

const COULEUR_ALERTE = "#b3561e";

function cibleValide(texte) {
  if (texte === "") return true;
  if (!/^\d{1,3}$/.test(texte)) return false;
  const n = Number(texte);
  return n >= 0 && n <= 100;
}

// ---------------------------------------------------------------------------
// Écran « Éligibilité » d'un service : choix des FOSA qui doivent l'offrir.
// ---------------------------------------------------------------------------
function EligibiliteService({ service, nbFosa, nouveau, onRetour, onEnregistre }) {
  const [fosas, setFosas] = useState([]);
  const [selection, setSelection] = useState(new Set());
  const [recherche, setRecherche] = useState("");
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState(null);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    let annule = false;
    (async () => {
      setChargement(true);
      setErreur(null);
      try {
        const data = await appeler(`/services/${service.id}/eligibilite`);
        if (annule) return;
        setFosas(data.fosas);
        setSelection(new Set(data.fosas.filter((f) => f.eligible).map((f) => f.id)));
      } catch (err) {
        if (!annule) setErreur(err.message || "Connexion instable, réessayez.");
      } finally {
        if (!annule) setChargement(false);
      }
    })();
    return () => {
      annule = true;
    };
  }, [service.id]);

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (!q) return fosas;
    return fosas.filter((f) =>
      [f.nom, f.drs, f.moughataa].some((v) => (v || "").toLowerCase().includes(q))
    );
  }, [fosas, recherche]);

  function basculer(id) {
    setMessage(null);
    setSelection((s) => {
      const copie = new Set(s);
      if (copie.has(id)) copie.delete(id);
      else copie.add(id);
      return copie;
    });
  }

  function toutCocher() {
    setMessage(null);
    setSelection((s) => {
      const copie = new Set(s);
      visibles.forEach((f) => copie.add(f.id));
      return copie;
    });
  }

  function toutDecocher() {
    setMessage(null);
    setSelection((s) => {
      const copie = new Set(s);
      visibles.forEach((f) => copie.delete(f.id));
      return copie;
    });
  }

  async function enregistrer() {
    setEnCours(true);
    setMessage(null);
    setErreur(null);
    try {
      const data = await appeler(`/services/${service.id}/eligibilite`, {
        method: "PUT",
        body: JSON.stringify({ etablissementIds: [...selection] }),
      });
      setMessage(data.message || "Éligibilité enregistrée.");
      onEnregistre();
    } catch (err) {
      setErreur(err.message || "Connexion instable, réessayez.");
    } finally {
      setEnCours(false);
    }
  }

  let drsAffichee = null;
  let moughataaAffichee = null;

  return (
    <div className="admin-page" style={{ textAlign: "left" }}>
      <header className="admin-header">
        <button className="admin-retour" onClick={onRetour}>← Retour à la configuration</button>
        <h1>Éligibilité</h1>
      </header>

      {nouveau && (
        <p className="admin-message">
          Service ajouté. Indiquez maintenant les formations sanitaires concernées.
        </p>
      )}

      <p>
        <strong>{service.nom}</strong>
        <br />
        Cochez les formations sanitaires qui doivent offrir ce service ({nbFosa} formation(s) sanitaire(s) active(s)
        dans le réseau). Si toutes sont concernées, cliquez sur « Tout cocher » puis enregistrez.
      </p>

      {chargement && <p>Chargement...</p>}
      {erreur && <p className="admin-erreur" role="alert">{erreur}</p>}
      {message && <p className="admin-message">{message}</p>}

      {!chargement && !erreur && (
        <>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center", margin: "12px 0" }}>
            <input
              type="search"
              placeholder="Rechercher (FOSA, Moughataa, DRS)"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              style={{ flex: "1 1 240px", padding: "8px 10px", borderRadius: "6px", border: "1px solid #b5b5b5" }}
            />
            <button type="button" style={styleBoutonLien} onClick={toutCocher}>Tout cocher</button>
            <button type="button" style={styleBoutonLien} onClick={toutDecocher}>Tout décocher</button>
          </div>

          <p>
            <strong>{selection.size}</strong> formation(s) sanitaire(s) cochée(s) sur {fosas.length}.
          </p>

          {selection.size === 0 && (
            <p style={{ color: COULEUR_ALERTE }}>
              Aucune formation sanitaire cochée : l'éligibilité de ce service restera « à définir ».
            </p>
          )}

          {visibles.length === 0 && <p>Aucune formation sanitaire ne correspond à la recherche.</p>}

          {visibles.map((f) => {
            const nouvelleDrs = f.drs !== drsAffichee;
            const nouvelleMoughataa = nouvelleDrs || f.moughataa !== moughataaAffichee;
            drsAffichee = f.drs;
            moughataaAffichee = f.moughataa;
            return (
              <div key={f.id}>
                {nouvelleDrs && <h2 style={{ textAlign: "left", margin: "20px 0 4px" }}>{f.drs || "Sans DRS"}</h2>}
                {nouvelleMoughataa && (
                  <h3 style={{ textAlign: "left", margin: "10px 0 2px", opacity: 0.8 }}>
                    {f.moughataa || "Sans Moughataa"}
                  </h3>
                )}
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "8px 0",
                    borderBottom: "1px solid #e2e2e2",
                    cursor: "pointer",
                  }}
                >
                  <input type="checkbox" checked={selection.has(f.id)} onChange={() => basculer(f.id)} />
                  <span>{f.nom}</span>
                </label>
              </div>
            );
          })}

          <div style={{ marginTop: "20px" }}>
            {message && <p className="admin-message">{message}</p>}
            {erreur && <p className="admin-erreur" role="alert">{erreur}</p>}
            <button className="admin-bouton" onClick={enregistrer} disabled={enCours}>
              {enCours ? "Enregistrement..." : "Enregistrer l'éligibilité"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Écran principal : cible et activation de chaque service, ajout de services
// et (admin) de programmes.
// ---------------------------------------------------------------------------
export default function ConfigurationOffre({ onRetour }) {
  const [donnees, setDonnees] = useState(null);
  const [cibles, setCibles] = useState({});
  const [actifs, setActifs] = useState({});
  const [initial, setInitial] = useState({});
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [serviceEligibilite, setServiceEligibilite] = useState(null);

  // Formulaire « Ajouter un service » (un seul ouvert à la fois) et « Ajouter un programme ».
  const [formService, setFormService] = useState(null);
  const [formProgramme, setFormProgramme] = useState(null);
  const [erreurForm, setErreurForm] = useState(null);
  const [enCoursForm, setEnCoursForm] = useState(false);
  const [edition, setEdition] = useState(null);

  async function charger() {
    setChargement(true);
    setErreur(null);
    try {
      const data = await appeler("/configuration");
      const c = {};
      const a = {};
      const i = {};
      for (const p of data.programmes) {
        for (const g of p.groupes) {
          for (const s of g.services) {
            const texte = s.ciblePct === null || s.ciblePct === undefined ? "" : String(s.ciblePct);
            c[s.id] = texte;
            a[s.id] = s.actif;
            i[s.id] = { cible: texte, actif: s.actif };
          }
        }
      }
      setDonnees(data);
      setCibles(c);
      setActifs(a);
      setInitial(i);
    } catch (err) {
      setErreur(err.message || "Connexion instable, réessayez.");
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    charger();
  }, []);

  const modifies = useMemo(
    () =>
      Object.keys(cibles).filter(
        (id) => initial[id] && (cibles[id] !== initial[id].cible || actifs[id] !== initial[id].actif)
      ),
    [cibles, actifs, initial]
  );

  const aDesErreurs = modifies.some((id) => !cibleValide(cibles[id]));

  async function enregistrer() {
    setEnCours(true);
    setMessage(null);
    setErreur(null);
    let reussis = 0;
    const echecs = [];
    for (const id of modifies) {
      try {
        await appeler(`/services/${id}`, {
          method: "PUT",
          body: JSON.stringify({
            ciblePct: cibles[id] === "" ? null : Number(cibles[id]),
            actif: actifs[id],
          }),
        });
        reussis += 1;
      } catch (err) {
        echecs.push(err.message || "Erreur");
      }
    }
    await charger();
    if (reussis > 0) setMessage(`${reussis} service(s) mis à jour.`);
    if (echecs.length > 0) setErreur(`${echecs.length} modification(s) n'ont pas pu être enregistrées : ${echecs[0]}`);
    setEnCours(false);
  }

  function ouvrirFormService(programme) {
    setMessage(null);
    setErreurForm(null);
    setFormProgramme(null);
    setFormService({
      programmeCode: programme.code,
      programmeNom: programme.nom,
      groupeChoix: "",
      groupeNouveau: "",
      nom: "",
      cible: "",
    });
  }

  function ouvrirFormProgramme() {
    setMessage(null);
    setErreurForm(null);
    setFormService(null);
    setFormProgramme({ nom: "", code: "" });
  }

  function ouvrirEdition(service, groupe, programme) {
    if (modifies.length > 0) {
      setErreur("Enregistrez d'abord vos modifications en cours (bouton en bas de la page), puis modifiez le service.");
      return;
    }
    setErreur(null);
    setMessage(null);
    setFormService(null);
    setEdition({
      id: service.id,
      nom: service.nom,
      groupe: groupe.groupe === programme.nom ? "" : groupe.groupe,
      erreur: null,
      enCours: false,
    });
  }

  async function enregistrerEdition(ev) {
    ev.preventDefault();
    const nom = edition.nom.trim();
    const groupe = edition.groupe.trim();
    if (nom.length < 2) {
      setEdition((x) => ({ ...x, erreur: "Saisissez le nom du service (2 caractères au minimum)." }));
      return;
    }
    if (groupe.length > 80) {
      setEdition((x) => ({ ...x, erreur: "Le nom du groupe ne doit pas dépasser 80 caractères." }));
      return;
    }
    setEdition((x) => ({ ...x, enCours: true, erreur: null }));
    try {
      await appeler("/services/" + edition.id, {
        method: "PUT",
        body: JSON.stringify({ nom, groupe }),
      });
      setEdition(null);
      await charger();
      setMessage("Service modifié.");
    } catch (err) {
      setEdition((x) => (x ? { ...x, enCours: false, erreur: err.message || "Connexion instable, réessayez." } : x));
    }
  }

  async function ajouterService(e) {
    e.preventDefault();
    setErreurForm(null);

    if (modifies.length > 0) {
      setErreurForm("Enregistrez d'abord vos modifications en cours (bouton en bas de la page), puis ajoutez le service.");
      return;
    }
    const nom = formService.nom.trim();
    if (nom.length < 2) {
      setErreurForm("Saisissez le nom du service (2 caractères au minimum).");
      return;
    }
    if (!cibleValide(formService.cible.trim())) {
      setErreurForm("La cible doit être un nombre entier entre 0 et 100, ou rester vide.");
      return;
    }
    const groupe = formService.groupeChoix === "__nouveau__" ? formService.groupeNouveau.trim() : formService.groupeChoix;
    if (formService.groupeChoix === "__nouveau__" && groupe.length < 2) {
      setErreurForm("Saisissez le nom du nouveau groupe, ou choisissez « Aucun groupe ».");
      return;
    }

    setEnCoursForm(true);
    try {
      const data = await appeler("/services", {
        method: "POST",
        body: JSON.stringify({
          programmeCode: formService.programmeCode,
          groupe: groupe || null,
          nom,
          ciblePct: formService.cible.trim() === "" ? null : Number(formService.cible.trim()),
        }),
      });
      setFormService(null);
      await charger();
      setServiceEligibilite({ id: data.service.id, nom: data.service.nom, nouveau: true });
    } catch (err) {
      setErreurForm(err.message || "Connexion instable, réessayez.");
    } finally {
      setEnCoursForm(false);
    }
  }

  async function ajouterProgramme(e) {
    e.preventDefault();
    setErreurForm(null);

    const nom = formProgramme.nom.trim();
    if (nom.length < 2) {
      setErreurForm("Saisissez le nom du programme (2 caractères au minimum).");
      return;
    }

    setEnCoursForm(true);
    try {
      const data = await appeler("/programmes", {
        method: "POST",
        body: JSON.stringify({ nom, code: formProgramme.code.trim() }),
      });
      setFormProgramme(null);
      await charger();
      setMessage(`Programme « ${data.programme.nom} » ajouté. Ajoutez maintenant ses services.`);
    } catch (err) {
      setErreurForm(err.message || "Connexion instable, réessayez.");
    } finally {
      setEnCoursForm(false);
    }
  }

  if (serviceEligibilite) {
    return (
      <EligibiliteService
        service={serviceEligibilite}
        nbFosa={donnees ? donnees.nbFosa : 0}
        nouveau={!!serviceEligibilite.nouveau}
        onRetour={() => setServiceEligibilite(null)}
        onEnregistre={charger}
      />
    );
  }

  return (
    <div className="admin-page" style={{ textAlign: "left" }}>
      <header className="admin-header">
        <button className="admin-retour" onClick={onRetour}>← Retour</button>
        <h1>Configuration de l'offre de service</h1>
      </header>

      {chargement && <p>Chargement...</p>}
      {erreur && <p className="admin-erreur" role="alert">{erreur}</p>}
      {message && <p className="admin-message">{message}</p>}

      {donnees && (
        <>
          <p>
            Fixez pour chaque service la <strong>cible</strong> (pourcentage de formations sanitaires qui doivent
            l'offrir) et les formations sanitaires <strong>éligibles</strong>. Le réseau compte{" "}
            <strong>{donnees.nbFosa}</strong> formation(s) sanitaire(s) active(s).
          </p>

          {donnees.peutCreerProgramme && (
            <div style={{ margin: "12px 0" }}>
              {!formProgramme && (
                <button type="button" style={styleBoutonLien} onClick={ouvrirFormProgramme}>
                  + Ajouter un programme
                </button>
              )}
              {formProgramme && (
                <form onSubmit={ajouterProgramme} style={styleBoite}>
                  <strong>Nouveau programme</strong>
                  <label style={styleEtiquette} htmlFor="prog-nom">Nom du programme</label>
                  <input
                    id="prog-nom"
                    type="text"
                    style={styleChampTexte}
                    placeholder="Exemple : PEV, Santé reproductive"
                    value={formProgramme.nom}
                    onChange={(e) => setFormProgramme((f) => ({ ...f, nom: e.target.value }))}
                  />
                  <label style={styleEtiquette} htmlFor="prog-code">Code (facultatif, généré à partir du nom)</label>
                  <input
                    id="prog-code"
                    type="text"
                    style={styleChampTexte}
                    placeholder="Exemple : PEV"
                    value={formProgramme.code}
                    onChange={(e) => setFormProgramme((f) => ({ ...f, code: e.target.value }))}
                  />
                  {erreurForm && <p className="admin-erreur" role="alert">{erreurForm}</p>}
                  <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                    <button className="admin-bouton" type="submit" disabled={enCoursForm}>
                      {enCoursForm ? "Ajout..." : "Ajouter le programme"}
                    </button>
                    <button type="button" style={styleBoutonLien} onClick={() => setFormProgramme(null)}>
                      Annuler
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {donnees.programmes.length === 0 && <p>Aucun service à configurer.</p>}

          {donnees.programmes.map((programme) => (
            <section key={programme.code} style={{ marginBottom: "28px" }}>
              <h2 style={{ textAlign: "left" }}>{programme.nom}</h2>

              {programme.groupes.length === 0 && <p style={{ opacity: 0.75 }}>Aucun service pour l'instant.</p>}

              {programme.groupes.length > 0 && (
                <div style={styleEntete}>
                  <div>Service</div>
                  <div>Cible (%)</div>
                  <div>Éligibles</div>
                  <div>Actif</div>
                  <div></div>
                </div>
              )}

              {programme.groupes.map((groupe) => (
                <div key={groupe.groupe}>
                  {groupe.groupe !== programme.nom && (
                    <h3 style={{ textAlign: "left", margin: "16px 0 4px" }}>{groupe.groupe}</h3>
                  )}
                  {groupe.services.map((service) => {
                    const texte = cibles[service.id] ?? "";
                    const invalide = !cibleValide(texte);
                    return (
                      <div key={service.id}>
                      <div style={{ ...styleLigne, opacity: actifs[service.id] ? 1 : 0.55 }}>
                        <div style={{ minWidth: 0 }}>
                          <div>{service.nom}</div>
                          {invalide && (
                            <small style={{ color: "#b3261e", display: "block" }}>Nombre entier de 0 à 100</small>
                          )}
                        </div>
                        <div>
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="—"
                            value={texte}
                            onChange={(e) => {
                              setMessage(null);
                              setCibles((c) => ({ ...c, [service.id]: e.target.value.trim() }));
                            }}
                            style={{ ...styleChampCible, borderColor: invalide ? "#b3261e" : "#b5b5b5" }}
                          />
                        </div>
                        <div>
                          {service.nbEligibles > 0 ? (
                            `${service.nbEligibles} / ${donnees.nbFosa}`
                          ) : (
                            <span style={{ color: COULEUR_ALERTE, fontWeight: 600 }}>À définir</span>
                          )}
                        </div>
                        <div>
                          <input
                            type="checkbox"
                            checked={!!actifs[service.id]}
                            onChange={(e) => {
                              setMessage(null);
                              setActifs((a) => ({ ...a, [service.id]: e.target.checked }));
                            }}
                          />
                        </div>
                        <div>
                          <button
                            type="button"
                            style={styleBoutonLien}
                            onClick={() => setServiceEligibilite({ id: service.id, nom: service.nom })}
                          >
                            Éligibilité
                          </button>
                          <button
                            type="button"
                            style={{ ...styleBoutonLien, marginLeft: "12px" }}
                            onClick={() => ouvrirEdition(service, groupe, programme)}
                          >
                            Modifier
                          </button>
                        </div>
                      </div>
                      {edition && edition.id === service.id && (
                        <form onSubmit={enregistrerEdition} style={styleBoite}>
                          <strong>Modifier le service</strong>
                          <div style={{ marginTop: "8px" }}>
                            <label>Nom du service</label>
                            <input
                              type="text"
                              value={edition.nom}
                              onChange={(ev) => setEdition((x) => ({ ...x, nom: ev.target.value, erreur: null }))}
                              style={{ width: "100%", boxSizing: "border-box" }}
                            />
                          </div>
                          <div style={{ marginTop: "8px" }}>
                            <label>Groupe (laisser vide pour aucun groupe)</label>
                            <input
                              type="text"
                              list={"groupes-" + programme.code}
                              value={edition.groupe}
                              onChange={(ev) => setEdition((x) => ({ ...x, groupe: ev.target.value, erreur: null }))}
                              style={{ width: "100%", boxSizing: "border-box" }}
                            />
                            <datalist id={"groupes-" + programme.code}>
                              {programme.groupes
                                .filter((g) => g.groupe !== programme.nom)
                                .map((g) => (
                                  <option key={g.groupe} value={g.groupe} />
                                ))}
                            </datalist>
                          </div>
                          {edition.erreur && <p className="admin-erreur" role="alert">{edition.erreur}</p>}
                          <div style={{ marginTop: "10px" }}>
                            <button className="admin-bouton" type="submit" disabled={edition.enCours}>
                              {edition.enCours ? "Enregistrement..." : "Enregistrer"}
                            </button>
                            <button type="button" style={styleBoutonLien} onClick={() => setEdition(null)}>
                              Annuler
                            </button>
                          </div>
                        </form>
                      )}
                      </div>
                    );
                  })}
                </div>
              ))}

              <div style={{ marginTop: "12px" }}>
                {!(formService && formService.programmeCode === programme.code) && (
                  <button type="button" style={styleBoutonLien} onClick={() => ouvrirFormService(programme)}>
                    + Ajouter un service
                  </button>
                )}

                {formService && formService.programmeCode === programme.code && (
                  <form onSubmit={ajouterService} style={styleBoite}>
                    <strong>Nouveau service — {programme.nom}</strong>

                    <label style={styleEtiquette} htmlFor="serv-groupe">Groupe</label>
                    <select
                      id="serv-groupe"
                      style={styleChampTexte}
                      value={formService.groupeChoix}
                      onChange={(e) => setFormService((f) => ({ ...f, groupeChoix: e.target.value }))}
                    >
                      <option value="">Aucun groupe</option>
                      {programme.groupes
                        .filter((g) => g.groupe !== programme.nom)
                        .map((g) => (
                          <option key={g.groupe} value={g.groupe}>{g.groupe}</option>
                        ))}
                      <option value="__nouveau__">Nouveau groupe…</option>
                    </select>

                    {formService.groupeChoix === "__nouveau__" && (
                      <>
                        <label style={styleEtiquette} htmlFor="serv-groupe-nouveau">Nom du nouveau groupe</label>
                        <input
                          id="serv-groupe-nouveau"
                          type="text"
                          style={styleChampTexte}
                          value={formService.groupeNouveau}
                          onChange={(e) => setFormService((f) => ({ ...f, groupeNouveau: e.target.value }))}
                        />
                      </>
                    )}

                    <label style={styleEtiquette} htmlFor="serv-nom">Nom du service</label>
                    <input
                      id="serv-nom"
                      type="text"
                      style={styleChampTexte}
                      value={formService.nom}
                      onChange={(e) => setFormService((f) => ({ ...f, nom: e.target.value }))}
                    />

                    <label style={styleEtiquette} htmlFor="serv-cible">Cible en % (facultative)</label>
                    <input
                      id="serv-cible"
                      type="text"
                      inputMode="numeric"
                      placeholder="—"
                      style={{ ...styleChampCible, textAlign: "right" }}
                      value={formService.cible}
                      onChange={(e) => setFormService((f) => ({ ...f, cible: e.target.value }))}
                    />

                    {erreurForm && <p className="admin-erreur" role="alert">{erreurForm}</p>}

                    <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                      <button className="admin-bouton" type="submit" disabled={enCoursForm}>
                        {enCoursForm ? "Ajout..." : "Ajouter le service"}
                      </button>
                      <button type="button" style={styleBoutonLien} onClick={() => setFormService(null)}>
                        Annuler
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </section>
          ))}

          <button
            className="admin-bouton"
            onClick={enregistrer}
            disabled={enCours || modifies.length === 0 || aDesErreurs}
          >
            {enCours ? "Enregistrement..." : `Enregistrer (${modifies.length} modification(s))`}
          </button>
        </>
      )}
    </div>
  );
}