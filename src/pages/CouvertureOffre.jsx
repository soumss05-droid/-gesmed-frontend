import { useEffect, useMemo, useState } from "react";
import "./AdminPanel.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

function jeton() {
  return localStorage.getItem("SYGIMS_token") || localStorage.getItem("gesmed_token");
}

async function chargerCouverture(codeProgramme) {
  const parametre = codeProgramme ? `?programme=${encodeURIComponent(codeProgramme)}` : "";
  const res = await fetch(`${API_URL}/couverture-offre${parametre}`, {
    headers: { Authorization: `Bearer ${jeton()}` },
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

const NIVEAUX = {
  HOPITAL: "Hôpital",
  CS_MOUGHATAA: "CS de Moughataa",
  CS_SECONDAIRE: "CS secondaire",
  PS_PRINCIPAL: "PS principal",
  PS_SECONDAIRE: "PS secondaire",
  UPEC_COMMUNAUTAIRE: "UPEC communautaire",
};

const LIMITE_FOSA = 300;

function formaterPct(valeur) {
  if (valeur === null || valeur === undefined) return "—";
  return `${String(valeur).replace(".", ",")} %`;
}

// Pourcentage coloré selon la cible ; le symbole ✓ / ✗ évite de dépendre de la seule couleur.
function Pastille({ valeur, cible }) {
  if (valeur === null || valeur === undefined) return <span>—</span>;
  if (cible === null || cible === undefined) return <strong>{formaterPct(valeur)}</strong>;
  const atteint = valeur >= cible;
  return (
    <strong
      style={{ color: atteint ? "#1f7a3d" : "#b3261e" }}
      title={atteint ? "Cible atteinte" : "Cible non atteinte"}
    >
      {formaterPct(valeur)} {atteint ? "✓" : "✗"}
    </strong>
  );
}

const styleTableau = { width: "100%", borderCollapse: "collapse", fontSize: "0.92rem" };
const styleTh = {
  padding: "8px 6px",
  borderBottom: "2px solid #c9c9c9",
  textAlign: "right",
  fontSize: "0.85rem",
  fontWeight: 600,
  opacity: 0.8,
  verticalAlign: "bottom",
};
const styleThGauche = { ...styleTh, textAlign: "left" };
const styleTd = { padding: "8px 6px", borderBottom: "1px solid #e2e2e2", textAlign: "right" };
const styleTdGauche = { ...styleTd, textAlign: "left" };
const styleTdTotal = { ...styleTd, fontWeight: 700, background: "rgba(0,0,0,0.04)" };
const styleTdTotalGauche = { ...styleTdTotal, textAlign: "left" };
const styleChamp = {
  padding: "8px 10px",
  borderRadius: "6px",
  border: "1px solid #b5b5b5",
  maxWidth: "100%",
};

function Onglet({ actif, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "8px 14px",
        border: "none",
        borderBottom: actif ? "3px solid #1f7a3d" : "3px solid transparent",
        background: "transparent",
        fontWeight: actif ? 700 : 500,
        cursor: "pointer",
        fontSize: "0.95rem",
      }}
    >
      {children}
    </button>
  );
}

// Tableau commun aux vues « Par DRS » et « Par Moughataa ».
function TableauZones({ titreColonne, lignes, total, cible, avecSousTitre }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={styleTableau}>
        <thead>
          <tr>
            <th style={styleThGauche}>{titreColonne}</th>
            <th style={styleTh}>FOSA actives</th>
            <th style={styleTh}>FOSA éligibles</th>
            <th style={styleTh}>Offrent le service</th>
            <th style={styleTh}>Non renseignées</th>
            <th style={styleTh}>Couverture / éligibles</th>
            <th style={styleTh}>Couverture / total FOSA</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((l) => (
            <tr key={`${l.drs || ""}|${l.nom}`}>
              <td style={styleTdGauche}>
                {l.nom}
                {avecSousTitre && l.drs && <div style={{ fontSize: "0.8rem", opacity: 0.65 }}>{l.drs}</div>}
              </td>
              <td style={styleTd}>{l.totalFosa}</td>
              <td style={styleTd}>{l.eligibles}</td>
              <td style={styleTd}>{l.offrent}</td>
              <td style={styleTd}>{l.nonRenseignes}</td>
              <td style={styleTd}><Pastille valeur={l.couvertureEligibles} cible={cible} /></td>
              <td style={styleTd}><Pastille valeur={l.couvertureTotale} cible={cible} /></td>
            </tr>
          ))}
          {total && (
            <tr>
              <td style={styleTdTotalGauche}>Ensemble du périmètre</td>
              <td style={styleTdTotal}>{total.totalFosa}</td>
              <td style={styleTdTotal}>{total.eligibles}</td>
              <td style={styleTdTotal}>{total.offrent}</td>
              <td style={styleTdTotal}>{total.nonRenseignes}</td>
              <td style={styleTdTotal}><Pastille valeur={total.couvertureEligibles} cible={cible} /></td>
              <td style={styleTdTotal}><Pastille valeur={total.couvertureTotale} cible={cible} /></td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function CouvertureOffre({ onRetour }) {
  const [donnees, setDonnees] = useState(null);
  const [programmes, setProgrammes] = useState([]);
  const [codeProgramme, setCodeProgramme] = useState("");
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(true);
  const [onglet, setOnglet] = useState("national");
  const [serviceId, setServiceId] = useState("");
  const [filtreDrs, setFiltreDrs] = useState("");
  const [filtreMoughataa, setFiltreMoughataa] = useState("");
  const [recherche, setRecherche] = useState("");

  useEffect(() => {
    let annule = false;
    setChargement(true);
    setErreur("");
    chargerCouverture(codeProgramme)
      .then((d) => {
        if (annule) return;
        setDonnees(d);
        if (!codeProgramme) {
          const vus = new Map();
          for (const s of d.services) vus.set(s.programme.code, s.programme.nom);
          setProgrammes([...vus].map(([code, nom]) => ({ code, nom })));
        }
      })
      .catch((e) => {
        if (!annule) setErreur(e.message);
      })
      .finally(() => {
        if (!annule) setChargement(false);
      });
    return () => {
      annule = true;
    };
  }, [codeProgramme]);

  const services = donnees ? donnees.services : [];
  const service = services.find((s) => s.id === serviceId) || services[0] || null;

  const listeDrs = useMemo(() => {
    if (!donnees) return [];
    return [...new Set(donnees.fosas.map((f) => f.drs).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
  }, [donnees]);

  const listeMoughataas = useMemo(() => {
    if (!donnees) return [];
    return [
      ...new Set(
        donnees.fosas
          .filter((f) => !filtreDrs || f.drs === filtreDrs)
          .map((f) => f.moughataa)
          .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b, "fr"));
  }, [donnees, filtreDrs]);

  const fosasFiltrees = useMemo(() => {
    if (!donnees) return [];
    const texte = recherche.trim().toLowerCase();
    return donnees.fosas.filter(
      (f) =>
        (!filtreDrs || f.drs === filtreDrs) &&
        (!filtreMoughataa || f.moughataa === filtreMoughataa) &&
        (!texte || f.nom.toLowerCase().includes(texte))
    );
  }, [donnees, filtreDrs, filtreMoughataa, recherche]);

  const lignesMoughataa = service ? service.parMoughataa.filter((m) => !filtreDrs || m.drs === filtreDrs) : [];

  const selecteurService = (
    <label style={{ display: "block", marginBottom: "12px" }}>
      Service :{" "}
      <select value={service ? service.id : ""} onChange={(e) => setServiceId(e.target.value)} style={styleChamp}>
        {services.map((s) => (
          <option key={s.id} value={s.id}>
            {s.programme.nom} — {s.nom}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="admin-page" style={{ textAlign: "left" }}>
      <header className="admin-header">
        <button className="admin-retour" onClick={onRetour}>← Retour</button>
        <h1>Couverture de l'offre de service</h1>
        {donnees && (
          <p className="admin-message">
            Périmètre : {donnees.portee.libelle} — {donnees.totalFosa} formation(s) sanitaire(s) active(s),{" "}
            {donnees.nbServices} service(s).
          </p>
        )}
      </header>

      {erreur && <p className="admin-erreur" role="alert">{erreur}</p>}
      {chargement && <p>Chargement des indicateurs…</p>}

      {donnees && !chargement && (
        <>
          <p style={{ fontSize: "0.88rem", opacity: 0.8, marginTop: 0 }}>
            Couverture / éligibles = FOSA qui offrent le service ÷ FOSA éligibles. Couverture / total FOSA = FOSA qui
            offrent le service ÷ total des FOSA actives. Une FOSA éligible qui n'a pas encore répondu compte comme « ne
            l'offre pas » et figure dans « Non renseignées ». Les FOSA désactivées sont exclues.
          </p>

          {programmes.length > 1 && (
            <label style={{ display: "block", marginBottom: "12px" }}>
              Programme :{" "}
              <select value={codeProgramme} onChange={(e) => setCodeProgramme(e.target.value)} style={styleChamp}>
                <option value="">Tous les programmes</option>
                {programmes.map((p) => (
                  <option key={p.code} value={p.code}>{p.nom}</option>
                ))}
              </select>
            </label>
          )}

          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", borderBottom: "1px solid #c9c9c9", marginBottom: "16px" }}>
            <Onglet actif={onglet === "national"} onClick={() => setOnglet("national")}>National</Onglet>
            <Onglet actif={onglet === "drs"} onClick={() => setOnglet("drs")}>Par DRS</Onglet>
            <Onglet actif={onglet === "moughataa"} onClick={() => setOnglet("moughataa")}>Par Moughataa</Onglet>
            <Onglet actif={onglet === "fosa"} onClick={() => setOnglet("fosa")}>Par FOSA</Onglet>
          </div>

          {services.length === 0 && <p>Aucun service actif à afficher.</p>}

          {services.length > 0 && onglet === "national" && (
            <div style={{ overflowX: "auto" }}>
              <table style={styleTableau}>
                <thead>
                  <tr>
                    <th style={styleThGauche}>Service</th>
                    <th style={styleTh}>Cible</th>
                    <th style={styleTh}>FOSA éligibles</th>
                    <th style={styleTh}>Offrent le service</th>
                    <th style={styleTh}>Non renseignées</th>
                    <th style={styleTh}>Hors éligibilité</th>
                    <th style={styleTh}>Couverture / éligibles</th>
                    <th style={styleTh}>Couverture / total FOSA</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((s) => (
                    <tr key={s.id}>
                      <td style={styleTdGauche}>
                        {s.nom}
                        <div style={{ fontSize: "0.8rem", opacity: 0.65 }}>{s.groupe}</div>
                      </td>
                      <td style={styleTd}>{s.ciblePct === null || s.ciblePct === undefined ? "—" : `${s.ciblePct} %`}</td>
                      <td style={styleTd}>{s.national.eligibles}</td>
                      <td style={styleTd}>{s.national.offrent}</td>
                      <td style={styleTd}>{s.national.nonRenseignes}</td>
                      <td style={styleTd}>{s.national.offrentHorsEligibilite}</td>
                      <td style={styleTd}><Pastille valeur={s.national.couvertureEligibles} cible={s.ciblePct} /></td>
                      <td style={styleTd}><Pastille valeur={s.national.couvertureTotale} cible={s.ciblePct} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {services.length > 0 && onglet === "drs" && service && (
            <>
              {selecteurService}
              <TableauZones
                titreColonne="DRS"
                lignes={service.parDrs}
                total={service.national}
                cible={service.ciblePct}
              />
            </>
          )}

          {services.length > 0 && onglet === "moughataa" && service && (
            <>
              {selecteurService}
              <label style={{ display: "block", marginBottom: "12px" }}>
                DRS :{" "}
                <select value={filtreDrs} onChange={(e) => setFiltreDrs(e.target.value)} style={styleChamp}>
                  <option value="">Toutes les DRS</option>
                  {listeDrs.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </label>
              <TableauZones
                titreColonne="Moughataa"
                lignes={lignesMoughataa}
                cible={service.ciblePct}
                avecSousTitre
              />
            </>
          )}

          {services.length > 0 && onglet === "fosa" && (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "12px" }}>
                <select
                  value={filtreDrs}
                  onChange={(e) => {
                    setFiltreDrs(e.target.value);
                    setFiltreMoughataa("");
                  }}
                  style={styleChamp}
                >
                  <option value="">Toutes les DRS</option>
                  {listeDrs.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <select value={filtreMoughataa} onChange={(e) => setFiltreMoughataa(e.target.value)} style={styleChamp}>
                  <option value="">Toutes les Moughataa</option>
                  {listeMoughataas.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <input
                  type="search"
                  placeholder="Rechercher une FOSA…"
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  style={styleChamp}
                />
              </div>
              <p style={{ fontSize: "0.88rem", opacity: 0.8, marginTop: 0 }}>
                {fosasFiltrees.length} FOSA
                {fosasFiltrees.length > LIMITE_FOSA ? ` (les ${LIMITE_FOSA} premières sont affichées : affinez avec les filtres)` : ""}
                . Services offerts ÷ services éligibles, et ÷ total des {donnees.nbServices} services.
              </p>
              <div style={{ overflowX: "auto" }}>
                <table style={styleTableau}>
                  <thead>
                    <tr>
                      <th style={styleThGauche}>FOSA</th>
                      <th style={styleThGauche}>Niveau</th>
                      <th style={styleTh}>Services éligibles</th>
                      <th style={styleTh}>Services offerts</th>
                      <th style={styleTh}>Couverture / éligibles</th>
                      <th style={styleTh}>Couverture / total des services</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fosasFiltrees.slice(0, LIMITE_FOSA).map((f) => (
                      <tr key={f.id}>
                        <td style={styleTdGauche}>
                          {f.nom}
                          <div style={{ fontSize: "0.8rem", opacity: 0.65 }}>
                            {[f.moughataa, f.drs].filter(Boolean).join(" — ")}
                          </div>
                        </td>
                        <td style={styleTdGauche}>{f.niveau ? NIVEAUX[f.niveau] || f.niveau : "—"}</td>
                        <td style={styleTd}>{f.servicesEligibles}</td>
                        <td style={styleTd}>{f.servicesOfferts}</td>
                        <td style={styleTd}><Pastille valeur={f.couvertureEligibles} /></td>
                        <td style={styleTd}><Pastille valeur={f.couvertureTotale} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}