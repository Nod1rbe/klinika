import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Appointments from "./pages/Appointments";
import AuditLog from "./pages/AuditLog";
import CashSession from "./pages/CashSession";
import Cashier from "./pages/Cashier";
import Dashboard from "./pages/Dashboard";
import Doctor from "./pages/Doctor";
import HR from "./pages/HR";
import Laboratory from "./pages/Laboratory";
import Login from "./pages/Login";
import PatientDetail from "./pages/PatientDetail";
import Patients from "./pages/Patients";
import Pos from "./pages/Pos";
import Registration from "./pages/Registration";
import Sales from "./pages/Sales";
import Warehouse from "./pages/Warehouse";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Tenants from "./pages/Tenants";
import { StoreProvider, useStore } from "./store";
import type { Role } from "./types";

const ROLE_HOME: Record<Role, string> = {
  superadmin: "/klinikalar",
  direktor: "/",
  registratura: "/bemorlar",
  shifokor: "/shifokor",
  hisobchi: "/kassa",
  laborant: "/laboratoriya",
  omborchi: "/ombor",
};

// "/" — direktor/hisobchi uchun dashboard; qolgan rollar o'z bosh sahifasiga yo'naladi
function Home() {
  const { role } = useStore();
  if (role === "direktor" || role === "hisobchi") return <Dashboard />;
  return <Navigate to={ROLE_HOME[role]} replace />;
}

function Gate() {
  const { authState } = useStore();

  if (authState === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">
        Yuklanmoqda...
      </div>
    );
  }
  if (authState === "signedOut") return <Login />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/registratsiya" element={<Registration />} />
        <Route path="/bemorlar" element={<Patients />} />
        <Route path="/bemorlar/:id" element={<PatientDetail />} />
        <Route path="/qabullar" element={<Appointments />} />
        <Route path="/kassa" element={<Cashier />} />
        <Route path="/shifokor" element={<Doctor />} />
        <Route path="/laboratoriya" element={<Laboratory />} />
        <Route path="/xodimlar" element={<HR />} />
        <Route path="/hisobotlar" element={<Reports />} />
        <Route path="/audit" element={<AuditLog />} />
        <Route path="/sozlamalar" element={<Settings />} />
        <Route path="/klinikalar" element={<Tenants />} />
        <Route path="/pos" element={<Pos />} />
        <Route path="/sotuvlar" element={<Sales />} />
        <Route path="/smena" element={<CashSession />} />
        <Route path="/ombor" element={<Warehouse />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <HashRouter>
        <Gate />
      </HashRouter>
    </StoreProvider>
  );
}
