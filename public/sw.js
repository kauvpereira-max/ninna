/*
 * Ninna — service worker.
 *
 * ==================================================================
 * ⚠️ ELE NÃO TEM `fetch`, E ISSO É O ARQUIVO INTEIRO
 * ==================================================================
 *
 * Não há handler de `fetch`. Não há cache. Não há Workbox, não há precache, não
 * há estratégia de rede. **Este service worker existe só para receber push.**
 *
 * O motivo é um bug que este projeto nunca teve e não vai passar a ter: até
 * 16/08/2026 o app não tinha service worker nenhum, e por isso `Ctrl+Shift+R`
 * sempre trouxe o bundle novo. Um SW que intercepta `fetch` reintroduz a classe
 * inteira de "mudei e continua o antigo" — o defeito em que se perde meia hora
 * investigando build e deploy antes de suspeitar do óbvio.
 *
 * Já custou caro aqui uma vez, por outro caminho: em 12/08 os ícones "não
 * estavam no ar" e o diagnóstico começou pelo lado errado. Naquele dia a causa
 * era outra. Com cache no SW, seria esta — e a próxima vez pareceria idêntica.
 *
 * **Se alguém for somar cache offline algum dia, que seja decisão própria, com
 * commit próprio e com o custo escrito.** Não de carona num bloco de push.
 *
 * ==================================================================
 * POR QUE `showNotification` É OBRIGATÓRIO E NÃO OPCIONAL
 * ==================================================================
 *
 * A inscrição usa `userVisibleOnly: true` — é exigência do Chrome e do iOS, não
 * escolha. Em troca, **toda** mensagem recebida precisa virar notificação
 * visível. Um `push` que não chama `showNotification` faz o navegador mostrar
 * uma genérica ("Este site foi atualizado em segundo plano") ou, no reincidente,
 * revogar a permissão.
 *
 * Por isso não existe push só-badge. O que existe é notificação SILENCIOSA —
 * sem som, sem vibração — com o badge junto. Ver PRODUTO.md §3.2.
 */

// `skipWaiting` + `claim`: sem eles, um SW antigo continua atendendo os push até
// a última aba fechar, e uma correção na notificação demoraria dias para valer.
// É seguro justamente porque não há cache — não existe estado antigo a preservar.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (evento) => evento.waitUntil(self.clients.claim()));

/**
 * O payload é escrito pela Edge Function e chega como JSON.
 *
 * O `catch` não é zelo: push com corpo inválido acontece — proxy que trunca,
 * versão antiga do servidor, teste manual pelo DevTools. Sem o fallback, a
 * exceção deixaria o evento sem `showNotification`, que é exatamente o caminho
 * para o navegador revogar a permissão.
 */
function lerPayload(evento) {
  try {
    const dados = evento.data ? evento.data.json() : null;
    if (dados && typeof dados.corpo === 'string') return dados;
  } catch {
    // segue para o fallback
  }
  return { titulo: 'Ninna', corpo: 'Toque para abrir.', url: '/', tag: 'ninna-generica' };
}

self.addEventListener('push', (evento) => {
  const { titulo, corpo, url, tag, badge } = lerPayload(evento);

  evento.waitUntil(
    (async () => {
      await self.registration.showNotification(titulo || 'Ninna', {
        body: corpo,
        icon: '/icone-192.png',
        badge: '/icone-192.png',
        // ⚠️ SILENCIOSA por padrão. A mãe está exausta e pode estar com o bebê no
        // colo — o padrão é aparecer na central sem buzinar. Som é escolha dela,
        // e chega como `silent: false` no payload.
        silent: badge !== false,
        // `tag` colapsa: dois avisos do mesmo sono em aberto viram um só, em vez
        // de empilhar. Sem isso, uma falha do agendador vira dez notificações.
        tag: tag || 'ninna',
        renotify: false,
        data: { url: url || '/' },
      });

      // O número no ícone. Some quando ela abre o app — quem limpa é a tela.
      if (self.navigator && 'setAppBadge' in self.navigator) {
        try {
          await self.navigator.setAppBadge(1);
        } catch {
          // Badging API sem suporte ou sem permissão: a notificação já foi.
        }
      }
    })(),
  );
});

/**
 * Tocar na notificação: foca a aba que já existe, em vez de abrir outra.
 *
 * Abrir uma segunda instância da PWA instalada é o tipo de coisa que faz a mãe
 * achar que perdeu o que estava fazendo.
 */
self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const destino = (evento.notification.data && evento.notification.data.url) || '/';

  evento.waitUntil(
    (async () => {
      const abas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const aba of abas) {
        if ('focus' in aba) {
          if ('navigate' in aba && destino !== '/') await aba.navigate(destino);
          return aba.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(destino);
    })(),
  );
});
