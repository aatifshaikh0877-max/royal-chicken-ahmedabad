importScripts("https://www.gstatic.com/firebasejs/12.1.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.1.0/firebase-messaging-compat.js");

const firebaseConfig = {
    apiKey: "AIzaSyB8sETr78mZtqlL__3DMz96AYffpSQaFqM",
    authDomain: "royal-chicken-72041.firebaseapp.com",
    projectId: "royal-chicken-72041",
    storageBucket: "royal-chicken-72041.firebasestorage.app",
    messagingSenderId: "714795473212",
    appId: "1:714795473212:web:43398c557fa5db62ede639"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log("Royal Chicken background notification:", payload);

    const notificationTitle =
        payload.notification?.title || "Royal Chicken 👑";

    const notificationOptions = {
        body:
            payload.notification?.body ||
            "Fresh chicken ready hai! 🍗",
        icon: "/images/royal-chicken-logo.jpeg"
    };

    self.registration.showNotification(
        notificationTitle,
        notificationOptions
    );
});