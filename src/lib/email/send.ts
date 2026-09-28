/**
 * Envoi d'emails via Resend (même service que le site from-day1.com), par son API HTTP.
 * Sans RESEND_API_KEY : en développement, l'email est écrit dans les journaux du
 * serveur (on peut tester les liens sans rien envoyer) ; en production, erreur.
 */
export type Email = { to: string; subject: string; html: string; text: string };

export async function sendEmail(email: Email): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!key || !from) {
    if (process.env.NODE_ENV === "production") throw new Error("RESEND_API_KEY / RESEND_FROM_EMAIL manquants");
    console.info(`\n[email non envoyé — Resend pas configuré]\nÀ : ${email.to}\nObjet : ${email.subject}\n${email.text}\n`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to: [email.to], subject: email.subject, html: email.html, text: email.text }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status} : ${(await res.text()).slice(0, 200)}`);
}
