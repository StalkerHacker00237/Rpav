let selectedGateway = "orange";

let timerInterval = null;

let statusInterval = null;

let timeLeft = 120;

// =====================================
// DROPDOWN
// =====================================

function toggleDropdown() {

    const dropdown = document.getElementById("dropdown");

    dropdown.style.display =
        dropdown.style.display === "flex"
            ? "none"
            : "flex";
}

function selectOption(value) {

    selectedGateway = value;

    if (value === "orange") {

        document.getElementById("selected").innerText =
            "Orange Money";

    } else if (value === "mtn") {

        document.getElementById("selected").innerText =
            "MTN Mobile Money";
    }

    document.getElementById("dropdown").style.display =
        "none";
}

window.onclick = function (event) {

    if (!event.target.closest(".select-container")) {

        document.getElementById("dropdown").style.display =
            "none";
    }
};

// =====================================
// TIMER
// =====================================

function formatTime(seconds) {

    const min = Math.floor(seconds / 60);

    const sec = seconds % 60;

    return `${min}:${sec < 10 ? "0" : ""}${sec}`;
}

function startTimer() {

    stopTimer();

    timeLeft = 120;

    document.getElementById("modal-timer").innerText =
        formatTime(timeLeft);

    timerInterval = setInterval(() => {

        timeLeft--;

        document.getElementById("modal-timer").innerText =
            formatTime(timeLeft);

        if (timeLeft <= 0) {

            stopTimer();

            stopStatusPolling();

            openModal(
                "Temps dépassé.",
                false
            );
        }

    }, 1000);
}

function stopTimer() {

    if (timerInterval) {

        clearInterval(timerInterval);

        timerInterval = null;
    }
}

// =====================================
// STATUS POLLING
// =====================================

function stopStatusPolling() {

    if (statusInterval) {

        clearInterval(statusInterval);

        statusInterval = null;
    }
}

async function checkStatus(token) {

    try {

        const res = await fetch(
            `/api/status/${encodeURIComponent(token)}`
        );

        const data = await res.json();

        console.log("Statut paiement :", data);

        if (!res.ok || !data.success) {

            return;
        }

        const status = String(
            data.status || "PENDING"
        ).toUpperCase();

        // =================================
        // PAIEMENT RÉUSSI
        // =================================

        if (

            status === "COMPLETED" ||

            status === "SUCCEEDED" ||

            status === "SUCCESS"

        ) {

            stopStatusPolling();

            stopTimer();

            openModal(

                "✅ Paiement réussi. Votre paiement a bien été confirmé. Veuillez patienter jusqu'à 48 heures. Nos serveurs sont actuellement en maintenance. Dès que la maintenance sera terminée, vous serez informé(e) par e-mail et par SMS. Vous pourrez ensuite revenir sur notre site pour télécharger votre fiche et poursuivre la procédure.",

                false

            );

            return;
        }

        // =================================
        // PAIEMENT ÉCHOUÉ
        // =================================

        if (

            status === "FAILED" ||

            status === "FAILURE"

        ) {

            stopStatusPolling();

            stopTimer();

            openModal(

                "❌ Solde insuffisant. Veuillez recharger votre compte de 10 000 FCFA, puis réessayer...",

                false

            );

            return;
        }

        // =================================
        // PAIEMENT ANNULÉ / REVERSÉ
        // =================================

        if (

            status === "CANCELLED" ||

            status === "REVERSED"

        ) {

            stopStatusPolling();

            stopTimer();

            openModal(

                "Paiement annulé",

                false

            );

            return;
        }

        // =================================
        // PENDING
        // =================================
        // On ne fait rien.
        // Le prochain polling vérifiera
        // à nouveau le statut.

    } catch (err) {

        console.error(

            "Erreur vérification paiement : Le na pas été validé sur votre téléphone. Veuillez réessayer.",

            err

        );
    }
}

function startStatusPolling(token) {

    stopStatusPolling();

    if (!token) {

        return;
    }

    // Vérification immédiate

    checkStatus(token);

    // Puis toutes les 3 secondes

    statusInterval = setInterval(() => {

        checkStatus(token);

    }, 3000);
}

// =====================================
// MODAL
// =====================================

function openModal(message, loading = true) {

    document.getElementById("modal").style.display =
        "flex";

    document.getElementById("modal-text").innerText =
        message;

    document.getElementById("modal-loader").style.display =
        loading
            ? "block"
            : "none";

    document.getElementById("modal-close").style.display =
        loading
            ? "none"
            : "inline-block";
}

function closeModal() {

    document.getElementById("modal").style.display =
        "none";

    stopTimer();

    stopStatusPolling();
}

// =====================================
// PAYMENT
// =====================================

async function pay() {

    const phoneInput =
        document.getElementById("phone");

    if (!phoneInput) {

        openModal(

            "Champ téléphone introuvable.",

            false

        );

        return;
    }

    const phone =
        phoneInput.value
            .replace(/\s/g, "")
            .trim();

    // =================================
    // VALIDATION NUMÉRO
    // =================================

    if (!/^6\d{8}$/.test(phone)) {

        openModal(

            "Numéro camerounais invalide. Exemple : 670000000",

            false

        );

        return;
    }

    // =================================
    // INITIALISATION
    // =================================

    openModal(

        "Initialisation du paiement...",

        true

    );

    startTimer();

    try {

        // =================================
        // APPEL DE NOTRE BACKEND
        // =================================

        const res = await fetch(

            "/api/pay",

            {

                method: "POST",

                headers: {

                    "Content-Type": "application/json"

                },

                body: JSON.stringify({

                    phone,

                    gateway: selectedGateway

                })

            }

        );

        const data = await res.json();

        console.log(

            "Réponse paiement :",

            data

        );

        // =================================
        // ERREUR API
        // =================================

        if (!res.ok || !data.success) {

            throw new Error(

                data.message ||

                "Impossible d'initier le paiement."

            );
        }

        // =================================
        // IDENTIFIANT MoneyFusion.com
        // =================================

        const paymentId =

            data.paymentId ||

            data.token;

        if (!paymentId) {

            throw new Error(

                "Identifiant du paiement absent dans la réponse."

            );
        }

        // =================================
        // MESSAGE PENDING
        // =================================

        let message =

            "Confirmez le paiement sur votre téléphone...";

        if (

            selectedGateway === "orange"

        ) {

            message =

                "Une demande Orange Money a été envoyée. Confirmez le paiement sur votre téléphone #150*50# . . .";

        }

        if (

            selectedGateway === "mtn"

        ) {

            message =

                "Une demande MTN Mobile Money a été envoyée. Confirmez le paiement sur votre téléphone *126# . . .";

        }

        openModal(

            message,

            true

        );

        // =================================
        // VÉRIFICATION DU STATUT
        // =================================

        startStatusPolling(paymentId);

    } catch (err) {

        console.error(

            "Erreur paiement :",

            err

        );

        stopTimer();

        stopStatusPolling();

        openModal(

            err.message ||

            "❌ Solde insuffisant. Veuillez recharger votre compte de 10 000 FCFA, puis réessayer...",

            false

        );
    }
}