import AdminImport from "./pages/AdminImport";
import { BrowserRouter, Routes, Route } from "react-router-dom";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* secret admin route */}
        <Route path="/panel/9f3k2p7x" element={<AdminImport />} />
      </Routes>
    </BrowserRouter>
  );
}
