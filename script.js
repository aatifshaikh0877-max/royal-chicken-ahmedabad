/* =====================================================
   ROYAL CHICKEN - SCRIPT.JS
   FIREBASE + CART + ORDERS + MY ORDERS + SEARCH + PAYMENT
   COMPLETE CLEAN VERSION
===================================================== */
/* =====================================================
   FIREBASE IMPORTS
===================================================== */
import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {
    getFirestore,
    collection,
    addDoc,
    serverTimestamp,
    query,
    where,
    getDocs,
    getDoc,
    doc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

import {
    getMessaging,
    getToken,
    onMessage
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-messaging.js";
/* =====================================================
   FIREBASE CONFIG
===================================================== */
const firebaseConfig = {
    apiKey:
        "AIzaSyB8sETr78mZtqlL__3DMz96AYffpSQaFqM",
    authDomain:
        "royal-chicken-72041.firebaseapp.com",
    projectId:
        "royal-chicken-72041",
    storageBucket:
        "royal-chicken-72041.firebasestorage.app",
    messagingSenderId:
        "714795473212",
    appId:
        "1:714795473212:web:43398c557fa5db62ede639",
    measurementId:
        "G-SQ1EV5E1VZ"
};
const app =
    initializeApp(firebaseConfig);
const db =
    getFirestore(app);
const messaging = getMessaging(app);
const VAPID_KEY = "BNlMSym2ILeQdfEo2R4pOM9BGqgzEZlOBo0ZQ1zuxqkH9IbjoN6Qiy5Q6hXtUcUiV_zvHcxG72fcPLHHmDgDIn8";
/* =====================================================
   CUSTOMER NOTIFICATIONS
===================================================== */

async function enableRoyalChickenNotifications() {
    try {
        if (!("Notification" in window)) {
            console.log("This browser does not support notifications.");
            return;
        }

        const permission = await Notification.requestPermission();

        if (permission !== "granted") {
            console.log("Notification permission denied.");
            return;
        }

        const registration = await navigator.serviceWorker.register(
            "/firebase-messaging-sw.js"
        );

        const token = await getToken(messaging, {
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: registration
        });

        if (!token) {
            console.log("FCM token nahi mila.");
            return;
        }

        localStorage.setItem(
            "royalChickenFCMToken",
            token
        );

        console.log(
            "ROYAL CHICKEN FCM TOKEN:",
            token
        );

    } catch (error) {
        console.error(
            "Royal Chicken notification error:",
            error
        );
    }
}
/* =====================================================
   GET CUSTOMER FCM TOKEN
===================================================== */

async function getRoyalChickenFCMToken() {
    try {
        let token = localStorage.getItem("royalChickenFCMToken");

        if (token) {
            return token;
        }

        await enableRoyalChickenNotifications();

        token = localStorage.getItem("royalChickenFCMToken");

        return token || null;

    } catch (error) {
        console.error("FCM token error:", error);
        return null;
    }
}
/* =====================================================
   CART
===================================================== */
let cart = [];
// =====================================================
// DAILY RATES FROM FIREBASE
// =====================================================

const DEFAULT_RATES = {
    "kheema": 400,
    "bombay-legs": 270,
    "wings": 270,
    "drumsticks": 270,
    "curry-cut": 270,
    "boneless": 400,
    "thai-boneless": 400,
    "lollipop": 280,
    "liver": 150,
    "gizzard": 150,
    "tandoori": 250,
    "broiler": 250
};

const PRODUCT_RATE_IDS = {
    "Kheema": "kheema",
    "Bombay Legs": "bombay-legs",
    "Wings": "wings",
    "Drumsticks": "drumsticks",
    "Curry Cut": "curry-cut",
    "Boneless": "boneless",
    "Thai Boneless": "thai-boneless",
    "Lollipop": "lollipop",
    "Liver": "liver",
    "Gizzard": "gizzard",
    "Tandoori": "tandoori",
    "Broiler": "broiler"
};

let liveRates = { ...DEFAULT_RATES };

async function loadProductRates() {
    try {
        const snapshot = await getDocs(
            collection(db, "productRates")
        );

        snapshot.forEach((rateDoc) => {
            const data = rateDoc.data();

            if (data.price !== undefined) {
                liveRates[rateDoc.id] = Number(data.price);
            }
        });

        updateProductPrices();

        console.log("Daily Rates Loaded:", liveRates);

    } catch (error) {
        console.error("Daily Rates Error:", error);
    }
}
function updateProductPrices() {

    Object.entries(PRODUCT_RATE_IDS).forEach(
        ([productName, rateId]) => {

            const priceElement =
                document.getElementById("price-" + rateId);

            if (!priceElement) return;

            const price =
                liveRates[rateId] ??
                DEFAULT_RATES[rateId];

            if (rateId === "tandoori") {

                priceElement.innerHTML =
                    `₹${price} <small>/ 900 gm</small>`;

            } else if (rateId === "broiler") {

                priceElement.innerHTML =
                    `₹${price} <small>/ 1 kg</small>`;

            } else {

                priceElement.innerHTML =
                    `₹${price} <small>/ kg</small>`;

            }
        }
    );
}
/* =====================================================
   ADD TO CART
===================================================== */
function addToCart(name, price) {

    const rateId = PRODUCT_RATE_IDS[name];

    const currentPrice =
        rateId && liveRates[rateId] !== undefined
            ? liveRates[rateId]
            : Number(price);

    const existingItem =
        cart.find(
            item =>
                item.name === name
        );

    if (existingItem) {
        existingItem.quantity += 0.5;
    } else {
        cart.push({
            name: name,
            price: currentPrice,
            quantity: 1
        });
    }

    updateCart();
}
/* =====================================================
   UPDATE CART
===================================================== */
function updateCart() {
    const cartItems =
        document.getElementById(
            "cart-items"
        );
    const cartCount =
        document.getElementById(
            "cart-count"
        );
    const cartTotal =
        document.getElementById(
            "cart-total"
        );
    if (!cartItems) {
        return;
    }
    /*
       Don't overwrite successful order screen
    */
    if (
        cartItems.dataset.orderSuccess ===
        "true"
    ) {
        return;
    }
    let subtotal = 0;
    let itemCount = 0;
    /* =================================================
       EMPTY CART
    ================================================= */
    if (cart.length === 0) {
        cartItems.innerHTML = `
            <p class="empty-cart">
                Your cart is empty.
            </p>
        `;
        if (cartCount) {
            cartCount.textContent =
                "0";
        }
        if (cartTotal) {
            cartTotal.innerHTML =
                "";
        }
        hideFloatingCart();
        return;
    }
    /* =================================================
       BUILD CART
    ================================================= */
    cartItems.innerHTML =
        "";
    cart.forEach(
        function(item, index) {
            const itemTotal =
                Number(item.price) *
                Number(item.quantity);
            subtotal +=
                itemTotal;
            itemCount +=
                Number(item.quantity);
            cartItems.innerHTML += `
                <div class="cart-item">
                    <div class="cart-item-name">
                        <strong>
                            ${escapeHTML(
                                item.name
                            )}
                        </strong>
                        <span>
                            ₹${item.price} / kg
                        </span>
                    </div>
                    <div class="cart-actions">
                        <button
                            type="button"
                            onclick="decreaseItem(${index})"
                        >
                            −
                        </button>
                        <span class="quantity">
                            ${item.quantity}
                        </span>
                        <button
                            type="button"
                            onclick="increaseItem(${index})"
                        >
                            +
                        </button>
                        <button
                            type="button"
                            class="remove-btn"
                            onclick="removeItem(${index})"
                        >
                            Remove
                        </button>
                    </div>
                </div>
            `;
        }
    );
    /* =================================================
       CART COUNT
    ================================================= */
    if (cartCount) {
        cartCount.textContent =
            itemCount;
    }
    /* =================================================
       CART TOTAL
       DELIVERY CHARGE NOT INCLUDED
    ================================================= */
    if (cartTotal) {
        cartTotal.innerHTML = `
            <div class="cart-total-row">
                <span>
                    Total
                </span>
                <strong>
                    ₹${subtotal}
                </strong>
            </div>
        `;
    }
    /* =================================================
       FLOATING CART
    ================================================= */
    const floatingCart =
        document.getElementById(
            "floating-cart"
        );
    const floatingCartCount =
        document.getElementById(
            "floating-cart-count"
        );
    const floatingCartTotal =
        document.getElementById(
            "floating-cart-total"
        );
    if (floatingCart) {
        floatingCart.classList.add(
            "show"
        );
        if (floatingCartCount) {
            floatingCartCount.textContent =
                itemCount +
                (
                    itemCount === 1
                        ? " item"
                        : " items"
                );
        }
        if (floatingCartTotal) {
            floatingCartTotal.textContent =
                "₹" + subtotal;
        }
    }
}
/* =====================================================
   INCREASE ITEM
===================================================== */
function increaseItem(index) {
    if (!cart[index]) {
        return;
    }
    cart[index].quantity += 0.5;
    updateCart();
}
/* =====================================================
   DECREASE ITEM
===================================================== */
function decreaseItem(index) {
    if (!cart[index]) {
        return;
    }

    if (cart[index].quantity > 1) {
        cart[index].quantity -= 0.5;
    } else {
        cart.splice(index, 1);
    }

    updateCart();
}
/* =====================================================
   REMOVE ITEM
===================================================== */
function removeItem(index) {
    if (!cart[index]) {
        return;
    }
    cart.splice(
        index,
        1
    );
    updateCart();
}
/* =====================================================
   OPEN CART
===================================================== */
function openCart() {
    const cartModal =
        document.getElementById(
            "cart-modal"
        );
    if (cartModal) {
        cartModal.style.display =
            "flex";
    }
    /*
       If old success screen exists,
       allow normal cart to work again.
    */
    const cartItems =
        document.getElementById(
            "cart-items"
        );
    if (cartItems) {
        cartItems.dataset.orderSuccess =
            "false";
    }
    updateCart();
}
/* =====================================================
   CLOSE CART
===================================================== */
function closeCart() {
    const cartModal =
        document.getElementById(
            "cart-modal"
        );
    if (cartModal) {
        cartModal.style.display =
            "none";
    }
}
/* =====================================================
   SEARCH PRODUCTS
===================================================== */
function searchProducts() {
    const searchInput =
        document.getElementById(
            "product-search"
        );
    if (!searchInput) {
        return;
    }
    const searchText =
        searchInput.value
            .toLowerCase()
            .trim();
    const products =
        document.querySelectorAll(
            ".product-card"
        );
    products.forEach(
        function(product) {
            const productName =
                product.querySelector(
                    "h3"
                );
            if (!productName) {
                return;
            }
            const name =
                productName.textContent
                    .toLowerCase();
            product.style.display =
                name.includes(
                    searchText
                )
                    ? ""
                    : "none";
        }
    );
}
/* =====================================================
   PLACE ORDER
===================================================== */
async function placeOrder(event) {
    event.preventDefault();
    /* =================================================
       CHECK CART
    ================================================= */
    if (cart.length === 0) {
        alert(
            "Please add a product to your cart first."
        );
        return;
    }
    const orderForm =
        event.target;
    const submitButton =
        orderForm.querySelector(
            'button[type="submit"]'
        );
    /* =================================================
       PREVENT DOUBLE ORDER
    ================================================= */
    if (
        submitButton &&
        submitButton.disabled
    ) {
        return;
    }
    if (submitButton) {
        submitButton.disabled =
            true;
        submitButton.textContent =
            "Placing Order...";
    }
    /* =================================================
       CUSTOMER DETAILS
    ================================================= */
    const name =
        document
            .getElementById(
                "customer-name"
            )
            .value
            .trim();
    const phone =
        document
            .getElementById(
                "customer-phone"
            )
            .value
            .trim();
    const address =
        document
            .getElementById(
                "customer-address"
            )
            .value
            .trim();
            const description =
    document.getElementById("order-description")?.value.trim() || "";
    if (
        !name ||
        !phone ||
        !address
    ) {
        alert(
            "Please fill all customer details."
        );
        restoreOrderButton(
            submitButton
        );
        return;
    }
    /* =================================================
       CLEAN PHONE
    ================================================= */
    const cleanPhone =
        phone.replace(
            /\D/g,
            ""
        );
    if (
        cleanPhone.length !== 10
    ) {
        alert(
            "Please enter a valid 10 digit phone number."
        );
        restoreOrderButton(
            submitButton
        );
        return;
    }
    /*
       Save phone for My Orders
    */
    localStorage.setItem(
        "royalChickenPhone",
        cleanPhone
    );
    /* =================================================
       PAYMENT
    ================================================= */
    const paymentSelected =
        document.querySelector(
            'input[name="payment"]:checked'
        );
    if (!paymentSelected) {
        alert(
            "Please select a payment method."
        );
        restoreOrderButton(
            submitButton
        );
        return;
    }
    const paymentMethod =
        paymentSelected.value;
    /* =================================================
       CALCULATE TOTAL
       DELIVERY CHARGE NOT INCLUDED
    ================================================= */
    let total = 0;
    const orderItems =
        cart.map(
            function(item) {
                const itemTotal =
                    Number(item.price) *
                    Number(item.quantity);
                total +=
                    itemTotal;
                return {
                    name:
                        item.name,
                    price:
                        Number(item.price),
                    quantity:
                        Number(item.quantity),
                    itemTotal:
                        itemTotal
                };
            }
        );
    /* =================================================
       ORDER NUMBER
    ================================================= */
    const orderNumber =
        "RC" +
        Date.now()
            .toString()
            .slice(-6);
    /* =================================================
       SAVE TO FIREBASE
    ================================================= */
try {

    const notificationToken =
        await getRoyalChickenFCMToken();

    const orderData = {
        orderNumber:
            orderNumber,

        customerName:
            name,

        phone:
            cleanPhone,

        address:
            address,

        description:
            description,

        paymentMethod:
            paymentMethod,

        items:
            orderItems,

        total:
            total,

        status:
            "Pending",

        notificationToken:
            notificationToken || null,

        createdAt:
            serverTimestamp()
        };
        await addDoc(
            collection(
                db,
                "orders"
            ),
            orderData
        );
        /* =================================================
           SHOW SUCCESS SCREEN
        ================================================= */
        showOrderSuccess(
            name,
            cleanPhone,
            address,
            paymentMethod,
            orderNumber,
            orderItems,
            total
        );
        /* =================================================
           CLEAR CART
        ================================================= */
        cart = [];
        hideFloatingCart();
        const cartCount =
            document.getElementById(
                "cart-count"
            );
        if (cartCount) {
            cartCount.textContent =
                "0";
        }
    } catch (error) {
        console.error(
            "Firebase order error:",
            error
        );
        alert(
            "Order place nahi ho paya. Please try again."
        );
        restoreOrderButton(
            submitButton
        );
    }
}
/* =====================================================
   SHOW ORDER SUCCESS
===================================================== */
function showOrderSuccess(
    name,
    phone,
    address,
    paymentMethod,
    orderNumber,
    orderItems,
    total
) {
    const cartItems =
        document.getElementById(
            "cart-items"
        );
    const cartTotal =
        document.getElementById(
            "cart-total"
        );
    const orderForm =
        document.querySelector(
            ".order-form"
        );
    if (!cartItems) {
        return;
    }
    /* =================================================
       ORDER PRODUCTS
    ================================================= */
    let orderedProducts =
        "";
    orderItems.forEach(
        function(item) {
            orderedProducts += `
                <div class="ordered-product">
                    <div class="ordered-product-info">
                        <strong>
                            ${escapeHTML(
                                item.name
                            )}
                        </strong>
                        <span>
                            ${item.quantity} kg × ₹${item.price}
                        </span>
                    </div>
                    <strong
                        class="ordered-product-price"
                    >
                        ₹${item.itemTotal}
                    </strong>
                </div>
            `;
        }
    );
    /* =================================================
       SUCCESS FLAG
    ================================================= */
    cartItems.dataset.orderSuccess =
        "true";
    /* =================================================
       SUCCESS SCREEN
    ================================================= */
    cartItems.innerHTML = `
        <div class="thank-you-box">
            <div class="thank-you-icon">
                ✓
            </div>
            <h2>
                Order Placed Successfully!
            </h2>
            <p class="success-message">
                Thank you, ${escapeHTML(name)}!
            </p>
            <div class="order-number-box">
                <span>
                    Order Number
                </span>
                <strong>
                    ${escapeHTML(orderNumber)}
                </strong>
            </div>
            <div class="order-section">
                <h3>
                    Order Summary
                </h3>
                ${orderedProducts}
                <div class="order-total">
                    <span>
                        Total Amount
                    </span>
                    <strong>
                        ₹${total}
                    </strong>
                </div>
            </div>
            <div class="customer-details">
                <div class="detail-row">
                    <span>
                        Payment
                    </span>
                    <strong>
                        ${escapeHTML(
                            paymentMethod
                        )}
                    </strong>
                </div>
                <div class="detail-row">
                    <span>
                        Phone
                    </span>
                    <strong>
                        ${escapeHTML(
                            phone
                        )}
                    </strong>
                </div>
                <div class="detail-row address-row">
                    <span>
                        Delivery Address
                    </span>
                    <strong>
                        ${escapeHTML(
                            address
                        )}
                    </strong>
                </div>
            </div>
            <div class="delivery-message">
                <strong>
                    Your order has been received!
                </strong>
                <p>
                    We will prepare your order fresh
                    and deliver it to your doorstep.
                </p>
                <p>
                    Delivery charge: ₹15 per km.
                </p>
            </div>
            <div class="royal-name">
                🍗 Royal Chicken
            </div>
            <button
                type="button"
                class="success-close-btn"
                onclick="closeCart()"
            >
                Done
            </button>
        </div>
    `;
    if (cartTotal) {
        cartTotal.innerHTML =
            "";
    }
    if (orderForm) {
        orderForm.style.display =
            "none";
    }
}
/* =====================================================
   RESTORE ORDER BUTTON
===================================================== */
function restoreOrderButton(button) {
    if (!button) {
        return;
    }
    button.disabled =
        false;
    button.textContent =
        "Place Order";
}
/* =====================================================
   HIDE FLOATING CART
===================================================== */
function hideFloatingCart() {
    const floatingCart =
        document.getElementById(
            "floating-cart"
        );
    if (floatingCart) {
        floatingCart.classList.remove(
            "show"
        );
    }
}
/* =====================================================
   UPI PAYMENT
===================================================== */
function showUPI() {
    const upi =
        document.getElementById(
            "upi-payment"
        );
    if (upi) {
        upi.style.display =
            "block";
    }
}
function hideUPI() {
    const upi =
        document.getElementById(
            "upi-payment"
        );
    if (upi) {
        upi.style.display =
            "none";
    }
}
/* =====================================================
   MY ORDERS
===================================================== */
async function openMyOrders() {
    const modal =
        document.getElementById(
            "orders-modal"
        );
    const content =
        document.getElementById(
            "my-orders-content"
        );
    if (!modal || !content) {
        console.error(
            "My Orders modal ya content nahi mila."
        );
        return;
    }
    /* =================================================
       OPEN MODAL
    ================================================= */
    modal.style.display =
        "flex";
    modal.style.visibility =
        "visible";
    modal.style.opacity =
        "1";
    modal.classList.add(
        "show"
    );
    /* =================================================
       LOADING
    ================================================= */
    content.innerHTML = `
        <div class="orders-loading">
            <div style="font-size:45px;">
                ⏳
            </div>
            <h3>
                Loading Your Orders...
            </h3>
            <p>
                Please wait...
            </p>
        </div>
    `;
    let phone =
        localStorage.getItem(
            "royalChickenPhone"
        );
    /* =================================================
       ASK PHONE
    ================================================= */
    if (!phone) {
        phone = prompt(
            "Enter the phone number used while placing your order:"
        );
        if (!phone) {
            content.innerHTML = `
                <div class="no-orders">
                    <div class="no-orders-icon">
                        📱
                    </div>
                    <h3>
                        Phone Number Required
                    </h3>
                    <p>
                        Please enter the phone number
                        used for your order.
                    </p>
                </div>
            `;
            return;
        }
        phone =
            phone.replace(
                /\D/g,
                ""
            );
        if (
            phone.length !== 10
        ) {
            content.innerHTML = `
                <div class="no-orders">
                    <div class="no-orders-icon">
                        ⚠️
                    </div>
                    <h3>
                        Invalid Phone Number
                    </h3>
                    <p>
                        Please enter a valid
                        10 digit phone number.
                    </p>
                </div>
            `;
            return;
        }
        localStorage.setItem(
            "royalChickenPhone",
            phone
        );
    }
    /* =================================================
       GET ORDERS
    ================================================= */
    try {
        const ordersQuery =
            query(
                collection(
                    db,
                    "orders"
                ),
                where(
                    "phone",
                    "==",
                    phone
                )
            );
        const snapshot =
            await getDocs(
                ordersQuery
            );
        /* =================================================
           NO ORDERS
        ================================================= */
        if (snapshot.empty) {
            content.innerHTML = `
                <div class="no-orders">
                    <div class="no-orders-icon">
                        📦
                    </div>
                    <h3>
                        No Orders Found
                    </h3>
                    <p>
                        No orders were found for
                        this phone number.
                    </p>
                    <button
                        type="button"
                        onclick="closeMyOrders()"
                    >
                        Close
                    </button>
                </div>
            `;
            return;
        }
        /* =================================================
           CONVERT ORDERS
        ================================================= */
        let orders = [];
        snapshot.forEach(
            function(orderDoc) {
                orders.push({
                    id:
                        orderDoc.id,
                    ...orderDoc.data()
                });
            }
        );
        /* =================================================
           SORT NEWEST FIRST
        ================================================= */
        orders.sort(
            function(a, b) {
                const aTime =
                    a.createdAt?.seconds ||
                    0;
                const bTime =
                    b.createdAt?.seconds ||
                    0;
                return bTime - aTime;
            }
        );
        /* =================================================
           BUILD ORDERS
        ================================================= */
        let html =
            "";
        orders.forEach(
            function(order) {
                const status =
                    order.status ||
                    "Pending";
                const statusClass =
                    getStatusClass(
                        status
                    );
                const orderDate =
                    formatOrderDate(
                        order.createdAt
                    );
                const totalItems =
                    getTotalItems(
                        order.items
                    );
                html += `
                    <div class="order-card">
                        <div class="order-card-top">
                            <div>
                                <span class="order-label">
                                    ORDER
                                </span>
                                <strong>
                                    #${escapeHTML(
                                        order.orderNumber ||
                                        "N/A"
                                    )}
                                </strong>
                            </div>
                            <span
                                class="order-status ${statusClass}"
                            >
                                ${escapeHTML(status)}
                            </span>
                        </div>
                        <div class="order-card-info">
                            <div>
                                <span>
                                    DATE
                                </span>
                                <strong>
                                    ${orderDate}
                                </strong>
                            </div>
                            <div>
                                <span>
                                    ITEMS
                                </span>
                                <strong>
                                    ${totalItems} item(s)
                                </strong>
                            </div>
                            <div>
                                <span>
                                    TOTAL
                                </span>
                                <strong>
                                    ₹${Number(
                                        order.total ||
                                        0
                                    )}
                                </strong>
                            </div>
                        </div>
                        <div class="order-card-buttons">
                            <button
                                type="button"
                                onclick="viewOrder('${order.id}')"
                            >
                                👀 View Order
                            </button>
                            ${
                                status === "Pending"
                                ?
                                `
                                <button
                                    type="button"
                                    class="cancel-order-btn"
                                    onclick="cancelOrder('${order.id}')"
                                >
                                    ❌ Cancel Order
                                </button>
                                `
                                :
                                ""
                            }
                            <button
                                type="button"
                                class="reorder-btn"
                                onclick="reorderItems('${order.id}')"
                            >
                                🔄 Reorder
                            </button>
                        </div>
                    </div>
                `;
            }
        );
        content.innerHTML =
            html;
    } catch (error) {
        console.error(
            "MY ORDERS ERROR:",
            error
        );
        content.innerHTML = `
            <div class="no-orders">
                <div class="no-orders-icon">
                    ⚠️
                </div>
                <h3>
                    Unable to Load Orders
                </h3>
                <p>
                    Please try again.
                </p>
            </div>
        `;
    }
}
/* =====================================================
   CLOSE MY ORDERS
===================================================== */
function closeMyOrders() {
    const modal =
        document.getElementById(
            "orders-modal"
        );
    if (modal) {
        modal.classList.remove(
            "show"
        );
        modal.style.display =
            "none";
        modal.style.visibility =
            "hidden";
        modal.style.opacity =
            "0";
    }
}
/* =====================================================
   VIEW ORDER
   FIXED
===================================================== */
async function viewOrder(orderId) {
    const content =
        document.getElementById(
            "my-orders-content"
        );
    if (!content) {
        console.error(
            "my-orders-content not found."
        );
        return;
    }
    /* =================================================
       LOADING
    ================================================= */
    content.innerHTML = `
        <div class="orders-loading">
            <div style="font-size:40px;">
                ⏳
            </div>
            <h3>
                Loading Order...
            </h3>
        </div>
    `;
    try {
        /* =================================================
           IMPORTANT:
           DIRECTLY GET ORDER FROM FIRESTORE
        ================================================= */
        const orderRef =
            doc(
                db,
                "orders",
                orderId
            );
        const orderSnap =
            await getDoc(
                orderRef
            );
        if (!orderSnap.exists()) {
            content.innerHTML = `
                <div class="no-orders">
                    <div class="no-orders-icon">
                        ⚠️
                    </div>
                    <h3>
                        Order Not Found
                    </h3>
                    <button
                        type="button"
                        onclick="openMyOrders()"
                    >
                        ← Back to My Orders
                    </button>
                </div>
            `;
            return;
        }
        const order =
            orderSnap.data();
        /* =================================================
           PRODUCTS
        ================================================= */
        let orderedProducts =
            "";
        (order.items || []).forEach(
            function(item) {
                orderedProducts += `
                    <div class="view-order-item">
                        <div>
                            <strong>
                                ${escapeHTML(
                                    item.name
                                )}
                            </strong>
                            <span>
                                ${Number(
                                    item.quantity || 0
                                )} kg × ₹${Number(
                                    item.price || 0
                                )}
                            </span>
                        </div>
                        <strong>
                            ₹${Number(
                                item.itemTotal || 0
                            )}
                        </strong>
                    </div>
                `;
            }
        );
        /* =================================================
           VIEW ORDER PAGE
        ================================================= */
        content.innerHTML = `
            <div class="view-order-page">
                <button
                    type="button"
                    class="back-orders-btn"
                    onclick="openMyOrders()"
                >
                    ← Back to My Orders
                </button>
                <div class="view-order-header">
                    <div>
                        <span>
                            ORDER NUMBER
                        </span>
                        <h3>
                            #${escapeHTML(
                                order.orderNumber ||
                                "N/A"
                            )}
                        </h3>
                    </div>
                    <span
                        class="order-status ${getStatusClass(
                            order.status ||
                            "Pending"
                        )}"
                    >
                        ${escapeHTML(
                            order.status ||
                            "Pending"
                        )}
                    </span>
                </div>
                <div class="view-order-section">
                    <h3>
                        🛒 Ordered Items
                    </h3>
                    <div class="view-order-items">
                        ${orderedProducts}
                    </div>
                </div>
                <div class="view-order-section">
                    <h3>
                        💰 Payment Details
                    </h3>
                    <div class="view-order-detail">
                        <span>
                            Payment Method
                        </span>
                        <strong>
                            ${escapeHTML(
                                order.paymentMethod ||
                                "N/A"
                            )}
                        </strong>
                    </div>
                    <div
                        class="view-order-detail total-detail"
                    >
                        <span>
                            Total Amount
                        </span>
                        <strong>
                            ₹${Number(
                                order.total ||
                                0
                            )}
                        </strong>
                    </div>
                </div>
                <div class="view-order-section">
                    <h3>
                        📍 Delivery Details
                    </h3>
                    <div class="view-order-detail">
                        <span>
                            Customer
                        </span>
                        <strong>
                            ${escapeHTML(
                                order.customerName ||
                                "N/A"
                            )}
                        </strong>
                    </div>
                    <div class="view-order-detail">
                        <span>
                            Phone
                        </span>
                        <strong>
                            ${escapeHTML(
                                order.phone ||
                                "N/A"
                            )}
                        </strong>
                    </div>
                    <div
                        class="view-order-detail address-detail"
                    >
                        <span>
                            Address
                        </span>
                        <strong>
                            ${escapeHTML(
                                order.address ||
                                "N/A"
                            )}
                        </strong>
                    </div>
                </div>
                <div class="view-order-footer">
                    🍗 Royal Chicken
                </div>
            </div>
        `;
    } catch (error) {
        console.error(
            "VIEW ORDER ERROR:",
            error
        );
        content.innerHTML = `
            <div class="no-orders">
                <div class="no-orders-icon">
                    ⚠️
                </div>
                <h3>
                    Unable to Load Order
                </h3>
                <p>
                    Order details load nahi ho paye.
                </p>
                <button
                    type="button"
                    onclick="openMyOrders()"
                >
                    ← Back to My Orders
                </button>
            </div>
        `;
    }
}
/* =====================================================
   CANCEL ORDER
===================================================== */
async function cancelOrder(orderId) {
    const confirmCancel =
        confirm(
            "Are you sure you want to cancel this order?"
        );
    if (!confirmCancel) {
        return;
    }
    try {
        const orderRef =
            doc(
                db,
                "orders",
                orderId
            );
        const orderSnap =
            await getDoc(
                orderRef
            );
        if (!orderSnap.exists()) {
            alert(
                "Order not found."
            );
            return;
        }
        const order =
            orderSnap.data();
        if (
            order.status !==
            "Pending"
        ) {
            alert(
                "This order can no longer be cancelled."
            );
            return;
        }
        await updateDoc(
            orderRef,
            {
                status:
                    "Cancelled",
                cancelledAt:
                    serverTimestamp()
            }
        );
        alert(
            "Your order has been cancelled successfully."
        );
        await openMyOrders();
    } catch (error) {
        console.error(
            "CANCEL ORDER ERROR:",
            error
        );
        alert(
            "Order cancel nahi ho paya. Please try again."
        );
    }
}
/* =====================================================
   REORDER
===================================================== */
async function reorderItems(orderId) {
    try {
        const orderRef =
            doc(
                db,
                "orders",
                orderId
            );
        const orderSnap =
            await getDoc(
                orderRef
            );
        if (!orderSnap.exists()) {
            alert(
                "Order not found."
            );
            return;
        }
        const order =
            orderSnap.data();
        (order.items || []).forEach(
            function(item) {
                const existingItem =
                    cart.find(
                        cartItem =>
                            cartItem.name ===
                            item.name
                    );
                if (existingItem) {
                    existingItem.quantity +=
                        Number(
                            item.quantity ||
                            0
                        );
                } else {
                    cart.push({
                        name:
                            item.name,
                        price:
                            Number(
                                item.price ||
                                0
                            ),
                        quantity:
                            Number(
                                item.quantity ||
                                0
                            )
                    });
                }
            }
        );
        updateCart();
closeMyOrders();
openCart();

const orderForm = document.querySelector(".order-form");

if (orderForm) {
    orderForm.style.display = "block";
}

    } catch (error) {
        console.error(
            "REORDER ERROR:",
            error
        );
        alert(
            "Reorder nahi ho paya. Please try again."
        );
    }
}
/* =====================================================
   STATUS CLASS
===================================================== */
function getStatusClass(status) {
    const cleanStatus =
        String(status)
            .toLowerCase()
            .trim();
    if (
        cleanStatus ===
        "pending"
    ) {
        return "pending";
    }
    if (
        cleanStatus ===
        "preparing"
    ) {
        return "preparing";
    }
    if (
        cleanStatus ===
        "out for delivery"
    ) {
        return "out-for-delivery";
    }
    if (
        cleanStatus ===
        "delivered"
    ) {
        return "delivered";
    }
    if (
        cleanStatus ===
        "cancelled"
    ) {
        return "cancelled";
    }
    return "pending";
}
/* =====================================================
   FORMAT ORDER DATE
===================================================== */
function formatOrderDate(timestamp) {
    if (
        !timestamp ||
        !timestamp.seconds
    ) {
        return "Date unavailable";
    }
    const date =
        new Date(
            timestamp.seconds *
            1000
        );
    return date.toLocaleString(
        "en-IN",
        {
            day:
                "2-digit",
            month:
                "short",
            year:
                "numeric",
            hour:
                "2-digit",
            minute:
                "2-digit"
        }
    );
}
/* =====================================================
   TOTAL ITEMS
===================================================== */
function getTotalItems(items) {
    if (
        !Array.isArray(items)
    ) {
        return 0;
    }
    return items.reduce(
        function(total, item) {
            return total +
                Number(
                    item.quantity ||
                    0
                );
        },
        0
    );
}
/* =====================================================
   ESCAPE HTML
===================================================== */
function escapeHTML(value) {
    return String(
        value ?? ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}
/* =====================================================
   MAKE FUNCTIONS AVAILABLE TO HTML
===================================================== */
window.addToCart =
    addToCart;
window.increaseItem =
    increaseItem;
window.decreaseItem =
    decreaseItem;
window.removeItem =
    removeItem;
window.openCart =
    openCart;
window.closeCart =
    closeCart;
window.searchProducts =
    searchProducts;
window.placeOrder =
    placeOrder;
window.showUPI =
    showUPI;
window.hideUPI =
    hideUPI;
window.openMyOrders =
    openMyOrders;
window.closeMyOrders =
    closeMyOrders;
window.viewOrder =
    viewOrder;
window.cancelOrder =
    cancelOrder;
window.reorderItems =
    reorderItems;
/* =====================================================
   PAGE LOAD
===================================================== */
document.addEventListener(
    "DOMContentLoaded",
    async function() {
        await loadProductRates();
        updateCart();

        await enableRoyalChickenNotifications();
    }
);