import { useState } from "react";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import NouvelleRequisition from "./pages/NouvelleRequisition";
import ValidationRequisitions from "./pages/ValidationRequisitions";
import StockReseau from "./pages/StockReseau";
import EnregistrerDispensation from "./pages/EnregistrerDispensation";
import ConfirmerReception from "./pages/ConfirmerReception";
import EnregistrerRentreeCamec from "./pages/EnregistrerRentreeCamec";
import InventairePhysique from "./pages/InventairePhysique";

function App() {
  const [session, setSession] = useState(null);
  const [vue, setVue] = useState("dashboard");

  function handleLoginSuccess(data) {
    setSession(data);
    setVue("dashboard");
  }

  function handleLogout() {
    localStorage.removeItem("gesmed_token");
    setSession(null);
  }

  if (!session) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  if (vue === "nouvelle-requisition") return <NouvelleRequisition onRetour={() => setVue("dashboard")} />;
  if (vue === "validation-requisitions") return <ValidationRequisitions onRetour={() => setVue("dashboard")} />;
  if (vue === "stock-reseau") return <StockReseau onRetour={() => setVue("dashboard")} />;
  if (vue === "dispensation") return <EnregistrerDispensation onRetour={() => setVue("dashboard")} />;
  if (vue === "reception") return <ConfirmerReception onRetour={() => setVue("dashboard")} />;
  if (vue === "rentree-camec") return <EnregistrerRentreeCamec onRetour={() => setVue("dashboard")} />;
  if (vue === "inventaire-physique") return <InventairePhysique onRetour={() => setVue("dashboard")} />;

  return (
    <Dashboard
      session={session}
      onLogout={handleLogout}
      onNouvelleRequisition={() => setVue("nouvelle-requisition")}
      onValidationRequisitions={() => setVue("validation-requisitions")}
      onStockReseau={() => setVue("stock-reseau")}
      onDispensation={() => setVue("dispensation")}
      onReception={() => setVue("reception")}
      onRentreeCamec={() => setVue("rentree-camec")}
      onInventairePhysique={() => setVue("inventaire-physique")}
    />
  );
}

export default App;