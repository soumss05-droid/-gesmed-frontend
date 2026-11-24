import { useEffect, useRef, useState } from "react";

// Suivi des requêtes réseau en cours : permet de savoir quand une page a fini de charger,
// sans modifier chaque page. Le suivi n'altère ni les réponses ni les erreurs de fetch.
let enCours = 0;
const ecouteurs = new Set();

function notifier() {
  ecouteurs.forEach((f) => f());
}

if (typeof window !== "undefined" && !window.__sygimsFetchSuivi) {
  window.__sygimsFetchSuivi = true;
  const fetchOriginal = window.fetch.bind(window);
  window.fetch = function (...args) {
    enCours += 1;
    notifier();
    let promesse;
    try {
      promesse = fetchOriginal(...args);
    } catch (erreur) {
      enCours -= 1;
      notifier();
      throw erreur;
    }
    const fin = () => {
      enCours -= 1;
      notifier();
    };
    promesse.then(fin, fin);
    return promesse;
  };
}

const DELAI_CALME = 200; // aucune requête pendant 200 ms : la page est prête
const DELAI_MAX = 8000; // sécurité : on affiche quand même après 8 secondes

const styleCache = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100%",
  height: "100vh",
  overflow: "hidden",
  visibility: "hidden",
  pointerEvents: "none",
};

// Monte la page en cachette, puis la révèle d'un seul coup quand ses données sont arrivées.
export function OuvertureUnique({ onPret, children }) {
  const [pret, setPret] = useState(false);
  const onPretRef = useRef(onPret);
  onPretRef.current = onPret;

  useEffect(() => {
    let termine = false;
    let minuteur = null;
    let garde = null;

    function nettoyer() {
      clearTimeout(minuteur);
      clearTimeout(garde);
      ecouteurs.delete(verifier);
    }

    function terminer() {
      if (termine) return;
      termine = true;
      nettoyer();
      setPret(true);
      if (onPretRef.current) onPretRef.current();
    }

    function verifier() {
      if (termine) return;
      clearTimeout(minuteur);
      if (enCours === 0) minuteur = setTimeout(terminer, DELAI_CALME);
    }

    ecouteurs.add(verifier);
    garde = setTimeout(terminer, DELAI_MAX);
    verifier();

    return () => {
      termine = true;
      nettoyer();
    };
  }, []);

  return <div style={pret ? { display: "contents" } : styleCache}>{children}</div>;
}

// Fine barre en haut + bouclier transparent : l'ancien écran reste visible mais inactif.
export function BarreOuverture() {
  return (
    <>
      <div style={{ position: "fixed", inset: 0, zIndex: 9998, cursor: "progress", background: "transparent" }} />
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          background: "#1f2937",
          color: "#fff",
          textAlign: "center",
          padding: "6px 0",
          fontSize: 14,
        }}
      >
        Ouverture…
      </div>
    </>
  );
}