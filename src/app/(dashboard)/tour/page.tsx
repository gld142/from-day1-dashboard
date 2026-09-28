"use client";

import { TourView } from "@/components/modules/croissance/tour-view";
import { CustomerTour } from "@/components/modules/customer/customer-tour";
import { useCustomer } from "@/lib/customer-mode";

/** Mode client : les concerts saisis dans l'espace ; sinon la démo, intacte. */
export default function Page() {
  return useCustomer() ? <CustomerTour /> : <TourView />;
}
