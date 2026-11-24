import { useState } from "react";
import { OuvertureUnique, BarreOuverture } from "../ouvertureUnique";
import FicheSituation from "./FicheSituation";

// Ouvre la Fiche de situation d'un seul coup : montee cachee, revelee quand ses donnees sont arrivees.
export default function FicheOuverture({ session }) {
  const [pret, setPret] = useState(false);

  return (
    <>
      {!pret && <BarreOuverture />}
      <OuvertureUnique onPret={() => setPret(true)}>
        <FicheSituation session={session} />
      </OuvertureUnique>
    </>
  );
}