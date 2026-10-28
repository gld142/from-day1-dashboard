import { PageIntlProvider } from "@/i18n/intl-providers";
import FeedView from "./feed-view";

/**
 * /fil — le fil entre services. Page SERVEUR : elle n'existe que pour envelopper la vue client
 * (`feed-view.tsx`) dans `PageIntlProvider`, qui ajoute aux messages racine le namespace de page
 * `filpage` (statuts, réponses, mentions, prise en charge, ordre du jour). Ces textes ne partent
 * qu'avec /fil, jamais avec /connexion, /inscription ou /acces (messages/index.ts).
 */
export default function FeedPage() {
  return (
    <PageIntlProvider namespaces={["filpage"]}>
      <FeedView />
    </PageIntlProvider>
  );
}
