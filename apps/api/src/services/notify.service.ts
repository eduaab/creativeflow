import { env } from '../config/env';
import { audit } from '../models/governance.model';

/**
 * Notificação no fluxo que a equipe já usa. Com TEAMS_WEBHOOK_URL configurada, envia um
 * cartão (Adaptive Card) para um canal do Teams via Workflows/Incoming Webhook, com link
 * direto para a fila de aprovação. Sem a variável, registra apenas na trilha de auditoria.
 */
export async function notifyReviewers(n: { campaignId: string; title: string; text: string; path?: string }) {
  const url = `${env.appPublicUrl.replace(/\/$/, '')}${n.path ?? '/aprovacoes'}`;
  let delivered: 'teams' | 'log' = 'log';
  let error: string | undefined;
  if (env.teamsWebhookUrl) {
    try {
      const card = {
        type: 'message',
        attachments: [
          {
            contentType: 'application/vnd.microsoft.card.adaptive',
            content: {
              $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
              type: 'AdaptiveCard',
              version: '1.4',
              body: [
                { type: 'TextBlock', size: 'Medium', weight: 'Bolder', text: n.title, wrap: true },
                { type: 'TextBlock', text: n.text, wrap: true },
              ],
              actions: [{ type: 'Action.OpenUrl', title: 'Abrir fila de aprovação', url }],
            },
          },
        ],
      };
      const res = await fetch(env.teamsWebhookUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(card), signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      delivered = 'teams';
    } catch (e) {
      error = String(e);
    }
  }
  await audit({ campaignId: n.campaignId, type: 'notification.sent', payload: { title: n.title, text: n.text, url, delivered, error } });
}
