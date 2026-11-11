import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
} from "react-router-dom";

import type { Participant } from "./types/Participant";
import ParticipantPage from "./components/ParticipantPage";
import PoolPage from "./components/PoolPage";
import FightListPage from "./components/FightListPage";
import { useState } from "react";

function App() {

  const [participants, setParticipants] =
  useState<Participant[]>([]);

  const [poolSystems, setPoolSystems] = useState<
    Record<string, "POOL" | "KO">
  >({});

  const [generatedPools, setGeneratedPools] =
  useState<Record<string, Participant[][]>>({});


  return (
    <BrowserRouter>
      <header className="app-header">
        <div className="container-xxl app-header-inner">
          <NavLink className="app-brand" to="/" end>
            <span>
              <strong>Judo</strong>
              <small>Wettkampfleitung</small>
            </span>
          </NavLink>

          <nav className="app-nav nav" aria-label="Hauptnavigation">
            <NavLink className={({ isActive }) => `nav-link${isActive ? " active" : ""}`} to="/" end>
              Teilnehmer
            </NavLink>
            <NavLink className={({ isActive }) => `nav-link${isActive ? " active" : ""}`} to="/pools">
              Pools
            </NavLink>
            <NavLink className={({ isActive }) => `nav-link${isActive ? " active" : ""}`} to="/fightlists">
              Kampflisten
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="container-xxl app-main">
        <Routes>
          <Route
            path="/"
            element={
              <ParticipantPage
                participants={participants}
                setParticipants={setParticipants}
              />
            }
          />

          <Route
            path="/pools"
            element={
              <PoolPage
                participants={participants}
                poolSystems={poolSystems}
                setPoolSystems={setPoolSystems}
                setGeneratedPools={setGeneratedPools}
              />
            }
          />

          <Route
            path="/fightlists"
            element={
              <FightListPage
                poolSystems={poolSystems}
                generatedPools={generatedPools}
              />
            }
          />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

export default App;