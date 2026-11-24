import { useState } from "react";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import NouvelleRequisition from "./pages/NouvelleRequisition";
import ValidationRequisitions from "./pages/ValidationRequisitions";
import AnnulationsAValider from "./pages/AnnulationsAValider";
import StockReseau from "./pages/StockReseau";
import EnregistrerDispensation from "./pages/EnregistrerDispensation";
import ConfirmerReception from "./pages/ConfirmerReception";
import EnregistrerRentreeCamec from "./pages/EnregistrerRentreeCamec";
import InventairePhysique from "./pages/InventairePhysique";
import CommanderReapprovisionnement from "./pages/CommanderReapprovisionnement";
import Notifications from "./pages/Notifications";
import SuiviRequisitions from "./pages/SuiviRequisitions";
import AdminPanel from "./pages/AdminPanel";
import Rapports from "./pages/Rapports";
import Ecarts from "./pages/Ecarts";
import RechercheDossier from "./pages/RechercheDossier";
import Verrouillage from "./pages/Verrouillage";
import EquipeDrs from "./pages/EquipeDrs";
import JournalEquipe from "./pages/JournalEquipe";
import ChangerMotDePasse from "./pages/ChangerMotDePasse";
import MesServices from "./pages/MesServices";
import Destructions from "./pages/Destructions";
import CouvertureOffre from "./pages/CouvertureOffre"; // couverture offre
import ExpeditionsAxes from "./pages/ExpeditionsAxes"; // expeditions axes
import MonAxe from "./pages/MonAxe"; // mon axe
import ConfigurationOffre from "./pages/ConfigurationOffre"; // config offre
import CarteStock from "./pages/CarteStock"; // carte stock
import { OuvertureUnique, BarreOuverture } from "./ouvertureUnique.jsx";
import "./largeur-unique.css";
import { LangueProvider } from "./i18n.jsx";

function App() {
  const [session, setSession] = useState(null);
  // vueAffichee : l'écran actuellement visible. vueCible : l'écran demandé, chargé en cachette.
  const [vueAffichee, setVueAffichee] = useState("dashboard");
  const [vueCible, setVueCible] = useState("dashboard");
  const [ouvertureInitialeFaite, setOuvertureInitialeFaite] = useState(false);

  function handleLoginSuccess(data) {
    setSession(data);
    setVueAffichee("dashboard");
    setVueCible("dashboard");
    setOuvertureInitialeFaite(false);
  }

  function handleLogout() {
    localStorage.removeItem("SYGIMS_token");
    setSession(null);
    setVueAffichee("dashboard");
    setVueCible("dashboard");
    setOuvertureInitialeFaite(false);
  }

  const ouvrir = (vue) => setVueCible(vue);
  const retour = () => ouvrir("dashboard");

  function rendre(vue) {
    if (vue === "nouvelle-requisition") return <NouvelleRequisition onRetour={retour} />;
    if (vue === "validation-requisitions") return <ValidationRequisitions session={session} onRetour={retour} />;
    if (vue === "annulations-a-valider") return <AnnulationsAValider session={session} onRetour={retour} />;
    if (vue === "stock-reseau") return <StockReseau onRetour={retour} />;
    if (vue === "dispensation") return <EnregistrerDispensation session={session} onRetour={retour} />;
    if (vue === "reception") return <ConfirmerReception onRetour={retour} />;
    if (vue === "rentree-camec") return <EnregistrerRentreeCamec session={session} onRetour={retour} />;
    if (vue === "inventaire-physique") return <InventairePhysique session={session} onRetour={retour} />;
    if (vue === "reapprovisionnement") return <CommanderReapprovisionnement onRetour={retour} />;
    if (vue === "notifications") return <Notifications session={session} onRetour={retour} />;
    if (vue === "suivi-requisitions") return <SuiviRequisitions onRetour={retour} />;
    if (vue === "admin") return <AdminPanel onRetour={retour} />;
    if (vue === "rapports") return <Rapports session={session} onRetour={retour} />;
    if (vue === "ecarts") return <Ecarts onRetour={retour} />;
    if (vue === "recherche-dossier") return <RechercheDossier onRetour={retour} />;
    if (vue === "verrouillage") return <Verrouillage session={session} onRetour={retour} />;
    if (vue === "equipe") return <EquipeDrs onRetour={retour} />;
    if (vue === "journal-equipe") return <JournalEquipe onRetour={retour} />;
    if (vue === "mot-de-passe") return <ChangerMotDePasse onRetour={retour} />;
    if (vue === "mes-services") return <MesServices onRetour={retour} />;
    if (vue === "destructions") return <Destructions session={session} onRetour={retour} />;
    if (vue === "couverture-offre") return <CouvertureOffre onRetour={retour} />; // couverture offre
    if (vue === "expeditions-axes") return <ExpeditionsAxes onRetour={retour} />; // expeditions axes
    if (vue === "mon-axe") return <MonAxe onRetour={retour} />; // mon axe
    if (vue === "configuration-offre") return <ConfigurationOffre onRetour={retour} />; // config offre
    if (vue === "carte-stock") return <CarteStock onRetour={retour} />; // carte stock

    return (
      <Dashboard
        session={session}
        onLogout={handleLogout}
        onNouvelleRequisition={() => ouvrir("nouvelle-requisition")}
        onValidationRequisitions={() => ouvrir("validation-requisitions")}
        onAnnulationsAValider={() => ouvrir("annulations-a-valider")}
        onStockReseau={() => ouvrir("stock-reseau")}
        onDispensation={() => ouvrir("dispensation")}
        onReception={() => ouvrir("reception")}
        onRentreeCamec={() => ouvrir("rentree-camec")}
        onInventairePhysique={() => ouvrir("inventaire-physique")}
        onReapprovisionnement={() => ouvrir("reapprovisionnement")}
        onNotifications={() => ouvrir("notifications")}
        onSuiviRequisitions={() => ouvrir("suivi-requisitions")}
        onAdmin={() => ouvrir("admin")}
        onRapports={() => ouvrir("rapports")}
        onEcarts={() => ouvrir("ecarts")}
        onRechercheDossier={() => ouvrir("recherche-dossier")}
        onVerrouillage={() => ouvrir("verrouillage")}
        onEquipe={() => ouvrir("equipe")}
        onJournalEquipe={() => ouvrir("journal-equipe")}
        onChangerMotDePasse={() => ouvrir("mot-de-passe")}
        onMesServices={() => ouvrir("mes-services")}
        onDestructions={() => ouvrir("destructions")}
        onCouvertureOffre={() => ouvrir("couverture-offre")} // couverture offre
        onExpeditionsAxes={() => ouvrir("expeditions-axes")} // expeditions axes
        onMonAxe={() => ouvrir("mon-axe")} // mon axe
        onConfigurationOffre={() => ouvrir("configuration-offre")} // config offre
        onCarteStock={() => ouvrir("carte-stock")} // carte stock
      />
    );
  }

  function finirOuverture(vue) {
    setVueAffichee(vue);
    setOuvertureInitialeFaite(true);
  }

  const enTransition = vueAffichee !== vueCible;

  // L'écran précédent reste monté (donc visible) pendant que le nouveau se charge en cachette.
  const ecrans = [];
  if (session) {
    if (enTransition) {
      ecrans.push(
        <OuvertureUnique key={vueAffichee} onPret={() => {}}>
          {rendre(vueAffichee)}
        </OuvertureUnique>
      );
    }
    ecrans.push(
      <OuvertureUnique key={vueCible} onPret={() => finirOuverture(vueCible)}>
        {rendre(vueCible)}
      </OuvertureUnique>
    );
  }

  return (
    <LangueProvider role={session && session.utilisateur ? session.utilisateur.role : null}>
    <>
      {!session || !ouvertureInitialeFaite ? <Login onLoginSuccess={handleLoginSuccess} /> : null}
      {ecrans}
      {session && (!ouvertureInitialeFaite || enTransition) ? <BarreOuverture /> : null}
    </>
    </LangueProvider>
  );
}

export default App;