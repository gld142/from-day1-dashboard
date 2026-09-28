"use client";

import { CatalogView } from "@/components/modules/croissance/catalog-view";
import { CustomerCatalog } from "@/components/modules/customer/customer-catalog";
import { useCustomer } from "@/lib/customer-mode";

/** Mode client : le catalogue des relevés importés ; sinon la démo, intacte. */
export default function Page() {
  return useCustomer() ? <CustomerCatalog /> : <CatalogView />;
}
