import React, { useState, useCallback } from "react";
import { Nav, Hero, Ticker, ComoFunciona } from "./components/Site.jsx";
import { Pricing, Sobre, Unidades, Contato, Footer } from "./components/Sections.jsx";
import { Reservar } from "./components/Reservar.jsx";

export default function App() {
  const [wiz, setWiz] = useState({ open: false, size: null, unitId: null });
  const openReserve = useCallback((opts = {}) => setWiz({ open: true, size: opts.size || null, unitId: opts.unitId || null }), []);
  const closeReserve = useCallback(() => setWiz((w) => ({ ...w, open: false })), []);

  return (
    <>
      <Nav onReserve={openReserve} />
      <main>
        <Hero onReserve={openReserve} />
        <Ticker />
        <ComoFunciona onReserve={openReserve} />
        <Pricing onReserve={openReserve} />
        <Unidades onReserve={openReserve} />
        <Sobre />
        <Contato />
      </main>
      <Footer onReserve={openReserve} />
      <Reservar open={wiz.open} initialSize={wiz.size} initialUnitId={wiz.unitId} onClose={closeReserve} />
    </>
  );
}
