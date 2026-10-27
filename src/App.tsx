import {
  BrowserRouter,
  Routes,
  Route,
  Link,
} from "react-router-dom";

import type { Participant } from "./types/Participant";
import ParticipantPage from "./components/ParticipantPage";
import PoolPage from "./components/PoolPage";
import FightListPage from "./components/FightListPage";
import { useState } from "react";

function App() {

  const [participants, setParticipants] =
  useState<Participant[]>([]);

  return (
    <BrowserRouter>
      <nav>
        <Link to="/">
          Teilnehmer
        </Link>

        {" | "}

        <Link to="/pools">
          Pools
        </Link>

        {" | "}

        <Link to="/fightlists">
          Kampflisten
        </Link>
      </nav>

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
            />
          }
        />

        <Route
          path="/fightlists"
          element={
            <FightListPage
              participants={participants}
            />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;