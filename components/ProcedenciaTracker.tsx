"use client";

import { useEffect } from "react";
import { registrarLlegada } from "@/lib/entrada/procedencia-cliente";

export default function ProcedenciaTracker() {
  useEffect(registrarLlegada, []);
  return null;
}
