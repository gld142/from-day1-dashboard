"use client";

import dynamic from "next/dynamic";

/** Le parcours lit son brouillon dans localStorage dès le premier rendu : jamais rendu côté serveur. */
export const FlowClient = dynamic(() => import("./purchase-flow").then((m) => m.PurchaseFlow), { ssr: false });
