import AdminImport from "./pages/AdminImport";
import { BrowserRouter, Routes, Route } from "react-router-dom";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* secret admin route */}
        <Route path="/" element={<AdminImport />} />
      </Routes>
    </BrowserRouter>
  );
}
