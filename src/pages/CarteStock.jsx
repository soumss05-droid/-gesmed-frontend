import { useEffect, useMemo, useRef, useState } from "react";
import "./AdminPanel.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

function jeton() {
  return localStorage.getItem("SYGIMS_token") || localStorage.getItem("gesmed_token");
}

async function appeler(chemin) {
  const res = await fetch(`${API_URL}${chemin}`, {
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
    throw new Error((data && data.erreur) || "Le serveur n'a pas r\u00e9pondu comme pr\u00e9vu. V\u00e9rifiez que le backend est d\u00e9marr\u00e9.");
  }
  return data;
}

// ---------------------------------------------------------------------------
// Fond de carte : Leaflet est charge a la demande (aucune installation).
// Sans connexion, la carte n'apparait pas mais le tableau reste disponible.
// ---------------------------------------------------------------------------
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
let promesseLeaflet = null;

function chargerLeaflet() {
  if (typeof window === "undefined") return Promise.reject(new Error("Leaflet indisponible"));
  if (window.L) return Promise.resolve(window.L);
  if (promesseLeaflet) return promesseLeaflet;
  promesseLeaflet = new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = LEAFLET_CSS;
    document.head.appendChild(css);
    const js = document.createElement("script");
    js.src = LEAFLET_JS;
    js.async = true;
    js.onload = () => (window.L ? resolve(window.L) : reject(new Error("Leaflet indisponible")));
    js.onerror = () => {
      promesseLeaflet = null;
      js.remove();
      css.remove();
      reject(new Error("Leaflet indisponible"));
    };
    document.head.appendChild(js);
  });
  return promesseLeaflet;
}

// Rectangle englobant la Mauritanie : la carte ne sort pas de ces limites.
const MR_LIMITES = [[14.5, -17.5], [27.5, -4.5]];
function dansLePays(lat, lon) {
  return lat >= MR_LIMITES[0][0] && lat <= MR_LIMITES[1][0] && lon >= MR_LIMITES[0][1] && lon <= MR_LIMITES[1][1];
}

const ROUGE = "#b3261e";
const ORANGE = "#d97706";
const VERT = "#1f7a3d";
const GRIS = "#8a8a8a";
const MARINE = "#12355b";

// Couleur = etat du service dans la formation sanitaire.
const LEGENDE_SERVICE = [
  { cle: "offre", libelle: "Offre le service", couleur: VERT },
  { cle: "non", libelle: "N'offre pas le service", couleur: ROUGE },
  { cle: "nr", libelle: "\u00c9ligible, non renseign\u00e9", couleur: ORANGE },
  { cle: "hors", libelle: "Non \u00e9ligible au service", couleur: GRIS },
  { cle: "nd", libelle: "Information en cours de chargement", couleur: GRIS },
];

// Forme = type de formation sanitaire (dessin dans un carre de 20 x 20).
const TYPES = [
  { cle: "HOPITAL", libelle: "H\u00f4pital", taille: 24, d: "M2.5 2.5 H17.5 V17.5 H2.5 Z" },
  { cle: "CS_MOUGHATAA", libelle: "Centre de sant\u00e9 de moughataa", taille: 24, d: "M10 0.8 L19.2 10 L10 19.2 L0.8 10 Z" },
  { cle: "CS_SECONDAIRE", libelle: "Centre de sant\u00e9 secondaire", taille: 22, d: "M10 1.8 L19 18 L1 18 Z" },
  { cle: "PS_PRINCIPAL", libelle: "Poste de sant\u00e9 principal", taille: 22, d: "M10 1.2 L18.6 7.6 L15.4 18 L4.6 18 L1.4 7.6 Z" },
  { cle: "PS_SECONDAIRE", libelle: "Poste de sant\u00e9 secondaire", taille: 17, d: "M3.5 10 a6.5 6.5 0 1 0 13 0 a6.5 6.5 0 1 0 -13 0 Z" },
  { cle: "UPEC_COMMUNAUTAIRE", libelle: "UPEC communautaire", taille: 24, d: "M10 0.8 L12.6 7 L19.3 7.5 L14.2 11.9 L15.8 18.6 L10 15 L4.2 18.6 L5.8 11.9 L0.7 7.5 L7.4 7 Z" },
  { cle: "AUTRE", libelle: "Clinique, cabinet ou autre", taille: 22, d: "M7 1.5 H13 V7 H18.5 V13 H13 V18.5 H7 V13 H1.5 V7 H7 Z" },
];

function typeDe(niveau) {
  return TYPES.find((t) => t.cle === niveau) || TYPES[TYPES.length - 1];
}

function svgSymbole(type, couleur, taille) {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + taille + '" height="' + taille + '" viewBox="0 0 20 20">' +
    '<path d="' + type.d + '" fill="' + couleur + '" stroke="' + MARINE + '" stroke-width="1.5" stroke-linejoin="round"/></svg>'
  );
}

function Symbole({ type, couleur, taille }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 20 20" aria-hidden="true" style={{ display: "block" }}>
      <path d={type.d} fill={couleur} stroke={MARINE} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

const formatNombre = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
function n(v) {
  return v === null || v === undefined ? "\u2014" : formatNombre.format(v);
}
function pct(v) {
  return v === null || v === undefined ? "\u2014" : `${formatNombre.format(v)} %`;
}
function echapper(texte) {
  return String(texte === null || texte === undefined ? "" : texte)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function contenuPopup(f, type, etat) {
  return (
    "<strong>" + echapper(f.nom) + "</strong><br/>" +
    echapper(type.libelle) + "<br/>" +
    echapper(f.moughataa) + " \u2014 " + echapper(f.wilaya) + "<br/>" +
    "Service : " + echapper(etat.libelle)
  );
}

const styleTableau = { width: "100%", borderCollapse: "collapse", fontSize: "0.92rem" };
const styleTh = {
  padding: "8px 6px",
  borderBottom: "2px solid #c9c9c9",
  textAlign: "right",
  fontSize: "0.84rem",
  fontWeight: 600,
  opacity: 0.8,
  verticalAlign: "bottom",
};
const styleThGauche = { ...styleTh, textAlign: "left" };
const styleTd = { padding: "8px 6px", borderBottom: "1px solid #e2e2e2", textAlign: "right" };
const styleTdGauche = { ...styleTd, textAlign: "left" };
const styleChamp = { padding: "8px 10px", borderRadius: "6px", border: "1px solid #b5b5b5", maxWidth: "100%" };
const styleLien = {
  background: "none",
  border: "none",
  padding: 0,
  color: "#1d4ed8",
  textDecoration: "underline",
  cursor: "pointer",
  font: "inherit",
  textAlign: "left",
};
const LIMITE_FOSA = 300;

function Pastille({ couleur, children }) {
  return <span style={{ color: couleur, fontWeight: 700 }}>{children}</span>;
}

function Fiche({ titre, valeur, detail }) {
  return (
    <div style={{ border: "1px solid #d4d4d4", borderRadius: "8px", padding: "10px 14px", minWidth: "150px", flex: "1 1 150px" }}>
      <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>{valeur}</div>
      <div style={{ fontSize: "0.88rem" }}>{titre}</div>
      {detail && <div style={{ fontSize: "0.78rem", opacity: 0.65 }}>{detail}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Carte (Leaflet) limitee a la Mauritanie : un symbole par formation sanitaire.
// ---------------------------------------------------------------------------
const DOSSIER_GEO = ((import.meta.env && import.meta.env.BASE_URL) || "/") + "geo/";
const ZOOM_NOMS_MOUGHATAAS = 8;
const ZOOM_NOMS_FOSA = 10;

const CSS_CARTE = [
  ".gesmed-carte .symbole-fosa{background:none;border:none;}",
  ".gesmed-carte .symbole-fosa svg{display:block;transform:scale(var(--k,1));transform-origin:center;}",
  ".gesmed-carte .leaflet-tooltip.etiquette-fosa{display:none;background:rgba(255,255,255,0.92);border:1px solid #9aa5b1;border-radius:3px;color:#12355b;font-size:11px;font-weight:600;padding:1px 5px;box-shadow:none;}",
  ".gesmed-carte .leaflet-tooltip.etiquette-fosa:before{display:none;}",
  ".gesmed-carte.noms-fosa .leaflet-tooltip.etiquette-fosa{display:block;}",
  ".gesmed-carte .etiquette-zone{pointer-events:none;background:none;border:none;}",
  ".gesmed-carte .etiquette-zone span{position:absolute;transform:translate(-50%,-50%);white-space:nowrap;text-shadow:0 0 3px #fff,0 0 3px #fff,0 0 3px #fff,0 0 3px #fff;}",
  ".gesmed-carte .etiquette-wilaya span{color:#111827;font-weight:700;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;}",
  ".gesmed-carte .etiquette-moughataa{display:none;}",
  ".gesmed-carte .etiquette-moughataa span{color:#4b5563;font-weight:600;font-size:11px;}",
  ".gesmed-carte.noms-moughataas .etiquette-moughataa{display:block;}",
  ".gesmed-carte.noms-moughataas .etiquette-wilaya{display:none;}",
  ".zone-impression .only-print{display:none;}",
  "html.impression-carte .gesmed-carte{width:1040px !important;height:420px !important;}",
  "@page{size:A4 landscape;margin:10mm;}",
  "@media print{",
  "*{-webkit-print-color-adjust:exact;print-color-adjust:exact;}",
  "body *{visibility:hidden !important;}",
  ".zone-impression,.zone-impression *{visibility:visible !important;}",
  ".zone-impression{position:absolute;left:0;top:0;width:100%;}",
  ".zone-impression .no-print{display:none !important;}",
  ".zone-impression .only-print{display:block !important;}",
  ".zone-impression .gesmed-carte{height:420px !important;break-inside:avoid;}",
  ".zone-impression .leaflet-control-zoom{display:none !important;}",
  ".zone-impression .leaflet-control-layers{display:none !important;}",
  ".zone-impression table{font-size:10px;}",
  ".zone-impression tr{break-inside:avoid;}",
  "}",
].join("\n");

function injecterStyle() {
  if (typeof document === "undefined" || document.getElementById("gesmed-carte-css")) return;
  const s = document.createElement("style");
  s.id = "gesmed-carte-css";
  s.textContent = CSS_CARTE;
  document.head.appendChild(s);
}

function chargerGeo(nom) {
  return fetch(DOSSIER_GEO + nom).then((r) => {
    if (!r.ok) throw new Error("absent");
    return r.json();
  });
}

// Contours (wilayas : trait plein epais ; moughataas : trait fin pointille) + leurs noms.
function ajouterZones(L, carte, geo, type) {
  const wilaya = type === "wilaya";
  const couche = L.geoJSON(geo, {
    pane: "limites",
    interactive: false,
    style: wilaya ? { color: "#1f2937", weight: 2.4, fill: false } : { color: "#6b7280", weight: 1, dashArray: "4 3", fill: false },
  }).addTo(carte);
  couche.eachLayer((l) => {
    const nom = l.feature && l.feature.properties ? l.feature.properties.nom : "";
    if (!nom || !l.getBounds) return;
    L.marker(l.getBounds().getCenter(), {
      interactive: false,
      keyboard: false,
      icon: L.divIcon({ className: "etiquette-zone etiquette-" + type, html: "<span>" + echapper(nom) + "</span>", iconSize: [0, 0] }),
    }).addTo(carte);
  });
}

// Compare deux noms de zone sans tenir compte des accents, majuscules et espaces.
function normaliserNom(s) {
  return String(s === null || s === undefined ? "" : s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

// Equivalences connues entre l'ecriture de la base et celle du fichier de contours.
const ALIAS_ZONES = {
  nema: "moughataadenneama",
  enneama: "moughataadenneama",
  tidjikja: "tijigja",
  aioun: "eayouneelatrous",
  aiounelatrous: "eayouneelatrous",
  aiounelatroun: "eayouneelatrous",
};

function distanceNoms(a, b) {
  let prec = [];
  for (let j = 0; j <= b.length; j++) prec.push(j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur.push(Math.min(prec[j] + 1, cur[j - 1] + 1, prec[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)));
    }
    prec = cur;
  }
  return prec[b.length];
}

// Renvoie le nom (normalise) de la zone du fichier de contours qui correspond au nom choisi.
function trouverNomZone(features, nom) {
  const cible = normaliserNom(nom);
  if (!cible) return "";
  const noms = [];
  for (const f of features) {
    const x = normaliserNom(f.properties ? f.properties.nom : "");
    if (x && !noms.includes(x)) noms.push(x);
  }
  if (noms.includes(cible)) return cible;
  if (ALIAS_ZONES[cible] && noms.includes(ALIAS_ZONES[cible])) return ALIAS_ZONES[cible];
  const inclus = noms
    .filter((x) => (x.length >= 4 && cible.includes(x)) || (cible.length >= 5 && x.includes(cible)))
    .sort((a, b) => b.length - a.length);
  if (inclus.length) return inclus[0];
  let meilleur = "";
  let dMin = 99;
  let egalite = false;
  for (const x of noms) {
    const d = distanceNoms(cible, x);
    if (d < dMin) {
      dMin = d;
      meilleur = x;
      egalite = false;
    } else if (d === dMin) egalite = true;
  }
  const seuil = cible.length >= 8 ? 2 : 1;
  return !egalite && dMin <= seuil ? meilleur : "";
}

function Carte({ points, cleAjuste, selWilaya, selMoughataa, apiRef }) {
  const conteneur = useRef(null);
  const carteRef = useRef(null);
  const coucheRef = useRef(null);
  const limitesRef = useRef(null);
  const ajusteRef = useRef(false);
  const cleRef = useRef(null);
  const [pret, setPret] = useState(false);
  const [indisponible, setIndisponible] = useState(false);
  const geoRef = useRef(null);
  const selRef = useRef(null);
  const selCleRef = useRef("");
  const vueRef = useRef(null);
  const [geoPret, setGeoPret] = useState(false);

  // Impression : redimensionne la carte et la recadre sur ce que l'utilisateur voyait.
  function ajusterPourImpression() {
    const carte = carteRef.current;
    const L = typeof window !== "undefined" ? window.L : null;
    if (!carte || !L) return;
    if (!vueRef.current) vueRef.current = { centre: carte.getCenter(), zoom: carte.getZoom(), bornes: carte.getBounds() };
    carte.invalidateSize({ animate: false });
    carte.setMinZoom(carte.getBoundsZoom(L.latLngBounds(MR_LIMITES)));
    carte.fitBounds(vueRef.current.bornes, { padding: [4, 4], animate: false });
  }

  // Attend que le cadre soit a la bonne taille et que les fonds de carte soient affiches.
  function preparerImpression() {
    return new Promise((resolve) => {
      const el = conteneur.current;
      if (!carteRef.current || !el) {
        resolve();
        return;
      }
      requestAnimationFrame(() => requestAnimationFrame(() => {
        ajusterPourImpression();
        const debut = Date.now();
        const attendre = () => {
          const total = el.querySelectorAll("img.leaflet-tile").length;
          const restantes = el.querySelectorAll("img.leaflet-tile:not(.leaflet-tile-loaded)").length;
          const duree = Date.now() - debut;
          if ((total > 0 && restantes === 0) || (total === 0 && duree > 2000) || duree > 10000) setTimeout(resolve, 400);
          else setTimeout(attendre, 250);
        };
        setTimeout(attendre, 300);
      }));
    });
  }

  if (apiRef) apiRef.current = { preparerImpression };

  function ajuster() {
    const carte = carteRef.current;
    const el = conteneur.current;
    const L = typeof window !== "undefined" ? window.L : null;
    if (!carte || !el || !L) return;
    if (el.clientWidth > 0 && el.clientHeight > 0) {
      carte.invalidateSize();
      // Zoom minimum = le pays entier : impossible de s'eloigner de la Mauritanie.
      carte.setMinZoom(carte.getBoundsZoom(L.latLngBounds(MR_LIMITES)));
      if (!ajusteRef.current) {
        carte.fitBounds(limitesRef.current || L.latLngBounds(MR_LIMITES), { padding: [20, 20], maxZoom: 10 });
        ajusteRef.current = true;
      }
    }
  }

  // Les symboles grossissent avec le zoom ; les noms apparaissent a partir d'un certain zoom.
  function majZoom() {
    const carte = carteRef.current;
    const el = conteneur.current;
    if (!carte || !el) return;
    const z = carte.getZoom();
    const k = z >= 9 ? 1 : z >= 8 ? 0.85 : z >= 7 ? 0.7 : 0.55;
    el.style.setProperty("--k", String(k));
    el.classList.toggle("noms-moughataas", z >= ZOOM_NOMS_MOUGHATAAS);
    el.classList.toggle("noms-fosa", z >= ZOOM_NOMS_FOSA);
  }

  useEffect(() => {
    let vivant = true;
    let observateur = null;
    chargerLeaflet()
      .then((L) => {
        if (!vivant || !conteneur.current || carteRef.current) return;
        injecterStyle();
        const carte = L.map(conteneur.current, {
          preferCanvas: true,
          maxBounds: MR_LIMITES,
          maxBoundsViscosity: 1.0,
          minZoom: 5,
        }).fitBounds(MR_LIMITES);
        carte.createPane("limites");
        carte.getPane("limites").style.zIndex = 380;
        carte.getPane("limites").style.pointerEvents = "none";
        carte.createPane("selection");
        carte.getPane("selection").style.zIndex = 370;
        carte.getPane("selection").style.pointerEvents = "none";
        const optionsEsri = { maxNativeZoom: 16, maxZoom: 18, bounds: MR_LIMITES, attribution: "Tiles \u00a9 Esri \u2014 Esri, DeLorme, NAVTEQ, USGS, HERE" };
        const fondRelief = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}", optionsEsri);
        const fondRues = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", optionsEsri);
        const fondSatellite = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
          maxNativeZoom: 17,
          maxZoom: 18,
          bounds: MR_LIMITES,
          attribution: "Tiles \u00a9 Esri \u2014 Esri, Maxar, Earthstar Geographics",
        });
        const fondGris = L.layerGroup([
          L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
            maxNativeZoom: 16,
            maxZoom: 18,
            bounds: MR_LIMITES,
            attribution: "Tiles \u00a9 Esri \u2014 Esri, DeLorme, NAVTEQ",
          }),
          L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}", {
            maxNativeZoom: 16,
            maxZoom: 18,
            bounds: MR_LIMITES,
          }),
        ]);
        fondRues.addTo(carte);
        L.control.layers({ "Rues": fondRues, "Relief": fondRelief, "Satellite": fondSatellite, "Gris (ancien fond)": fondGris }, null, { position: "topright", collapsed: true }).addTo(carte);
        // Secours : si le fond moderne ne se charge pas, retour automatique a l'ancien fond gris.
        let erreursTuiles = 0;
        fondRues.on("tileerror", () => {
          erreursTuiles += 1;
          if (erreursTuiles === 8 && carte.hasLayer(fondRues)) {
            carte.removeLayer(fondRues);
            fondGris.addTo(carte);
          }
        });
        L.control.scale({ imperial: false, position: "bottomleft" }).addTo(carte);
        carteRef.current = carte;
        coucheRef.current = L.layerGroup().addTo(carte);
        carte.on("zoomend", majZoom);
        majZoom();
        if (typeof ResizeObserver !== "undefined") {
          observateur = new ResizeObserver(() => ajuster());
          observateur.observe(conteneur.current);
        }
        // Contours : s'ils sont absents, la carte fonctionne quand meme sans eux.
        Promise.all([chargerGeo("mr-wilayas.json"), chargerGeo("mr-moughataas.json")])
          .then(([w, m]) => {
            if (!vivant || carteRef.current !== carte) return;
            ajouterZones(L, carte, m, "moughataa");
            ajouterZones(L, carte, w, "wilaya");
            geoRef.current = { w, m };
            setGeoPret(true);
          })
          .catch(() => {});
        setPret(true);
      })
      .catch(() => {
        if (vivant) setIndisponible(true);
      });
    return () => {
      vivant = false;
      if (observateur) observateur.disconnect();
      if (carteRef.current) {
        carteRef.current.remove();
        carteRef.current = null;
        coucheRef.current = null;
        selRef.current = null;
        selCleRef.current = "";
        geoRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const L = typeof window !== "undefined" ? window.L : null;
    if (!pret || !L || !coucheRef.current) return;
    // La vue (zoom, position) n'est recadree que si le choix change, pas a chaque mise a jour automatique.
    if (cleRef.current !== cleAjuste) {
      cleRef.current = cleAjuste;
      ajusteRef.current = false;
    }
    coucheRef.current.clearLayers();
    const coordonnees = [];
    for (const p of points) {
      const t = p.type;
      L.marker([p.lat, p.lon], {
        icon: L.divIcon({
          className: "symbole-fosa",
          html: svgSymbole(t, p.couleur, t.taille),
          iconSize: [t.taille, t.taille],
          iconAnchor: [t.taille / 2, t.taille / 2],
        }),
      })
        .bindPopup(p.html)
        .bindTooltip(p.nom, { permanent: true, direction: "right", offset: [t.taille / 2 + 2, 0], className: "etiquette-fosa", opacity: 1 })
        .addTo(coucheRef.current);
      coordonnees.push([p.lat, p.lon]);
    }
    limitesRef.current = coordonnees.length ? L.latLngBounds(coordonnees) : null;
    ajuster();
  }, [pret, points, cleAjuste]);

  // Zone choisie dans les filtres : en vert, le reste en gris, et la vue se recadre sur elle.
  useEffect(() => {
    const L = typeof window !== "undefined" ? window.L : null;
    const carte = carteRef.current;
    if (!pret || !geoPret || !L || !carte || !geoRef.current) return;
    if (selRef.current) {
      carte.removeLayer(selRef.current);
      selRef.current = null;
    }
    if (!selWilaya && !selMoughataa) {
      selCleRef.current = "";
      return;
    }
    const parMoughataa = Boolean(selMoughataa);
    const geo = parMoughataa ? geoRef.current.m : geoRef.current.w;
    if (!geo || !Array.isArray(geo.features)) return;
    const choisi = trouverNomZone(geo.features, parMoughataa ? selMoughataa : selWilaya);
    if (!choisi) {
      console.warn("Carte : aucune zone du fichier de contours ne correspond a " + (parMoughataa ? selMoughataa : selWilaya));
      return;
    }
    const estCible = (f) => normaliserNom(f.properties ? f.properties.nom : "") === choisi;
    const groupe = L.layerGroup();
    L.geoJSON(geo, {
      pane: "selection",
      interactive: false,
      filter: (f) => !estCible(f),
      style: { stroke: false, fillColor: "#d1d5db", fillOpacity: 0.78 },
    }).addTo(groupe);
    const zone = L.geoJSON(geo, {
      pane: "selection",
      interactive: false,
      filter: estCible,
      style: { color: "#14532d", weight: 3, fillColor: "#7fc79a", fillOpacity: 0.4 },
    }).addTo(groupe);
    groupe.addTo(carte);
    selRef.current = groupe;
    const cle = (selWilaya || "") + "|" + (selMoughataa || "");
    const bornes = zone.getBounds();
    if (selCleRef.current !== cle && bornes.isValid()) {
      selCleRef.current = cle;
      carte.invalidateSize();
      carte.fitBounds(bornes, { padding: [20, 20], maxZoom: 10 });
    }
  }, [pret, geoPret, selWilaya, selMoughataa]);

  // Ctrl+P direct : la carte est preparee au mieux ; elle revient a sa vue apres l'impression.
  useEffect(() => {
    function avant() {
      if (!carteRef.current) return;
      document.documentElement.classList.add("impression-carte");
      ajusterPourImpression();
    }
    function apres() {
      setTimeout(() => {
        const carte = carteRef.current;
        if (!carte) return;
        carte.invalidateSize({ animate: false });
        if (vueRef.current) {
          carte.setView(vueRef.current.centre, vueRef.current.zoom, { animate: false });
          vueRef.current = null;
        }
      }, 200);
    }
    window.addEventListener("beforeprint", avant);
    window.addEventListener("afterprint", apres);
    return () => {
      window.removeEventListener("beforeprint", avant);
      window.removeEventListener("afterprint", apres);
    };
  }, []);

  if (indisponible) {
    return (
      <p style={{ padding: "12px", border: "1px dashed #b5b5b5", borderRadius: "8px" }}>
        Le fond de carte n'a pas pu &#xEA;tre charg&#xE9; (connexion Internet n&#xE9;cessaire). Le tableau ci-dessous reste disponible.
      </p>
    );
  }
  return <div ref={conteneur} className="gesmed-carte" style={{ height: "clamp(420px, 70vh, 720px)", width: "100%", borderRadius: "8px", border: "1px solid #c9c9c9" }} />;
}

// ---------------------------------------------------------------------------
// Contenu de l'ecran (exporte pour pouvoir etre teste sans reseau)
// `service` / `services` : couverture de l'offre ; `detail` : etat de chaque FOSA pour le service choisi.
// ---------------------------------------------------------------------------
export function Contenu({ donnees, couv, service, services, detail, onService, chargement, majLe }) {
  const [filtreWilaya, setFiltreWilaya] = useState("");
  const [filtreMoughataa, setFiltreMoughataa] = useState("");
  const [filtreType, setFiltreType] = useState("");
  const carteApi = useRef(null);

  // Impression : la carte prend la largeur de la page, puis revient a la normale.
  useEffect(() => {
    const fin = () => document.documentElement.classList.remove("impression-carte");
    window.addEventListener("afterprint", fin);
    return () => {
      window.removeEventListener("afterprint", fin);
      fin();
    };
  }, []);

  function imprimer() {
    document.documentElement.classList.add("impression-carte");
    const api = carteApi.current;
    const attente = api && api.preparerImpression ? api.preparerImpression() : new Promise((r) => setTimeout(r, 1500));
    attente.then(() => window.print());
  }

  const serviceIndispo = Boolean(couv) && !couv.data;

  const etatService = useMemo(() => {
    if (!service || !detail || !detail.data || detail.serviceId !== service.id) return null;
    const etat = new Map();
    for (const id of detail.data.horsEligibilite) etat.set(id, "hors");
    for (const id of detail.data.nonRenseignes) etat.set(id, "nr");
    for (const id of detail.data.nonOffrent) etat.set(id, "non");
    for (const id of detail.data.offrent) etat.set(id, "offre");
    return etat;
  }, [detail, service]);

  const listeMoughataas = useMemo(
    () => donnees.moughataas.filter((m) => !filtreWilaya || m.wilaya === filtreWilaya),
    [donnees, filtreWilaya]
  );

  const formationsZone = useMemo(
    () =>
      donnees.formations.filter(
        (f) => (!filtreWilaya || f.wilaya === filtreWilaya) && (!filtreMoughataa || f.moughataa === filtreMoughataa)
      ),
    [donnees, filtreWilaya, filtreMoughataa]
  );

  // Nombre de formations par type dans la zone choisie (avant le filtre par type).
  const comptesType = useMemo(() => {
    const cptType = {};
    for (const f of formationsZone) {
      const cle = typeDe(f.niveau).cle;
      cptType[cle] = (cptType[cle] || 0) + 1;
    }
    return cptType;
  }, [formationsZone]);

  const formations = useMemo(
    () => (filtreType ? formationsZone.filter((f) => typeDe(f.niveau).cle === filtreType) : formationsZone),
    [formationsZone, filtreType]
  );

  const { points, comptes, sansGps, horsPays } = useMemo(() => {
    const pts = [];
    const cpt = {};
    let sans = 0;
    let hors = 0;
    for (const f of formations) {
      const cle = etatService ? etatService.get(f.id) || "hors" : "nd";
      const type = typeDe(f.niveau);
      cpt[cle] = (cpt[cle] || 0) + 1;
      if (f.latitude === null || f.longitude === null) {
        sans++;
        continue;
      }
      if (!dansLePays(f.latitude, f.longitude)) {
        hors++;
        continue;
      }
      const e = LEGENDE_SERVICE.find((x) => x.cle === cle);
      pts.push({ id: f.id, nom: f.nom, type, lat: f.latitude, lon: f.longitude, couleur: e.couleur, html: contenuPopup(f, type, e) });
    }
    return { points: pts, comptes: cpt, sansGps: sans, horsPays: hors };
  }, [formations, etatService]);

  const nat = service ? service.national : null;

  // Un seul tableau, qui descend du pays vers la formation sanitaire selon le role.
  let mode = "fosa";
  if (donnees.portee === "NATIONAL") mode = filtreWilaya ? "moughataas" : "wilayas";
  else if (donnees.portee === "WILAYA") mode = "moughataas";

  function choisirWilaya(nom) {
    setFiltreWilaya(nom);
    setFiltreMoughataa("");
  }

  function celluleCouverture(v, cible, sansReponse) {
    if (sansReponse) return <Pastille couleur={GRIS}>{"Non renseign\u00e9"}</Pastille>;
    if (v === null || v === undefined) return "\u2014";
    if (cible === null || cible === undefined) return <strong>{pct(v)}</strong>;
    return <Pastille couleur={v >= cible ? VERT : ROUGE}>{pct(v)} {v >= cible ? "\u2713" : "\u2717"}</Pastille>;
  }

  function nomCellule(nom, sousTitre, surClic) {
    return (
      <td style={styleTdGauche}>
        <button type="button" style={styleLien} onClick={surClic} title="Voir sur la carte">{nom}</button>
        {sousTitre && <div style={{ fontSize: "0.78rem", opacity: 0.65 }}>{sousTitre}</div>}
      </td>
    );
  }

  function lignesService(liste, avecSousTitre, surClic) {
    return liste.map((l) => (
      <tr key={(l.drs || "") + "|" + l.nom}>
        {nomCellule(l.nom, avecSousTitre ? l.drs : null, () => surClic(l))}
        <td style={styleTd}>{l.totalFosa}</td>
        <td style={styleTd}>{l.eligibles}</td>
        <td style={styleTd}>{l.offrent}</td>
        <td style={styleTd}>{l.nonRenseignes}</td>
        <td style={styleTd}>{celluleCouverture(l.couvertureEligibles, service.ciblePct, l.eligibles > 0 && l.nonRenseignes >= l.eligibles)}</td>
      </tr>
    ));
  }

  function enTetesService(premier) {
    return (
      <tr>
        <th style={styleThGauche}>{premier}</th>
        <th style={styleTh}>FOSA</th>
        <th style={styleTh}>&#xC9;ligibles</th>
        <th style={styleTh}>Offrent le service</th>
        <th style={styleTh}>Non renseign&#xE9;es</th>
        <th style={styleTh}>Couverture</th>
      </tr>
    );
  }

  const titreTableau =
    mode === "wilayas" ? "Par wilaya" : mode === "moughataas" ? "Par moughataa" : "Par formation sanitaire";

  const criteres = [
    filtreWilaya ? "Wilaya : " + filtreWilaya : "",
    filtreMoughataa ? "Moughataa : " + filtreMoughataa : "",
    filtreType ? "Type : " + typeDe(filtreType).libelle : "",
  ].filter(Boolean);

  return (
    <div className="zone-impression">
      {service && (
        <div className="only-print" style={{ borderBottom: "2px solid #12355b", marginBottom: "8px", paddingBottom: "6px" }}>
          <div style={{ fontSize: "1.3rem", fontWeight: 700 }}>{"Carte des services \u2014 " + service.programme.nom + " \u2014 " + service.nom}</div>
          <div style={{ fontSize: "0.9rem" }}>
            {"P\u00e9rim\u00e8tre : " + donnees.libellePortee + (criteres.length ? " \u2014 " + criteres.join(" \u2014 ") : "")}
          </div>
          <div style={{ fontSize: "0.8rem", opacity: 0.75 }}>
            {"Imprim\u00e9 le " + new Date().toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })}
          </div>
        </div>
      )}
      <p className="no-print" style={{ fontSize: "0.88rem", opacity: 0.8, marginTop: 0 }}>
        P&#xE9;rim&#xE8;tre : {donnees.libellePortee}. Couverture = formations qui offrent le service &#xF7; formations &#xE9;ligibles au service.
      </p>

      {serviceIndispo && (
        <p style={{ fontSize: "0.88rem" }}>
          La couverture en service n'est pas disponible
          {couv.erreur ? " : " + String(couv.erreur).replace(/\.+\s*$/, "") : ""}.
        </p>
      )}

      <div className="no-print" style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "12px", alignItems: "center" }}>
        {services.length > 0 && (
          <label>
            Service :{" "}
            <select value={service ? service.id : ""} onChange={(e) => onService(e.target.value)} style={styleChamp}>
              {services.map((x) => (
                <option key={x.id} value={x.id}>{x.programme.nom} &#x2014; {x.nom}</option>
              ))}
            </select>
          </label>
        )}
        {donnees.wilayas.length > 1 && (
          <label>
            Wilaya :{" "}
            <select value={filtreWilaya} onChange={(e) => choisirWilaya(e.target.value)} style={styleChamp}>
              <option value="">Toutes les wilayas</option>
              {donnees.wilayas.map((w) => (
                <option key={w.nom} value={w.nom}>{w.nom}</option>
              ))}
            </select>
          </label>
        )}
        {listeMoughataas.length > 1 && (
          <label>
            Moughataa :{" "}
            <select value={filtreMoughataa} onChange={(e) => setFiltreMoughataa(e.target.value)} style={styleChamp}>
              <option value="">Toutes les moughataas</option>
              {listeMoughataas.map((m) => (
                <option key={m.wilaya + "|" + m.nom} value={m.nom}>{m.nom}</option>
              ))}
            </select>
          </label>
        )}
        <label>
          Type :{" "}
          <select value={filtreType} onChange={(e) => setFiltreType(e.target.value)} style={styleChamp}>
            <option value="">Tous les types</option>
            {TYPES.filter((t) => comptesType[t.cle] > 0).map((t) => (
              <option key={t.cle} value={t.cle}>{t.libelle} ({comptesType[t.cle]})</option>
            ))}
          </select>
        </label>
        {service && (
          <button type="button" onClick={imprimer} style={{ ...styleChamp, cursor: "pointer", fontWeight: 600 }}>
            Imprimer la carte
          </button>
        )}
      </div>

      {chargement && <p>Chargement&#x2026;</p>}

      {!service && !serviceIndispo && (couv ? <p>Aucun service actif &#xE0; afficher.</p> : <p>Chargement des services&#x2026;</p>)}

      {service && (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "14px" }}>
            <Fiche
              titre="Couverture du service"
              valeur={celluleCouverture(nat.couvertureEligibles, service.ciblePct, nat.eligibles > 0 && nat.nonRenseignes >= nat.eligibles)}
              detail={`${n(nat.offrent)} sur ${n(nat.eligibles)} formations \u00e9ligibles`}
            />
            <Fiche titre="Cible" valeur={service.ciblePct === null || service.ciblePct === undefined ? "\u2014" : `${n(service.ciblePct)} %`} />
            <Fiche titre={"Non renseign\u00e9es"} valeur={n(nat.nonRenseignes)} detail={"formations \u00e9ligibles sans r\u00e9ponse"} />
          </div>

          <h2 style={{ fontSize: "1.05rem", margin: "8px 0" }}>{`${service.programme.nom} \u2014 ${service.nom}`}</h2>

          <Carte
            points={points}
            cleAjuste={service.id + "|" + filtreWilaya + "|" + filtreMoughataa + "|" + filtreType}
            selWilaya={filtreWilaya}
            selMoughataa={filtreMoughataa}
            apiRef={carteApi}
          />

          <div style={{ margin: "10px 0 4px" }}>
            <div style={{ fontSize: "0.82rem", opacity: 0.75, marginBottom: "4px" }}>Forme = type de formation sanitaire</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "14px" }}>
              {TYPES.filter((t) => comptesType[t.cle] > 0).map((t) => (
                <span key={t.cle} style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.88rem" }}>
                  <Symbole type={t} couleur="#e5e7eb" taille={Math.min(t.taille, 20)} />
                  {t.libelle} : <strong>{comptesType[t.cle]}</strong>
                </span>
              ))}
            </div>
          </div>
          <div style={{ margin: "8px 0 6px" }}>
            <div style={{ fontSize: "0.82rem", opacity: 0.75, marginBottom: "4px" }}>Couleur = &#xE9;tat du service</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "14px" }}>
              {LEGENDE_SERVICE.filter((e) => e.cle !== "nd" || comptes.nd > 0).map((e) => (
                <span key={e.cle} style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.88rem" }}>
                  <span style={{ width: "14px", height: "14px", borderRadius: "3px", background: e.couleur, border: "1px solid " + MARINE }} />
                  {e.libelle} : <strong>{comptes[e.cle] || 0}</strong>
                </span>
              ))}
            </div>
          </div>
          <p style={{ fontSize: "0.82rem", opacity: 0.75, marginTop: 0 }}>
            Zoomez pour afficher les limites des moughataas puis les noms des formations sanitaires. {points.length} formation(s) sur la carte
            {sansGps > 0 ? `, ${sansGps} sans coordonn\u00e9es GPS` : ""}
            {horsPays > 0 ? `, ${horsPays} avec des coordonn\u00e9es situ\u00e9es hors de la Mauritanie (\u00e0 corriger)` : ""}.
            {" "}Mise &#xE0; jour automatique toutes les minutes
            {majLe ? ` (derni\u00e8re mise \u00e0 jour \u00e0 ${majLe.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })})` : ""}.
          </p>

          <h2 style={{ fontSize: "1.05rem", margin: "18px 0 8px" }}>
            {titreTableau}
            {filtreWilaya && donnees.portee === "NATIONAL" && (
              <>
                {" "}&#x2014; {filtreWilaya}{" "}
                <button type="button" style={{ ...styleLien, fontSize: "0.85rem", fontWeight: 400 }} onClick={() => choisirWilaya("")}>
                  Revenir &#xE0; tout le pays
                </button>
              </>
            )}
          </h2>

          {mode === "wilayas" && (
            <div style={{ overflowX: "auto" }}>
              <table style={styleTableau}>
                <thead>{enTetesService("Wilaya")}</thead>
                <tbody>{lignesService(service.parDrs, false, (l) => choisirWilaya(l.nom))}</tbody>
              </table>
            </div>
          )}

          {mode === "moughataas" && (
            <div style={{ overflowX: "auto" }}>
              <table style={styleTableau}>
                <thead>{enTetesService("Moughataa")}</thead>
                <tbody>
                  {lignesService(
                    service.parMoughataa.filter((m) => !filtreWilaya || m.drs === filtreWilaya),
                    donnees.portee !== "NATIONAL",
                    (l) => {
                      setFiltreWilaya(l.drs);
                      setFiltreMoughataa(l.nom);
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}

          {mode === "fosa" && (
            <>
              <p style={{ fontSize: "0.85rem", opacity: 0.75, marginTop: 0 }}>
                {formations.length} formation(s)
                {formations.length > LIMITE_FOSA ? ` (les ${LIMITE_FOSA} premi\u00e8res sont affich\u00e9es)` : ""}.
              </p>
              <div style={{ overflowX: "auto" }}>
                <table style={styleTableau}>
                  <thead>
                    <tr>
                      <th style={styleThGauche}>Formation sanitaire</th>
                      <th style={styleThGauche}>Type</th>
                      <th style={styleThGauche}>Service</th>
                    </tr>
                  </thead>
                  <tbody>
                    {formations.slice(0, LIMITE_FOSA).map((f) => {
                      const e = LEGENDE_SERVICE.find((x) => x.cle === (etatService ? etatService.get(f.id) || "hors" : "nd"));
                      return (
                        <tr key={f.id}>
                          <td style={styleTdGauche}>{f.nom}</td>
                          <td style={styleTdGauche}>{typeDe(f.niveau).libelle}</td>
                          <td style={styleTdGauche}>
                            <Pastille couleur={e.couleur}>{e.libelle}</Pastille>
                          </td>
                        </tr>
                      );
                    })}
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

export default function CarteStock({ onRetour }) {
  const [donnees, setDonnees] = useState(null);
  const [couv, setCouv] = useState(null);
  const [serviceId, setServiceId] = useState("");
  const [detail, setDetail] = useState(null);
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(true);
  const [majLe, setMajLe] = useState(null);
  const [tick, setTick] = useState(0);
  const sigDonnees = useRef("");
  const sigCouv = useRef("");

  const services = couv && couv.data ? couv.data.services : [];
  const service = services.find((x) => x.id === serviceId) || services[0] || null;
  const serviceCourant = service ? service.id : "";

  // Mise a jour automatique : toutes les minutes, et au retour sur l'onglet.
  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) setTick((t) => t + 1);
    }, 60000);
    const retour = () => {
      if (!document.hidden) setTick((t) => t + 1);
    };
    document.addEventListener("visibilitychange", retour);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", retour);
    };
  }, []);

  // Positions et noms des formations sanitaires : rechargees toutes les 5 minutes.
  const tickLent = Math.floor(tick / 5);
  useEffect(() => {
    let annule = false;
    appeler("/stocks/carte")
      .then((d) => {
        if (annule) return;
        const sig = JSON.stringify(d);
        if (sig !== sigDonnees.current) {
          sigDonnees.current = sig;
          setDonnees(d);
        }
        setErreur("");
      })
      .catch((e) => {
        if (!annule && !sigDonnees.current) setErreur(e.message);
      })
      .finally(() => {
        if (!annule) setChargement(false);
      });
    return () => {
      annule = true;
    };
  }, [tickLent]);

  // Couverture en service et etat de chaque formation pour le service choisi : chaque minute.
  useEffect(() => {
    let annule = false;
    appeler("/couverture-offre" + (serviceCourant ? `?serviceId=${encodeURIComponent(serviceCourant)}` : ""))
      .then((d) => {
        if (annule) return;
        const sig = JSON.stringify({ ...d, genereLe: null }) + "|" + serviceCourant;
        if (sig !== sigCouv.current) {
          sigCouv.current = sig;
          setCouv({ data: d });
          setDetail(d.detail ? { serviceId: serviceCourant, data: d.detail } : null);
        }
        setMajLe(new Date());
      })
      .catch((e) => {
        if (!annule && !sigCouv.current) setCouv({ data: null, erreur: e.message });
      });
    return () => {
      annule = true;
    };
  }, [serviceCourant, tick]);

  return (
    <div className="admin-page" style={{ textAlign: "left" }}>
      <header className="admin-header">
        <button className="admin-retour" onClick={onRetour}>&#x2190; Retour</button>
        <h1>Carte des services</h1>
      </header>

      {erreur && <p className="admin-erreur" role="alert">{erreur}</p>}
      {chargement && !donnees && <p>Chargement de la carte&#x2026;</p>}
      {donnees && (
        <Contenu
          donnees={donnees}
          couv={couv}
          service={service}
          services={services}
          detail={detail}
          onService={setServiceId}
          chargement={chargement}
          majLe={majLe}
        />
      )}
    </div>
  );
}