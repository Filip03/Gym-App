// Service worker za Firebase Cloud Messaging — prima push notifikacije dok je
// aplikacija zatvorena ili u pozadini. Registruje se ručno (vidi
// push-notification.service.ts) na SVOJ scope, odvojeno od Angularovog
// ngsw-worker.js (koji drži scope "/" za PWA keširanje) — da se njih dva ne
// sudare oko kontrole stranice.
//
// Angular CLI ovaj fajl samo kopira kao asset (vidi angular.json), ne
// procesira ga kroz webpack — zato importScripts sa CDN-a, ne ES import.
importScripts('https://www.gstatic.com/firebasejs/12.16.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.16.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyAaBAYIP_ni5Vs7PFemgYPbFqL8pqLaSHY',
  authDomain: 'gym-app-73338.firebaseapp.com',
  projectId: 'gym-app-73338',
  storageBucket: 'gym-app-73338.firebasestorage.app',
  messagingSenderId: '354056038315',
  appId: '1:354056038315:web:ecb4521076b0986c18d4ee'
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? 'GymApp';
  self.registration.showNotification(title, {
    body: payload.notification?.body,
    icon: '/assets/icons/icon-192x192.png',
    data: payload.data
  });
});
