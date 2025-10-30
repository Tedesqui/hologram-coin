// service-worker.js

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

// Evento que escuta mensagens vindas da página principal
self.addEventListener('message', event => {
  if (event.data && event.data.action === 'schedule-notification') {
    
    // Agenda a notificação para aparecer após 10 segundos
    const notificationDelay = 10000; // 10 segundos

    setTimeout(() => {
      // O link que será aberto ao clicar
      const urlToOpen = 'https://tedesqui.github.io/hologram_coin/';

      self.registration.showNotification('𝐇𝐎𝐋𝐎𝐆𝐑𝐀𝐌 𝐂𝐎𝐈𝐍', {
        body: '𝗟𝗶𝗳𝗲 𝗶𝘀 𝗺𝗼𝗿𝗲 𝗳𝘂𝗻 𝘄𝗶𝘁𝗵 𝗖𝗥𝗬𝗣𝗧𝗢. 𝗬𝗼𝘂 𝗮𝗿𝗲 𝗮𝗹𝘄𝗮𝘆𝘀 𝘄𝗲𝗹𝗰𝗼𝗺𝗲!!!',
        icon: 'videos/hannah.png',
        image: 'videos/hannah.png',
        tag: 'hologram-ola-tag',
        // NOVO: Anexa dados à notificação, incluindo o link que queremos abrir.
        data: {
          url: urlToOpen 
        }
      });
    }, notificationDelay);
  }
});

// NOVO: Evento que é disparado quando o usuário clica na notificação.
self.addEventListener('notificationclick', event => {
  // Fecha a notificação para uma melhor experiência de usuário.
  event.notification.close();

  // Abre o link que foi guardado nos dados da notificação.
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
