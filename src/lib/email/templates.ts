import type { Email } from "./send";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function layout(title: string, body: string, cta: { label: string; href: string }, foot: string) {
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#0B0A12;padding:40px 16px;font-family:system-ui,-apple-system,sans-serif;color:#FAFAFE">
<table role="presentation" width="100%" style="max-width:480px;margin:0 auto"><tr><td>
<p style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#b6b3ff;margin:0 0 24px">Day 1 Pro</p>
<h1 style="font-size:22px;margin:0 0 12px">${esc(title)}</h1>
<p style="font-size:15px;line-height:1.6;color:rgba(250,250,254,.75);margin:0 0 28px">${body}</p>
<a href="${esc(cta.href)}" style="display:inline-block;background:#7B5CF0;color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 28px;border-radius:999px">${esc(cta.label)}</a>
<p style="font-size:12px;line-height:1.6;color:rgba(250,250,254,.45);margin:32px 0 0">${foot}</p>
</td></tr></table></body></html>`;
}

export function loginEmail(to: string, link: string): Email {
  return {
    to,
    subject: "Ton lien de connexion Day 1 Pro",
    html: layout("Connexion à Day 1 Pro", "Clique sur le bouton pour ouvrir ton espace. Le lien marche une seule fois, pendant une heure.",
      { label: "Ouvrir mon espace", href: link }, "Tu n'as rien demandé ? Ignore cet email, personne ne peut entrer sans ce lien."),
    text: `Connexion à Day 1 Pro\n\nOuvre ce lien (une seule fois, pendant une heure) :\n${link}\n\nTu n'as rien demandé ? Ignore cet email.`,
  };
}

export function inviteEmail(to: string, link: string, workspace: string, role: "member" | "artist"): Email {
  const what = role === "artist" ? "suivre tes chiffres d'artiste" : "rejoindre l'équipe";
  return {
    to,
    subject: `Invitation à l'espace ${workspace} sur Day 1 Pro`,
    html: layout(`${workspace} t'invite sur Day 1 Pro`, `Tu es invité·e à ${what} dans l'espace <strong>${esc(workspace)}</strong>. C'est gratuit pour toi.`,
      { label: "Accepter l'invitation", href: link }, "Le lien est valable 7 jours, une seule fois."),
    text: `${workspace} t'invite sur Day 1 Pro (${what}).\n\nAccepte l'invitation (7 jours, une seule fois) :\n${link}`,
  };
}
