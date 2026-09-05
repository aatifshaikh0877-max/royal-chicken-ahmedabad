/* =========================================================
   ROYAL CHICKEN - ADMIN.JS
   Orders + Expenses + Accounting + Invoices + Sales
========================================================= */

import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    getDoc,
    doc,
    updateDoc,
    deleteDoc,
    setDoc,
    query,
    orderBy,
    serverTimestamp,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


/* =========================================================
   FIREBASE
========================================================= */

const firebaseConfig = {
    apiKey: "AIzaSyB8sETr78mZtqlL__3DMz96AYffpSQaFqM",
    authDomain: "royal-chicken-72041.firebaseapp.com",
    projectId: "royal-chicken-72041",
    storageBucket: "royal-chicken-72041.firebasestorage.app",
    messagingSenderId: "714795473212",
    appId: "1:714795473212:web:43398c557fa5db62ede639",
    measurementId: "G-SQ1EV5E1VZ"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);


/* =========================================================
   GLOBAL DATA
========================================================= */

let allOrders = [];
let allExpenses = [];
let currentSalesPeriod = "today";

let orderListenerStarted = false;
let firstOrderSnapshot = true;


/* =========================================================
   DATE HELPERS
========================================================= */

function formatDate(date) {

    if (!date) return "--";

    const d = new Date(date);

    return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}


function getDateValue(value) {

    if (!value) return null;

    if (
        value &&
        typeof value.toDate === "function"
    ) {
        return value.toDate();
    }

    if (value instanceof Date) {
        return value;
    }

    const date = new Date(value);

    if (isNaN(date.getTime())) {
        return null;
    }

    return date;
}


function dateOnly(date) {

    const d = getDateValue(date);

    if (!d) return "";

    return (
        d.getFullYear() +
        "-" +
        String(d.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(d.getDate()).padStart(2, "0")
    );
}


function isSameDay(date1, date2) {

    const d1 = getDateValue(date1);
    const d2 = getDateValue(date2);

    if (!d1 || !d2) return false;

    return dateOnly(d1) === dateOnly(d2);
}


function money(amount) {

    return "₹" +
        Number(amount || 0).toLocaleString("en-IN");
}


function setText(id, value) {

    const element =
        document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}


function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =========================================================
   PAGE NAVIGATION
========================================================= */

window.showSection = function(sectionId, button) {

    document
        .querySelectorAll(".section")
        .forEach(section => {
            section.classList.remove("active");
        });

    const section =
        document.getElementById(sectionId);

    if (!section) return;

    section.classList.add("active");


    document
        .querySelectorAll(".menu-item")
        .forEach(item => {
            item.classList.remove("active");
        });

    if (button) {
        button.classList.add("active");
    }


    const titles = {

        dashboard: "Dashboard",
        orders: "Orders",
        accounting: "Accounting",
        expenses: "Expenses",
        invoices: "Invoices",
        sales: "Sales Report"

    };


    const subtitles = {

        dashboard:
            "Welcome to Royal Chicken Admin Panel",

        orders:
            "Manage customer orders",

        accounting:
            "Complete business financial overview",

        expenses:
            "Add and manage business expenses",

        invoices:
            "View and generate customer invoices",

        sales:
            "Date-wise and monthly sales"

    };


    setText(
        "page-title",
        titles[sectionId] || "Dashboard"
    );

    setText(
        "page-subtitle",
        subtitles[sectionId] || ""
    );


    if (sectionId === "accounting") {
        calculateAccounting();
    }


    if (sectionId === "expenses") {
        renderExpenses();
    }


    if (sectionId === "invoices") {
        renderInvoices(allOrders);
    }


    if (sectionId === "sales") {
        calculateSales();
    }

};


/* =========================================================
   CURRENT DATE
========================================================= */

function updateCurrentDate() {

    const element =
        document.getElementById("current-date");

    if (!element) return;

    element.textContent =
        new Date().toLocaleDateString("en-IN", {
            weekday: "short",
            day: "2-digit",
            month: "short",
            year: "numeric"
        });
}


/* =========================================================
   NEW ORDER VOICE
========================================================= */

let orderAlertsEnabled = false;


/* =========================================================
   ENABLE SOUND BUTTON
========================================================= */

window.enableOrderAlerts = function () {

    try {

        if (!("speechSynthesis" in window)) {

            alert(
                "Is browser me voice support nahi hai."
            );

            return;
        }

        window.speechSynthesis.cancel();

        const testVoice =
            new SpeechSynthesisUtterance(
                "Royal Chicken notification"
            );

        testVoice.lang = "en-IN";
        testVoice.rate = 0.9;
        testVoice.pitch = 1;
        testVoice.volume = 1;

        window.speechSynthesis.speak(
            testVoice
        );

        orderAlertsEnabled = true;

        localStorage.setItem(
            "royalChickennotificationSoundEnabled",
            "true"
        );

        alert(
            "🔊 Royal Chicken notification sound enabled!"
        );

    } catch (error) {

        console.error(
            "Sound enable error:",
            error
        );

    }

};


/* =========================================================
   PLAY NEW ORDER VOICE
========================================================= */

function playNewOrderVoice() {

    if (!orderAlertsEnabled) {
        return;
    }

    try {

        window.speechSynthesis.cancel();

        const voice =
            new SpeechSynthesisUtterance(
                "ROYAL CHICKEN HAVE NEW ORDER"
            );

        voice.lang = "en-IN";
        voice.rate = 0.85;
        voice.pitch = 1;
        voice.volume = 1;

        window.speechSynthesis.speak(
            voice
        );

    } catch (error) {

        console.error(
            "Order voice error:",
            error
        );

    }

}

/* =========================================================
   LOAD ORDERS - REAL TIME
========================================================= */

window.loadOrders = function() {

    const ordersList =
        document.getElementById("orders-list");


    if (ordersList) {

        ordersList.innerHTML = `
            <div class="loading-state">
                Loading orders...
            </div>
        `;

    }


    if (orderListenerStarted) {
        return;
    }

    orderListenerStarted = true;


    try {

        const q = query(
            collection(db, "orders"),
            orderBy("createdAt", "desc")
        );


        onSnapshot(
            q,

            function(snapshot) {

                const newOrders = [];


                if (!firstOrderSnapshot) {

                    snapshot.docChanges()
                        .forEach(change => {

                            if (
                                change.type === "added"
                            ) {

                                newOrders.push(
                                    change.doc.id
                                );

                            }

                        });

                }


                allOrders = [];


                snapshot.forEach(item => {

                    allOrders.push({

                        id: item.id,
                        ...item.data()

                    });

                });


                renderOrders(allOrders);

                updateDashboard();

                renderInvoices(allOrders);

                calculateSales();

                calculateAccounting();


                if (
                    !firstOrderSnapshot &&
                    newOrders.length > 0
                ) {

                    const pendingCount =
                        allOrders.filter(order =>
                            (order.status || "Pending") ===
                            "Pending"
                        ).length;


                    setText(
                        "notification-count",
                        pendingCount
                    );

                    setText(
                        "pending-order-count",
                        pendingCount
                    );


                    playNewOrderVoice();


                    if (
                        "Notification" in window &&
                        Notification.permission ===
                        "granted"
                    ) {

                        new Notification(
                            "Royal Chicken",
                            {
                                body:
                                    "You have a new order.",
                                icon: "images/royal-chicken-logo.jpeg"
                            }
                        );

                    }

                }


                firstOrderSnapshot = false;

            },


            function(error) {

                console.error(
                    "Orders error:",
                    error
                );

                if (ordersList) {

                    ordersList.innerHTML = `
                        <div class="empty-state">
                            Unable to load orders.
                        </div>
                    `;

                }

            }
        );


    } catch (error) {

        console.error(
            "Orders listener error:",
            error
        );

        orderListenerStarted = false;

    }

};


/* =========================================================
   RENDER ORDERS
========================================================= */

function renderOrders(orders) {

    const container =
        document.getElementById("orders-list");

    if (!container) return;

    if (!orders.length) {

        container.innerHTML = `
            <div class="empty-state">
                No orders found.
            </div>
        `;

        return;
    }

    container.innerHTML = orders.map(order => {

        const date =
            getDateValue(order.createdAt);

        const status =
            order.status || "Pending";

        const items =
            Array.isArray(order.items)
                ? order.items
                : [];

        return `
            <div class="order-card">

                <!-- TOP -->
                <div class="order-card-header">

                    <div class="order-number-area">

                        <strong class="order-number">
                            ${escapeHTML(
                                order.orderNumber || "Order"
                            )}
                        </strong>

                        <span class="order-date">
                            ${formatDate(date)}
                        </span>

                    </div>


                    <!-- STATUS DROPDOWN -->
                    <div class="order-status-area">

                        <select
                            class="order-status-select status-${status
                                .toLowerCase()
                                .replace(/\s+/g, "-")
                                .replace(/[^\w-]/g, "")
                            }"
                            onchange="changeOrderStatus('${order.id}', this.value)"
                        >

                            ${[
                                "Pending",
                                "Accepted",
                                "Preparing",
                                "Out for Delivery",
                                "Delivered",
                                "Cancelled"
                            ].map(option => `

                                <option
                                    value="${option}"
                                    ${status === option ? "selected" : ""}
                                >
                                    ${option}
                                </option>

                            `).join("")}

                        </select>

                    </div>

                </div>


               <!-- CUSTOMER -->
<div class="order-customer">

    <div class="customer-detail">
        <span class="customer-label">Customer Name</span>
        <strong>
            ${escapeHTML(order.customerName || "-")}
        </strong>
    </div>

    <div class="customer-detail">
        <span class="customer-label">Phone Number</span>
        <strong>
            ${escapeHTML(order.phone || "-")}
        </strong>
    </div>

    <div class="customer-detail">
        <span class="customer-label">Delivery Address</span>
        <strong>
            ${escapeHTML(order.address || "-")}
        </strong>
    </div>

</div>
                <!-- DESCRIPTION -->
${order.description ? `
    <div class="order-description">
        <div class="order-description-title">
            📝 Customer Description
        </div>

        <div class="order-description-text">
            ${escapeHTML(order.description)}
        </div>
    </div>
` : ""}


                <!-- ITEMS -->
                <div class="order-items">

                    ${items.map(item => `

                        <div class="order-item-row">

                            <span>
                                ${escapeHTML(
                                    item.name || "-"
                                )}

                                × ${item.quantity || 0}
                            </span>

                            <strong>
                                ${money(item.itemTotal)}
                            </strong>

                        </div>

                    `).join("")}

                </div>


                <!-- BOTTOM -->
                <div class="order-card-footer">

                    <strong>
                        Total: ${money(order.total)}
                    </strong>

                    <div class="order-buttons">

                        <button
                            class="primary-btn"
                            onclick="openInvoice('${order.id}')"
                        >
                            Invoice
                        </button>

                        <button
                            class="cancel-btn"
                            onclick="deleteOrder('${order.id}')"
                        >
                            Delete
                        </button>

                    </div>

                </div>

            </div>
        `;

    }).join("");

    updatePendingCount();
}
/* =========================================================
   FILTER ORDERS
========================================================= */

window.filterOrders = function() {

    const search =
        document
            .getElementById("order-search")
            ?.value
            .toLowerCase()
            .trim() || "";


    const status =
        document
            .getElementById("order-status-filter")
            ?.value || "all";


    const date =
        document
            .getElementById("order-date-filter")
            ?.value || "";


    const filtered =
        allOrders.filter(order => {

            const searchable = `

                ${order.orderNumber || ""}
                ${order.customerName || ""}
                ${order.phone || ""}

            `.toLowerCase();


            if (
                search &&
                !searchable.includes(search)
            ) {
                return false;
            }


            if (
                status !== "all" &&
                (order.status || "Pending") !== status
            ) {
                return false;
            }


            if (date) {

                const orderDate =
                    getDateValue(order.createdAt);

                if (
                    !orderDate ||
                    dateOnly(orderDate) !== date
                ) {
                    return false;
                }

            }


            return true;

        });


    renderOrders(filtered);

};


/* =========================================================
   VIEW ORDER - PROFESSIONAL ORDER DETAILS
========================================================= */

window.viewOrder = function(orderId) {

    const order = allOrders.find(item => item.id === orderId);

    if (!order) {
        alert("Order nahi mila.");
        return;
    }

    const modal = document.getElementById("order-modal");
    const details = document.getElementById("order-details");
    const number = document.getElementById("order-modal-number");

    if (!modal || !details) {
        console.error("Order modal HTML nahi mila.");
        return;
    }

    const items = Array.isArray(order.items)
        ? order.items
        : [];

    const status = order.status || "Pending";

    if (number) {
        number.textContent =
            order.orderNumber || "Order Details";
    }

    details.innerHTML = `

        <div class="order-detail-modern">

            <!-- CUSTOMER -->
            <div class="order-info-grid">

                <div class="order-info-box">
                    <span>Customer</span>
                    <strong>
                        ${escapeHTML(order.customerName || "-")}
                    </strong>
                </div>

                <div class="order-info-box">
                    <span>Phone</span>
                    <strong>
                        ${escapeHTML(order.phone || "-")}
                    </strong>
                </div>

                <div class="order-info-box">
                    <span>Payment</span>
                    <strong>
                        ${escapeHTML(order.paymentMethod || "-")}
                    </strong>
                </div>

                <div class="order-info-box">
                    <span>Order Date</span>
                    <strong>
                        ${formatDate(
                            getDateValue(order.createdAt)
                        )}
                    </strong>
                </div>

            </div>


            <!-- ADDRESS -->
<div class="order-address-box">

    <span>Delivery Address</span>

    <strong>
        ${escapeHTML(order.address || "-")}
    </strong>

</div>


<!-- DESCRIPTION -->
<div class="order-address-box">

    <span>Description</span>

    <strong>
        ${escapeHTML(order.description || "-")}
    </strong>

</div>

            <!-- STATUS -->
            <div class="order-status-box">

                <div>

                    <span>Order Status</span>

                    <strong>
                        ${escapeHTML(status)}
                    </strong>

                </div>

                <select
                    onchange="changeOrderStatus(
                        '${order.id}',
                        this.value
                    )"
                >

                    ${[
                        "Pending",
                        "Accepted",
                        "Preparing",
                        "Out for Delivery",
                        "Delivered",
                        "Cancelled"
                    ].map(item => `
                        <option
                            value="${item}"
                            ${status === item ? "selected" : ""}
                        >
                            ${item}
                        </option>
                    `).join("")}

                </select>

            </div>


            <!-- ITEMS -->
            <div class="order-items-modern">

                <div class="order-items-title">

                    <h3>
                        Order Items
                    </h3>

                    <span>
                        ${items.length} item${items.length !== 1 ? "s" : ""}
                    </span>

                </div>


                <div class="order-items-list">

                    ${
                        items.length
                        ?
                        items.map(item => `

                            <div class="modern-item-row">

                                <div class="modern-item-left">

                                    <strong>
                                        ${escapeHTML(
                                            item.name || "Product"
                                        )}
                                    </strong>

                                    <span>
                                        Qty:
                                        ${item.quantity || 0}
                                    </span>

                                </div>


                                <div class="modern-item-right">

                                    <strong>
                                        ${money(
                                            item.itemTotal
                                        )}
                                    </strong>

                                </div>

                            </div>

                        `).join("")
                        :
                        `
                        <div class="empty-state">
                            No items found.
                        </div>
                        `
                    }

                </div>

            </div>


            <!-- TOTAL -->
            <div class="order-total-modern">

                <span>
                    Total Amount
                </span>

                <strong>
                    ${money(order.total)}
                </strong>

            </div>


            <!-- ACTIONS -->
            <div class="order-detail-actions">

                <button
                    type="button"
                    class="secondary-btn"
                    onclick="closeOrderModal()"
                >
                    Close
                </button>

                <button
                    type="button"
                    class="primary-btn"
                    onclick="closeOrderModal(); openInvoice('${order.id}')"
                >
                    View Invoice
                </button>

            </div>

        </div>

    `;

    modal.style.display = "flex";
};

/* =========================================================
   CLOSE ORDER MODAL
========================================================= */

window.closeOrderModal = function() {

    const modal =
        document.getElementById("order-modal");

    if (modal) {
        modal.style.display = "none";
    }

};


/* =========================================================
   CHANGE ORDER STATUS
========================================================= */

window.changeOrderStatus = async function(
    orderId,
    status
) {

    try {

        await updateDoc(
            doc(db, "orders", orderId),
            {
                status: status
            }
        );


        const order =
            allOrders.find(
                item => item.id === orderId
            );


        if (order) {
            order.status = status;
        }


        renderOrders(allOrders);

        updateDashboard();

        calculateSales();

        calculateAccounting();


    } catch (error) {

        console.error(error);

        alert(
            "Status update failed."
        );

    }

};

/* =========================================================
   DELETE ORDER - MOVE TO RECYCLE BIN
========================================================= */

window.deleteOrder = async function(orderId) {

    const order =
        allOrders.find(
            item => item.id === orderId
        );

    if (!order) return;


    const confirmDelete =
        confirm(
            `Move order ${
                order.orderNumber || ""
            } to Recycle Bin?`
        );


    if (!confirmDelete) return;


    try {

        await updateDoc(
            doc(db, "orders", orderId),
            {
                deleted: true,
                deletedAt: new Date().toISOString()
            }
        );


        /* Update local data */

        allOrders =
            allOrders.map(item => {

                if (item.id === orderId) {

                    return {
                        ...item,
                        deleted: true,
                        deletedAt:
                            new Date().toISOString()
                    };

                }

                return item;

            });


        /* Refresh screens */

        renderOrders(allOrders);

        updateDashboard();

        renderInvoices(allOrders);

        calculateSales();

        calculateAccounting();

        loadInvoiceRecycleBin();


        alert(
            "Order moved to Recycle Bin."
        );


    } catch (error) {

        console.error(
            "Recycle Bin error:",
            error
        );

        alert(
            "Order Recycle Bin me move nahi hua.\n\n" +
            error.message
        );

    }

};
/* =========================================================
   PENDING COUNT
========================================================= */

function updatePendingCount() {

    const pending =
        allOrders.filter(order =>
            (order.status || "Pending") ===
            "Pending"
        ).length;


    [
        "pending-order-count",
        "notification-count",
        "dashboard-pending"
    ].forEach(id => {

        setText(id, pending);

    });

}


/* =========================================================
   DASHBOARD
========================================================= */

function updateDashboard() {

    const today =
        new Date();


    const todayOrders =
        allOrders.filter(order => {

            const date =
                getDateValue(order.createdAt);

            return (
                date &&
                isSameDay(date, today)
            );

        });


    const todaySales =
        todayOrders.reduce(
            (sum, order) =>
                sum + Number(order.total || 0),
            0
        );


    const pending =
        allOrders.filter(order =>
            (order.status || "Pending") ===
            "Pending"
        ).length;


    setText(
        "today-orders",
        todayOrders.length
    );


    setText(
        "today-sales",
        money(todaySales)
    );


    setText(
        "dashboard-pending",
        pending
    );


    updateRecentOrders(todayOrders);

    updateMonthlySummary();

}


/* =========================================================
   RECENT ORDERS
========================================================= */

function updateRecentOrders(orders) {

    const container =
        document.getElementById(
            "recent-orders"
        );

    if (!container) return;


    const recent =
        orders.slice(0, 5);


    if (!recent.length) {

        container.innerHTML = `
            <div class="empty-state">
                No orders yet
            </div>
        `;

        return;
    }


    container.innerHTML =
        recent.map(order => `

            <div class="financial-row">

                <span>

                    ${escapeHTML(
                        order.orderNumber ||
                        "Order"
                    )}

                    -

                    ${escapeHTML(
                        order.customerName ||
                        ""
                    )}

                </span>

                <strong>
                    ${money(order.total)}
                </strong>

            </div>

        `).join("");

}


/* =========================================================
   MONTHLY SUMMARY
========================================================= */

function updateMonthlySummary() {

    const now =
        new Date();


    const monthOrders =
        allOrders.filter(order => {

            const date =
                getDateValue(order.createdAt);

            return (
                date &&
                date.getMonth() === now.getMonth() &&
                date.getFullYear() === now.getFullYear()
            );

        });


    const sales =
        monthOrders.reduce(
            (sum, order) =>
                sum + Number(order.total || 0),
            0
        );


    const expenses =
        allExpenses
            .filter(expense => {

                const date =
                    getDateValue(expense.date);

                return (
                    date &&
                    date.getMonth() === now.getMonth() &&
                    date.getFullYear() === now.getFullYear()
                );

            })
            .reduce(
                (sum, expense) =>
                    sum + Number(expense.amount || 0),
                0
            );


    const profit =
        sales - expenses;


    setText(
        "month-sales",
        money(sales)
    );


    setText(
        "month-expenses",
        money(expenses)
    );


    setText(
        "month-profit",
        money(profit)
    );


    setText(
        "today-profit",
        money(profit)
    );

}


/* =========================================================
   LOAD EXPENSES
========================================================= */

window.loadExpenses = async function() {

    const container =
        document.getElementById(
            "expenses-list"
        );


    if (container) {

        container.innerHTML = `
            <div class="loading-state">
                Loading expenses...
            </div>
        `;

    }


    try {

        const q =
            query(
                collection(db, "expenses"),
                orderBy("createdAt", "desc")
            );


        const snapshot =
            await getDocs(q);


        allExpenses = [];


        snapshot.forEach(item => {

            allExpenses.push({

                id: item.id,
                ...item.data()

            });

        });


        renderExpenses();

        calculateAccounting();

        updateMonthlySummary();


    } catch (error) {

        console.error(
            "Expenses loading error:",
            error
        );


        if (container) {

            container.innerHTML = `
                <div class="empty-state">
                    Unable to load expenses.
                </div>
            `;

        }

    }

};


/* =========================================================
   EXPENSE MODAL
========================================================= */

window.openExpenseModal = function() {

    const modal =
        document.getElementById(
            "expense-modal"
        );


    if (!modal) return;


    const date =
        document.getElementById(
            "expense-date"
        );


    if (
        date &&
        !date.value
    ) {

        date.value =
            dateOnly(new Date());

    }


    modal.style.display = "flex";

};


window.closeExpenseModal = function() {

    const modal =
        document.getElementById(
            "expense-modal"
        );


    if (modal) {
        modal.style.display = "none";
    }

};


/* =========================================================
   SAVE EXPENSE
========================================================= */

window.saveExpense = async function(event) {

    if (event) {
        event.preventDefault();
    }


    const name =
        document
            .getElementById("expense-name")
            ?.value
            .trim();


    const amount =
        Number(
            document
                .getElementById("expense-amount")
                ?.value || 0
        );


    const date =
        document
            .getElementById("expense-date")
            ?.value;


    const category =
        document
            .getElementById("expense-category")
            ?.value ||
        "Other";


    const note =
        document
            .getElementById("expense-note")
            ?.value
            .trim() ||
        "";


    if (!name) {

        alert(
            "Expense name enter karo."
        );

        return;
    }


    if (!amount || amount <= 0) {

        alert(
            "Valid amount enter karo."
        );

        return;
    }


    if (!date) {

        alert(
            "Expense date select karo."
        );

        return;
    }


    try {

        await addDoc(
            collection(db, "expenses"),
            {

                name,
                amount,
                date,
                category,
                note,
                createdAt:
                    serverTimestamp()

            }
        );


        alert(
            "Expense successfully saved."
        );


        const form =
            document.getElementById(
                "expense-form"
            );


        if (form) {
            form.reset();
        }


        closeExpenseModal();

        await loadExpenses();


    } catch (error) {

        console.error(
            "EXPENSE SAVE ERROR:",
            error
        );


        alert(
            "Expense save nahi ho paya.\n\n" +
            error.message
        );

    }

};


/* =========================================================
   RENDER EXPENSES
========================================================= */

window.renderExpenses = function() {
    

    const container =
        document.getElementById(
            "expenses-list"
        );


    if (!container) return;


    let total = 0;


    allExpenses.forEach(expense => {

        total +=
            Number(expense.amount || 0);

    });


    const header = `

        <div class="expenses-top-bar">

            <div class="expenses-heading">

                <div class="expenses-heading-icon">
                    ₹
                </div>

                <div>

                    <h2>
                        Expense Records
                    </h2>

                    <p>
                        Track and manage your business expenses
                    </p>

                </div>

            </div>


            <button
                type="button"
                class="add-expense-btn"
                onclick="openExpenseModal()"
            >
                <span>+</span>
                Add Expense
            </button>

        </div>


        <div class="expense-total-box">

            <div class="expense-total-left">

                <span class="expense-total-label">
                    Total Expense
                </span>

                <small>
                    All recorded expenses
                </small>

            </div>


            <strong class="expense-total-amount">

                -₹${total.toLocaleString("en-IN")}

            </strong>

        </div>

    `;


    if (!allExpenses.length) {

        container.innerHTML = `

            ${header}

            <div class="expense-empty-box">

                <div class="expense-empty-icon">
                    ₹
                </div>

                <h3>
                    No expenses yet
                </h3>

                <p>
                    Add your first business expense
                    using the button above.
                </p>

            </div>

        `;


        setText(
            "total-expenses",
            "-₹0"
        );


        return;
    }


    const records =
        allExpenses
            .map(expense => {

                const amount =
                    Number(
                        expense.amount || 0
                    );


                return `

                    <div class="expense-record-card">

                        <div class="expense-record-main">

                            <div class="expense-record-icon">
                                ₹
                            </div>


                            <div class="expense-record-details">

                                <div class="expense-record-title-row">

                                    <strong>
                                        ${escapeHTML(
                                            expense.name ||
                                            "Expense"
                                        )}
                                    </strong>


                                    <span class="expense-category">

                                        ${escapeHTML(
                                            expense.category ||
                                            "Other"
                                        )}

                                    </span>

                                </div>


                                <div class="expense-record-meta">

                                    <span>
                                        📅
                                        ${escapeHTML(
                                            expense.date ||
                                            "-"
                                        )}
                                    </span>

                                    ${
                                        expense.note
                                        ?
                                        `
                                        <span>
                                            ${escapeHTML(
                                                expense.note
                                            )}
                                        </span>
                                        `
                                        :
                                        ""
                                    }

                                </div>

                            </div>

                        </div>


                        <div class="expense-record-actions">

                            <strong class="expense-record-amount">

                                -₹${amount.toLocaleString(
                                    "en-IN"
                                )}

                            </strong>


                            <button
                                type="button"
                                class="expense-delete-btn"
                                onclick="
                                    deleteExpense(
                                        '${expense.id}'
                                    )
                                "
                            >
                                Delete
                            </button>

                        </div>

                    </div>

                `;

            })
            .join("");


    container.innerHTML = `

        ${header}

        <div class="expense-records-wrapper">

            ${records}

        </div>

    `;


    setText(
        "total-expenses",
        "-₹" +
        total.toLocaleString("en-IN")
    );

};


/* =========================================================
   DELETE EXPENSE
========================================================= */

window.deleteExpense = async function(expenseId) {

    const expense =
        allExpenses.find(
            item => item.id === expenseId
        );


    if (!expense) return;


    const confirmDelete =
        confirm(
            `Delete expense "${
                expense.name || "Expense"
            }"?`
        );


    if (!confirmDelete) return;


    try {

        await deleteDoc(
            doc(
                db,
                "expenses",
                expenseId
            )
        );


        allExpenses =
            allExpenses.filter(
                item => item.id !== expenseId
            );


        renderExpenses();

        calculateAccounting();

        updateDashboard();


        alert(
            "Expense deleted successfully."
        );


    } catch (error) {

        console.error(
            "EXPENSE DELETE ERROR:",
            error
        );


        alert(
            "Expense delete nahi ho paya.\n\n" +
            error.message
        );

    }

};


/* =========================================================
   ACCOUNTING
========================================================= */

window.calculateAccounting = function() {

    const from =
        document
            .getElementById("accounting-from")
            ?.value;


    const to =
        document
            .getElementById("accounting-to")
            ?.value;


    let orders =
        [...allOrders];


    let expenses =
        [...allExpenses];


    if (from) {

        orders =
            orders.filter(order => {

                const date =
                    getDateValue(
                        order.createdAt
                    );

                return (
                    date &&
                    dateOnly(date) >= from
                );

            });


        expenses =
            expenses.filter(expense =>
                String(
                    expense.date || ""
                ) >= from
            );

    }


    if (to) {

        orders =
            orders.filter(order => {

                const date =
                    getDateValue(
                        order.createdAt
                    );

                return (
                    date &&
                    dateOnly(date) <= to
                );

            });


        expenses =
            expenses.filter(expense =>
                String(
                    expense.date || ""
                ) <= to
            );

    }


    const sales =
        orders.reduce(
            (sum, order) =>
                sum +
                Number(order.total || 0),
            0
        );


    const expenseTotal =
        expenses.reduce(
            (sum, expense) =>
                sum +
                Number(expense.amount || 0),
            0
        );


    const profit =
        sales - expenseTotal;


    setText(
        "accounting-sales",
        money(sales)
    );

    setText(
        "accounting-expenses",
        money(expenseTotal)
    );

    setText(
        "accounting-profit",
        money(profit)
    );

    setText(
        "accounting-orders",
        orders.length
    );


    setText(
        "financial-sales",
        money(sales)
    );

    setText(
        "financial-expenses",
        money(expenseTotal)
    );

    setText(
        "financial-profit",
        money(profit)
    );

};


/* =========================================================
   INVOICES
========================================================= */

function renderInvoices(orders) {

    const container =
        document.getElementById("invoices-list");

    if (!container) return;


    // Deleted orders ko invoices me mat dikhao
    const activeInvoices =
        orders.filter(
            order => order.deleted !== true
        );


    if (!activeInvoices.length) {

        container.innerHTML = `
            <div class="empty-state">
                No invoices found.
            </div>
        `;

        return;
    }


    container.innerHTML =
        activeInvoices.map(order => `

            <div class="invoice-card">

                <div>

                    <strong>
                        ${escapeHTML(
                            order.orderNumber ||
                            "Invoice"
                        )}
                    </strong>

                    <span>
                        ${escapeHTML(
                            order.customerName ||
                            "-"
                        )}
                    </span>

                    <small>
                        ${formatDate(
                            getDateValue(
                                order.createdAt
                            )
                        )}
                    </small>

                </div>


                <strong>
                    ${money(order.total)}
                </strong>


                <button
                    class="primary-btn"
                    onclick="openInvoice('${order.id}')"
                >
                    View Invoice
                </button>


                <button
                    type="button"
                    class="danger-btn"
                    onclick="deleteInvoiceToRecycleBin('${order.id}')"
                >
                    🗑 Delete
                </button>

            </div>

        `).join("");
}
/* =========================================================
   FILTER INVOICES
========================================================= */

window.filterInvoices = function() {

    const search =
        document
            .getElementById("invoice-search")
            ?.value
            .toLowerCase()
            .trim() || "";


    const date =
        document
            .getElementById("invoice-date")
            ?.value || "";


    const filtered =
        allOrders.filter(order => {

            const searchable = `

                ${order.orderNumber || ""}
                ${order.customerName || ""}
                ${order.phone || ""}

            `.toLowerCase();


            if (
                search &&
                !searchable.includes(search)
            ) {
                return false;
            }


            if (date) {

                const orderDate =
                    getDateValue(
                        order.createdAt
                    );


                if (
                    !orderDate ||
                    dateOnly(orderDate) !== date
                ) {
                    return false;
                }

            }


            return true;

        });


    renderInvoices(filtered);

};


/* =========================================================
   ROYAL CHICKEN - PREMIUM INVOICE
========================================================= */

window.openInvoice = function(orderId) {

    const order =
        allOrders.find(
            item => item.id === orderId
        );

    if (!order) {
        alert("Invoice order nahi mila.");
        return;
    }

    const modal =
        document.getElementById("invoice-modal");

    const content =
        document.getElementById("invoice-content");

    if (!modal || !content) {
        console.error("Invoice modal/content nahi mila.");
        return;
    }

    const items =
        Array.isArray(order.items)
            ? order.items
            : [];


    /* =====================================================
       ITEMS
    ===================================================== */

    const itemsHTML = items.length
        ? items.map((item, index) => {

            const quantity =
                Number(item.quantity || 0);

            const price =
                Number(item.price || 0);

            const total =
                Number(item.itemTotal || 0);

            return `
                <tr>

                    <td class="invoice-no">
                        ${index + 1}
                    </td>

                    <td class="invoice-product">
                        <strong>
                            ${escapeHTML(
                                item.name || "Product"
                            )}
                        </strong>
                    </td>

                    <td class="invoice-qty">
                        ${quantity} kg
                    </td>

                    <td class="invoice-rate">
                        ${money(price)}
                    </td>

                    <td class="invoice-amount">
                        ${money(total)}
                    </td>

                </tr>
            `;

        }).join("")
        :
        `
            <tr>
                <td colspan="5"
                    style="text-align:center;">
                    No items found
                </td>
            </tr>
        `;


    /* =====================================================
       INVOICE
    ===================================================== */

    content.innerHTML = `

        <div class="rc-invoice-paper">


            <!-- =========================================
                 TOP BRANDING
            ========================================== -->

            <div class="rc-invoice-header">

                <div class="rc-brand-area">

                    <img
                        src="images/royal-chicken-logo.jpeg"
                        alt="Royal Chicken Logo"
                        class="rc-invoice-logo"
                    >

                    <div class="rc-brand-text">


    <p>
        Fresh Chicken • Quality • Hygiene
    </p>

</div>

                </div>


                <div class="rc-invoice-heading">

                    <span>
                        TAX / SALES INVOICE
                    </span>

                    <strong>
                        ${escapeHTML(
                            order.orderNumber || "INVOICE"
                        )}
                    </strong>

                    <small>
                        ${formatDate(
                            getDateValue(
                                order.createdAt
                            )
                        )}
                    </small>

                </div>

            </div>


            <!-- GOLD LINE -->

            <div class="rc-gold-line"></div>


            <!-- =========================================
                 CUSTOMER INFORMATION
            ========================================== -->

            <div class="rc-info-grid">


                <div class="rc-info-card">

                    <span class="rc-info-label">
                        CUSTOMER
                    </span>

                    <strong>
                        ${escapeHTML(
                            order.customerName || "-"
                        )}
                    </strong>

                    <p>
                        ${escapeHTML(
                            order.phone || "-"
                        )}
                    </p>

                </div>


                <div class="rc-info-card">

                    <span class="rc-info-label">
                        DELIVERY ADDRESS
                    </span>

                    <strong>
                        ${escapeHTML(
                            order.address || "-"
                        )}
                    </strong>

                </div>
                <div class="rc-info-card">

    <span class="rc-info-label">
        DESCRIPTION
    </span>

    <strong>
        ${escapeHTML(
            order.description || "-"
        )}
    </strong>

</div>


                <div class="rc-info-card">

                    <span class="rc-info-label">
                        PAYMENT
                    </span>

                    <strong>
                        ${escapeHTML(
                            order.paymentMethod || "-"
                        )}
                    </strong>

                    <p>
                        ${escapeHTML(
                            order.status || "Pending"
                        )}
                    </p>

                </div>


            </div>


            <!-- =========================================
                 ITEMS TABLE
            ========================================== -->

            <div class="rc-items-section">

                <div class="rc-section-title">

                    <span>
                        ORDER DETAILS
                    </span>

                    <small>
                        ${items.length}
                        item${items.length !== 1 ? "s" : ""}
                    </small>

                </div>


                <table class="rc-invoice-table">

                    <thead>

                        <tr>

                            <th>
                                #
                            </th>

                            <th>
                                PRODUCT
                            </th>

                            <th>
                                QTY
                            </th>

                            <th>
                                RATE
                            </th>

                            <th>
                                AMOUNT
                            </th>

                        </tr>

                    </thead>


                    <tbody>

                        ${itemsHTML}

                    </tbody>

                </table>

            </div>


            <!-- =========================================
                 TOTAL
            ========================================== -->

            <div class="rc-total-area">

                <div class="rc-total-label">

                    <span>
                        TOTAL AMOUNT
                    </span>

                    <small>
                        Thank you for your order
                    </small>

                </div>


                <strong>
                    ${money(order.total)}
                </strong>

            </div>


            <!-- =========================================
                 FOOTER
            ========================================== -->

            <div class="invoice-footer">
    <p>
        Thank you for ordering from Royal Chicken.
    </p>
    <strong>
        Fresh & Quality Chicken
    </strong>
    <div class="invoice-whatsapp-box no-print">
        <button
            type="button"
            class="invoice-whatsapp-btn"
            onclick="sendInvoiceWhatsApp('${order.id}')"
        >
            Invoice PDF WhatsApp
        </button>
    </div>
</div>

                <div class="rc-footer-note">

                    Fresh chicken prepared with
                    care and hygiene.

                </div>

            </div>


            <!-- =========================================
                 FOOTER BRAND
            ========================================== -->

            <div class="rc-footer-brand">

                <span>
                    ROYAL CHICKEN
                </span>

                <small>
                    Fresh • Quality • Hygiene
                </small>

            </div>


        </div>

    `;


    modal.style.display = "flex";

};
/* =========================================================
   CLOSE INVOICE
========================================================= */

window.closeInvoiceModal = function() {

    const modal =
        document.getElementById(
            "invoice-modal"
        );


    if (modal) {
        modal.style.display = "none";
    }

};

/* =========================================================
   PRINT INVOICE - SAME AS SCREEN
========================================================= */

window.printInvoice = function () {

    const invoiceContent =
        document.getElementById("invoice-content");

    if (!invoiceContent) {
        alert("Invoice content nahi mila.");
        return;
    }

    if (!invoiceContent.innerHTML.trim()) {
        alert("Invoice empty hai.");
        return;
    }

    const printWindow =
        window.open("", "_blank");

    if (!printWindow) {
        alert("Popup blocked hai. Browser me popup allow karo.");
        return;
    }


    /* Get all CSS from admin.html / admin.css */

    let styles = "";

    document
        .querySelectorAll("link[rel='stylesheet'], style")
        .forEach(element => {

            if (element.tagName === "STYLE") {

                styles += element.innerHTML;

            } else {

                styles += `
                    @import url("${element.href}");
                `;

            }

        });


    printWindow.document.write(`

        <!DOCTYPE html>

        <html>

        <head>

            <meta charset="UTF-8">

            <title>Royal Chicken Invoice</title>

            <style>

                ${styles}


                /* PRINT SETTINGS */

                @page {

                    size: A4;

                    margin: 12mm;

                }


                html,
                body {

                    margin: 0 !important;

                    padding: 0 !important;

                    background: #ffffff !important;

                }


                body {

                    font-family:
                        Arial,
                        Helvetica,
                        sans-serif;

                    color: #111111;

                    -webkit-print-color-adjust:
                        exact !important;

                    print-color-adjust:
                        exact !important;

                }


                #invoice-content {

                    width: 100% !important;

                    padding: 0 !important;

                    overflow: visible !important;

                    background: #ffffff !important;

                }


                .invoice-paper {

                    width: 100% !important;

                    max-width: none !important;

                    margin: 0 auto !important;

                }


                .no-print {

                    display: none !important;

                }


                .invoice-table {

                    page-break-inside: auto;

                }


                .invoice-table tr {

                    page-break-inside: avoid;

                    page-break-after: auto;

                }


                .invoice-table thead {

                    display: table-header-group;

                }


                .invoice-table tfoot {

                    display: table-footer-group;

                }


            </style>

        </head>


        <body>


            <div id="invoice-content">

                ${invoiceContent.innerHTML}

            </div>


            <script>

                window.onload = function () {

                    setTimeout(function () {

                        window.print();

                    }, 700);

                };


                window.onafterprint = function () {

                    setTimeout(function () {

                        window.close();

                    }, 300);

                };

            <\/script>


        </body>

        </html>

    `);


    printWindow.document.close();

};
/* =========================================================
   SEND INVOICE PDF TO WHATSAPP
========================================================= */

window.sendInvoiceWhatsApp = async function(orderId) {

    const order =
        allOrders.find(
            item => item.id === orderId
        );

    if (!order) {

        alert("Invoice order nahi mila.");

        return;
    }


    const invoiceContent =
        document.getElementById("invoice-content");


    if (!invoiceContent) {

        alert("Invoice content nahi mila.");

        return;
    }


    /*
       Customer phone number
    */

    let phone =
        String(
            order.phone || ""
        ).replace(/\D/g, "");


    if (!phone) {

        alert(
            "Customer ka WhatsApp number nahi mila."
        );

        return;
    }


    /*
       India number ke liye 91 add karo
    */

    if (phone.length === 10) {

        phone = "91" + phone;

    }


    /*
       Invoice PDF banane ke liye
       browser print/share use hoga.
    */

    const printWindow =
        window.open("", "_blank");


    if (!printWindow) {

        alert(
            "Popup blocked hai. Browser me popup allow karo."
        );

        return;
    }


    printWindow.document.write(`

        <!DOCTYPE html>

        <html>

        <head>

            <meta charset="UTF-8">

            <title>
                Royal Chicken Invoice
            </title>

            <style>

                * {
                    box-sizing: border-box;
                }

                body {

                    margin: 0;

                    padding: 20px;

                    background: white;

                    font-family:
                        Arial,
                        Helvetica,
                        sans-serif;

                    color: #17211b;

                }

                .invoice-copy {

                    max-width: 850px;

                    margin: auto;

                }

                @page {

                    size: A4;

                    margin: 12mm;

                }

                @media print {

                    body {

                        padding: 0;

                        -webkit-print-color-adjust:
                            exact;

                        print-color-adjust:
                            exact;

                    }

                    .no-print {

                        display: none !important;

                    }

                }

            </style>

        </head>

        <body>

            <div class="invoice-copy">

                ${invoiceContent.innerHTML}

            </div>


            <script>

                window.onload = function() {

                    setTimeout(function() {

                        window.print();

                    }, 500);

                };

            <\/script>

        </body>

        </html>

    `);


    printWindow.document.close();


    /*
       WhatsApp message
    */

    const invoiceNumber =
        order.orderNumber ||
        "Invoice";


    const customerName =
        order.customerName ||
        "Customer";


    const message =
        `Hello ${customerName},

Thank you for ordering from Royal Chicken.

Your invoice ${invoiceNumber} is ready.

Total Amount: ₹${Number(
            order.total || 0
        ).toLocaleString("en-IN")}

Thank you for choosing Royal Chicken.
Fresh • Quality • Hygiene 🍗`;


    /*
       WhatsApp open
    */

    const whatsappURL =
        "https://wa.me/" +
        phone +
        "?text=" +
        encodeURIComponent(message);


    /*
       Small delay so invoice window opens first
    */

    setTimeout(function() {

        window.open(
            whatsappURL,
            "_blank"
        );

    }, 800);

};
/* =========================================================
   SALES REPORT
========================================================= */

window.setSalesPeriod = function(
    period,
    button
) {

    currentSalesPeriod =
        period;


    document
        .querySelectorAll(".period-btn")
        .forEach(btn => {

            btn.classList.remove(
                "active"
            );

        });


    if (button) {

        button.classList.add(
            "active"
        );

    }


    calculateSales();

};


/* =========================================================
   CALCULATE SALES
========================================================= */

function calculateSales() {

    let orders =
        [...allOrders];


    const now =
        new Date();


    if (
        currentSalesPeriod ===
        "today"
    ) {

        orders =
            orders.filter(order => {

                const date =
                    getDateValue(
                        order.createdAt
                    );

                return (
                    date &&
                    isSameDay(date, now)
                );

            });

    }


    if (
        currentSalesPeriod ===
        "week"
    ) {

        const start =
            new Date(now);


        start.setHours(
            0,
            0,
            0,
            0
        );


        start.setDate(
            now.getDate() - 6
        );


        orders =
            orders.filter(order => {

                const date =
                    getDateValue(
                        order.createdAt
                    );


                if (!date) {
                    return false;
                }


                return (
                    date >= start &&
                    date <= now
                );

            });

    }


    if (
        currentSalesPeriod ===
        "month"
    ) {

        orders =
            orders.filter(order => {

                const date =
                    getDateValue(
                        order.createdAt
                    );


                return (
                    date &&
                    date.getMonth() ===
                        now.getMonth() &&
                    date.getFullYear() ===
                        now.getFullYear()
                );

            });

    }


    /*
       ALL TIME:
       No filter required.
    */


    const revenue =
        orders.reduce(
            (sum, order) =>
                sum +
                Number(order.total || 0),
            0
        );


    const average =
        orders.length
            ? revenue / orders.length
            : 0;


    setText(
        "sales-orders",
        orders.length
    );


    setText(
        "sales-revenue",
        money(revenue)
    );


    setText(
        "average-order",
        money(average)
    );


    renderSalesList(orders);

}


/* =========================================================
   SALES LIST - SIMPLE INVOICE + AMOUNT
========================================================= */

function renderSalesList(orders) {

    const container =
        document.getElementById("sales-list");

    if (!container) return;

    /* =========================================
       NO SALES
    ========================================= */

    if (!orders.length) {

        container.innerHTML = `
            <div class="empty-state">
                No sales records found.
            </div>
        `;

        return;
    }


    /* =========================================
       SALES RECORDS
    ========================================= */

    container.innerHTML = `

        <div class="sales-simple-list">

            ${orders.map(order => {

                const invoiceNumber =
                    order.orderNumber || "Invoice";

                const amount =
                    money(order.total);

                return `

                    <div class="sales-simple-row">

                        <div class="sales-invoice-number">
                            ${escapeHTML(invoiceNumber)}
                        </div>

                        <strong class="sales-amount">
                            ${amount}
                        </strong>

                    </div>

                `;

            }).join("")}

        </div>

    `;
}

/* =========================================================
   EXPORT SALES CSV
========================================================= */

window.exportSalesCSV = function() {

    let orders =
        [...allOrders];


    const rows = [

        [
            "Date",
            "Order Number",
            "Customer",
            "Phone",
            "Payment",
            "Status",
            "Total"
        ]

    ];


    orders.forEach(order => {

        rows.push([

            formatDate(
                getDateValue(
                    order.createdAt
                )
            ),

            order.orderNumber || "",

            order.customerName || "",

            order.phone || "",

            order.paymentMethod || "",

            order.status || "Pending",

            order.total || 0

        ]);

    });


    const csv =
        rows
            .map(row =>
                row.map(value =>
                    `"${String(value)
                        .replace(
                            /"/g,
                            '""'
                        )}"`
                ).join(",")
            )
            .join("\n");


    const blob =
        new Blob(
            [csv],
            {
                type:
                    "text/csv;charset=utf-8;"
            }
        );


    const url =
        URL.createObjectURL(blob);


    const link =
        document.createElement("a");


    link.href = url;

    link.download =
        "Royal-Chicken-Sales.csv";


    document
        .body
        .appendChild(link);


    link.click();

    link.remove();


    URL.revokeObjectURL(url);

};


/* =========================================================
   DOM READY
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async function() {

        updateCurrentDate();
        loadDailyRates();


        const expenseDate =
            document.getElementById(
                "expense-date"
            );


        if (
            expenseDate &&
            !expenseDate.value
        ) {

            expenseDate.value =
                dateOnly(new Date());

        }


        /*
           ONLY ONE ORDERS LISTENER
        */

        loadOrders();


        /*
           LOAD EXPENSES
        */

        await loadExpenses();


        /*
           INITIAL CALCULATIONS
        */

        updateDashboard();

        calculateSales();

        calculateAccounting();

    }
);
/* =========================================================
   SEND INVOICE ON WHATSAPP
========================================================= */
window.sendInvoiceWhatsApp = function() {
    /*
       Current invoice se order number
       nikalne ke liye modal ke invoice number
       ko find karenge.
    */
    const invoiceContent =
        document.getElementById("invoice-content");
    if (!invoiceContent) {
        alert("Invoice nahi mila.");
        return;
    }
    /*
       Invoice number ke liye current order find karo.
       Hum invoice content ke andar order number
       ke basis par order identify karenge.
    */
    const invoiceNumberElement =
        invoiceContent.querySelector(".invoice-title strong");
    const invoiceNumber =
        invoiceNumberElement?.textContent?.trim() || "";
    const order =
        allOrders.find(
            item =>
                (item.orderNumber || "") === invoiceNumber
        );
    if (!order) {
        alert(
            "Order details nahi mili."
        );
        return;
    }
    /*
       CUSTOMER PHONE
    */
    let phone =
        String(order.phone || "")
            .replace(/\D/g, "");
    if (!phone) {
        alert(
            "Customer ka WhatsApp number nahi mila."
        );
        return;
    }
    /*
       Agar number 10 digit hai
       to India country code +91 add karo.
    */
    if (phone.length === 10) {
        phone = "91" + phone;
    }
    /*
       ITEMS
    */
    const items =
        Array.isArray(order.items)
            ? order.items
            : [];
    let itemText = "";
    items.forEach((item, index) => {
        itemText +=
            `${index + 1}. ${item.name || "Product"} ` +
            `× ${item.quantity || 0} kg - ` +
            `₹${Number(item.itemTotal || 0).toLocaleString("en-IN")}\n`;
    });
    /*
       WHATSAPP MESSAGE
    */
    const message =
`🧾 *ROYAL CHICKEN - INVOICE*
Invoice: *${order.orderNumber || "-"}*
👤 Customer: ${order.customerName || "-"}
📞 Phone: ${order.phone || "-"}
📦 *Order Details:*
${itemText}
💰 *Total Amount: ₹${Number(order.total || 0).toLocaleString("en-IN")}*
💳 Payment: ${order.paymentMethod || "-"}
📍 Delivery Address:
${order.address || "-"}
Thank you for ordering from *Royal Chicken*.
🍗 Fresh & Quality Chicken`;
    /*
       WHATSAPP URL
    */
    const whatsappURL =
        "https://wa.me/" +
        phone +
        "?text=" +
        encodeURIComponent(message);
    /*
       OPEN WHATSAPP
    */
    window.open(
        whatsappURL,
        "_blank"
    );
};

/* =========================================================
   MODAL OUTSIDE CLICK
========================================================= */

window.addEventListener(
    "click",
    function(event) {

        const expenseModal =
            document.getElementById(
                "expense-modal"
            );


        const orderModal =
            document.getElementById(
                "order-modal"
            );


        const invoiceModal =
            document.getElementById(
                "invoice-modal"
            );


        if (
            expenseModal &&
            event.target === expenseModal
        ) {

            closeExpenseModal();

        }


        if (
            orderModal &&
            event.target === orderModal
        ) {

            closeOrderModal();

        }


        if (
            invoiceModal &&
            event.target === invoiceModal
        ) {

            closeInvoiceModal();

        }

    }
);/* =========================================================
   SEND INVOICE ON WHATSAPP
========================================================= */

window.sendInvoiceWhatsApp = function(orderId) {

    const order =
        allOrders.find(
            order => order.id === orderId
        );

    if (!order) {
        alert("Order nahi mila.");
        return;
    }

    const phone =
        String(order.phone || "")
            .replace(/\D/g, "");

    if (!phone) {
        alert("Customer phone number nahi mila.");
        return;
    }

    const whatsappNumber =
        phone.startsWith("91")
            ? phone
            : "91" + phone;

    const message =

`🐔 ROYAL CHICKEN

Invoice: ${order.orderNumber || "-"}

Customer: ${order.customerName || "-"}

Items:
${
    Array.isArray(order.items)
        ? order.items.map(item =>
            `${item.name} × ${item.quantity} = ₹${item.itemTotal}`
        ).join("\n")
        : "-"
}

Total Amount: ₹${order.total || 0}

Payment: ${order.paymentMethod || "-"}

Thank you for ordering from Royal Chicken.
Fresh & Quality Chicken`;

    const whatsappURL =
        "https://wa.me/" +
        whatsappNumber +
        "?text=" +
        encodeURIComponent(message);

    window.open(
        whatsappURL,
        "_blank"
    );

};window.sendInvoiceWhatsApp = async function(orderId) {

    const order = allOrders.find(item => item.id === orderId);

    if (!order) {
        alert("Order nahi mila.");
        return;
    }

    const invoice = document.querySelector(".rc-invoice-paper");

    if (!invoice) {
        alert("Invoice open nahi hai.");
        return;
    }

    try {

        const button = document.querySelector(".invoice-whatsapp-btn");

        if (button) {
            button.disabled = true;
            
        }

        const canvas = await html2canvas(invoice, {
            scale: 2,
            useCORS: true,
            backgroundColor: "#ffffff"
        });

        const imgData = canvas.toDataURL("image/jpeg", 0.95);

        const { jsPDF } = window.jspdf;

        const pdf = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4"
        });

        const pageWidth = 210;
        const pageHeight = 297;

        const imgWidth = pageWidth;
        const imgHeight =
            (canvas.height * imgWidth) / canvas.width;

        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(
            imgData,
            "JPEG",
            0,
            position,
            imgWidth,
            imgHeight
        );

        heightLeft -= pageHeight;

        while (heightLeft > 0) {

            position = heightLeft - imgHeight;

            pdf.addPage();

            pdf.addImage(
                imgData,
                "JPEG",
                0,
                position,
                imgWidth,
                imgHeight
            );

            heightLeft -= pageHeight;
        }

        const invoiceNumber =
            order.orderNumber || order.id;

        const fileName =
            `Royal-Chicken-${invoiceNumber}.pdf`;

        const pdfBlob =
            pdf.output("blob");

        const pdfFile =
            new File(
                [pdfBlob],
                fileName,
                {
                    type: "application/pdf"
                }
            );


        /* =================================================
           MOBILE SHARE
        ================================================= */

        if (
            navigator.share &&
            navigator.canShare &&
            navigator.canShare({
                files: [pdfFile]
            })
        ) {

            await navigator.share({

                title:
                    `Royal Chicken Invoice ${invoiceNumber}`,

                text:
                    `Dear ${order.customerName || "Customer"},\n\n` +
                    `Thank you for ordering from Royal Chicken.\n` +
                    `Please find your invoice attached.`,

                files: [pdfFile]

            });

        } else {

            /* =================================================
               DESKTOP / UNSUPPORTED BROWSER
            ================================================= */

            pdf.save(fileName);

            const phone =
                String(order.phone || "")
                    .replace(/\D/g, "");

            const message =
                `Dear ${order.customerName || "Customer"},\n\n` +
                `Thank you for ordering from Royal Chicken.\n` +
                `Your invoice has been generated as PDF.\n\n` +
                `Invoice: ${invoiceNumber}\n` +
                `Total: ₹${Number(order.total || 0).toLocaleString("en-IN")}`;

            if (phone) {

                const whatsappURL =
                    `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

                window.open(
                    whatsappURL,
                    "_blank"
                );

            } else {

                alert(
                    "Customer phone number nahi mila."
                );

            }

        }


    } catch (error) {

        console.error(
            "Invoice PDF  Error:",
            error
        );

        if (
            error.name !== "AbortError"
        ) {

            alert(
                "Invoice PDF share nahi ho paya.\n\n" +
                error.message
            );

        }

    } finally {

        const button =
            document.querySelector(
                ".invoice-whatsapp-btn"
            );

        if (button) {

            button.disabled = false;

            button.textContent =
                "Invoice PDF ";

        }

    }

};/* =========================================================
   INVOICE RECYCLE BIN
========================================================= */

window.deleteInvoiceToRecycleBin = async function(orderId) {

    if (!orderId) {
        alert("Invoice ID nahi mila.");
        return;
    }


    const confirmDelete =
        confirm(
            "Kya aap is invoice ko Recycle Bin me bhejna chahte hain?"
        );


    if (!confirmDelete) return;


    try {

        const invoiceRef =
            doc(db, "orders", orderId);


        await updateDoc(invoiceRef, {

            deleted: true,

            deletedAt: new Date().toISOString()

        });


       alert("Invoice Recycle Bin me chala gaya.");

loadInvoiceRecycleBin();

if (typeof loadOrders === "function") {
    loadOrders();
}

    } catch (error) {

        console.error(
            "Recycle Bin Error:",
            error
        );


        alert(
            "Invoice delete nahi hua.\n\n" +
            error.message
        );

    }

};


/* =========================================================
   LOAD RECYCLE BIN
========================================================= */

window.loadInvoiceRecycleBin = async function() {

    const container =
        document.getElementById(
            "invoice-recycle-list"
        );


    if (!container) return;


    container.innerHTML = `
        <div class="loading-state">
            Loading Recycle Bin...
        </div>
    `;


    try {

        const snapshot =
            await getDocs(
                collection(db, "orders")
            );


        const deletedInvoices = [];


        snapshot.forEach(item => {

    const order = {
        id: item.id,
        ...item.data()
    };

    if (order.deleted === true) {
        deletedInvoices.push(order);
    }

});


        if (!deletedInvoices.length) {

            container.innerHTML = `
                <div class="empty-state">
                    ♻️ Recycle Bin is empty.
                </div>
            `;

            return;
        }


        deletedInvoices.sort(
            (a, b) =>
                new Date(
                    b.deletedAt || 0
                ) -
                new Date(
                    a.deletedAt || 0
                )
        );


        container.innerHTML =
            deletedInvoices.map(order => `

                <div class="invoice-card">

                    <div>

                        <strong>
                            ${escapeHTML(
                                order.orderNumber ||
                                "Invoice"
                            )}
                        </strong>


                        <span>
                            ${escapeHTML(
                                order.customerName ||
                                "-"
                            )}
                        </span>


                        <small>
                            Deleted:
                            ${formatDate(
                                getDateValue(
                                    order.deletedAt
                                )
                            )}
                        </small>

                    </div>


                    <strong>
                        ${money(order.total)}
                    </strong>


                    <button
                        type="button"
                        class="secondary-btn"
                        onclick="restoreInvoice('${order.id}')"
                    >
                        ♻️ Restore
                    </button>


                    <button
                        type="button"
                        class="danger-btn"
                        onclick="permanentlyDeleteInvoice('${order.id}')"
                    >
                        ❌ Delete Permanently
                    </button>

                </div>

            `).join("");


    } catch (error) {

        console.error(
            "Recycle Bin Load Error:",
            error
        );


        container.innerHTML = `
            <div class="empty-state">
                Unable to load Recycle Bin.
            </div>
        `;

    }

};


/* =========================================================
   RESTORE INVOICE
========================================================= */

window.restoreInvoice = async function(orderId) {

    if (!orderId) return;


    const confirmRestore =
        confirm(
            "Is invoice ko wapas Invoices me restore karein?"
        );


    if (!confirmRestore) return;


    try {

        const invoiceRef =
            doc(db, "orders", orderId);


        await updateDoc(invoiceRef, {

            deleted: false,

            deletedAt: null

        });


        alert(
            "Invoice successfully restored."
        );


        loadInvoiceRecycleBin();


    } catch (error) {

        console.error(
            "Restore Error:",
            error
        );


        alert(
            "Invoice restore nahi hua.\n\n" +
            error.message
        );

    }

};


/* =========================================================
   PERMANENT DELETE
========================================================= */

window.permanentlyDeleteInvoice =
async function(orderId) {

    if (!orderId) return;


    const confirmDelete =
        confirm(
            "⚠️ WARNING!\n\n" +
            "Ye invoice permanently delete ho jayega.\n" +
            "Iske baad ise restore nahi kiya ja sakta.\n\n" +
            "Continue?"
        );


    if (!confirmDelete) return;


    try {

        const invoiceRef =
            doc(db, "orders", orderId);


        await deleteDoc(invoiceRef);


        alert(
            "Invoice permanently deleted."
        );


        loadInvoiceRecycleBin();


    } catch (error) {

        console.error(
            "Permanent Delete Error:",
            error
        );


        alert(
            "Invoice permanently delete nahi hua.\n\n" +
            error.message
        );

    }

};


/* =========================================================
   EMPTY RECYCLE BIN
========================================================= */

window.emptyInvoiceRecycleBin =
async function() {

    const confirmEmpty =
        confirm(
            "⚠️ WARNING!\n\n" +
            "Recycle Bin ke saare invoices permanently delete ho jayenge.\n" +
            "Ye action undo nahi ho sakta.\n\n" +
            "Continue?"
        );


    if (!confirmEmpty) return;


    try {

        const snapshot =
            await getDocs(
                collection(db, "orders")
            );


        const deletedInvoices =
            snapshot.docs.filter(
                item =>
                    item.data().deleted === true
            );


        if (!deletedInvoices.length) {

            alert(
                "Recycle Bin already empty hai."
            );

            return;

        }


        await Promise.all(

            deletedInvoices.map(
                item =>
                    deleteDoc(
                        doc(
                            db,
                            "orders",
                            item.id
                        )
                    )
            )

        );


        alert(
            "Recycle Bin empty kar diya gaya."
        );


        loadInvoiceRecycleBin();


    } catch (error) {

        console.error(
            "Empty Recycle Bin Error:",
            error
        );


        alert(
            "Recycle Bin empty nahi hua.\n\n" +
            error.message
        );

    }


};
/* =========================================================
   DAILY RATES
========================================================= */

const DAILY_RATE_PRODUCTS = {

    "kheema": {
        name: "Kheema",
        defaultPrice: 400
    },

    "bombay-legs": {
        name: "Bombay Legs",
        defaultPrice: 270
    },

    "wings": {
        name: "Wings",
        defaultPrice: 270
    },

    "drumsticks": {
        name: "Drumsticks",
        defaultPrice: 270
    },

    "curry-cut": {
        name: "Curry Cut",
        defaultPrice: 270
    },

    "boneless": {
        name: "Boneless",
        defaultPrice: 400
    },

    "thai-boneless": {
        name: "Thai Boneless",
        defaultPrice: 400
    },

    "lollipop": {
        name: "Lollipop",
        defaultPrice: 280
    },

    "liver": {
        name: "Liver",
        defaultPrice: 150
    },

    "gizzard": {
        name: "Gizzard",
        defaultPrice: 150
    },

    "tandoori": {
        name: "Tandoori",
        defaultPrice: 250
    },

    "broiler": {
        name: "Broiler",
        defaultPrice: 250
    }

};
/* =========================================================
   LOAD DAILY RATES
========================================================= */

window.loadDailyRates = async function () {

    try {

        for (const [id, product] of Object.entries(DAILY_RATE_PRODUCTS)) {

            const input =
                document.getElementById("rate-" + id);

            if (!input) continue;

            const rateRef =
                doc(db, "productRates", id);

            try {

                const snapshot =
                    await getDocs(
                        query(
                            collection(db, "productRates")
                        )
                    );

                const saved =
                    snapshot.docs.find(
                        item => item.id === id
                    );

                if (saved) {

                    const data = saved.data();

                    input.value =
                        Number(data.price);

                } else {

                    input.value =
                        product.defaultPrice;

                }

            } catch (error) {

                console.error(
                    "Rate read error:",
                    error
                );

                input.value =
                    product.defaultPrice;
            }
        }

    } catch (error) {

        console.error(
            "Daily Rates Load Error:",
            error
        );

    }
};


/* =========================================================
   SAVE DAILY RATES
========================================================= */

window.saveDailyRates = async function () {

    const button =
        document.querySelector(
            ".daily-rates-actions button"
        );

    const status =
        document.getElementById(
            "rates-save-status"
        );

    try {

        if (button) {

            button.disabled = true;
            button.textContent = "⏳ Saving...";

        }

        for (
            const [id, product]
            of Object.entries(DAILY_RATE_PRODUCTS)
        ) {

            const input =
                document.getElementById(
                    "rate-" + id
                );

            if (!input) continue;

            const price =
                Number(input.value);

            if (
                !Number.isFinite(price) ||
                price < 0
            ) {

                throw new Error(
                    product.name +
                    " ki price valid nahi hai."
                );

            }

            await setDoc(
                doc(
                    db,
                    "productRates",
                    id
                ),
                {
                    name: product.name,
                    price: price,
                    unit: "kg",
                    updatedAt: serverTimestamp()
                },
                {
                    merge: true
                }
            );
        }

        if (status) {

            status.textContent =
                "✅ Rates saved successfully.";

        }

        alert(
            "✅ Daily Rates successfully save ho gaye!"
        );

    } catch (error) {

        console.error(
            "DAILY RATE SAVE ERROR:",
            error
        );

        if (status) {

            status.textContent =
                "❌ Save failed.";

        }

        alert(
            "Daily Rates save nahi hue.\n\n" +
            error.message
        );

    } finally {

        if (button) {

            button.disabled = false;
            button.textContent =
                "💾 Save Daily Rates";

        }

    }
};