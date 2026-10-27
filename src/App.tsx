import {
  BrowserRouter,
  Routes,
  Route,
  Link,
} from "react-router-dom";

import ParticipantPage from "./components/ParticipantPage";
import PoolPage from "./components/PoolPage";
import FightListPage from "./components/FightListPage";

function App() {
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
          element={<ParticipantPage />}
        />

        <Route
          path="/pools"
          element={<PoolPage />}
        />

        <Route
          path="/fightlists"
          element={<FightListPage />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;