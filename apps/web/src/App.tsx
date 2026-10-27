import { Route, Routes } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { WorkspacePage } from "./pages/WorkspacePage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/r/:id" element={<WorkspacePage />} />
    </Routes>
  );
}
