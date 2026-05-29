import { Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import { Layout } from "./components/layout";
export const SESSIONS = "session";

const App = () => {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />}></Route>
      </Routes>
    </Layout>
  )
}

export default App