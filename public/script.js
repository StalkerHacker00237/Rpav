let selectedGateway =
    "orange";

let timerInterval =
    null;

let eventSource =
    null;

let timeLeft =
    300;

// =====================================
// DROPDOWN
// =====================================

function toggleDropdown() {

    const dropdown =
        document.getElementById(
            "dropdown"
        );

    dropdown.style.display =
        dropdown.style.display ===
        "flex"
            ? "none"
            : "flex";
}

function selectOption(
    value
) {

    selectedGateway =
        value;

    if (
        value ===
        "orange"
    ) {

        document.getElementById(
            "selected"
        ).innerText =
            "Orange Money";

    } else if (
        value ===
        "mtn"
    ) {

        document.getElementById(
            "selected"
        ).innerText =
            "MTN Mobile Money";
    }

    document.getElementById(
        "dropdown"
    ).style.display =
        "none";
}

window.onclick =
    function (event) {

        if (
            !event.target.closest(
                ".select-container"
            )
        ) {

            document.getElementById(
                "dropdown"
            ).style.display =
                "none";
        }
    };

// =====================================
// TIMER
// =====================================

function formatTime(
    seconds
) {

    const min =
        Math.floor(
            seconds / 60
        );

    const sec =
        seconds % 60;

    return `${min}:${sec < 10 ? "0" : ""}${sec}`;
}

function startTimer() {

    stopTimer();

    timeLeft =
        300;

    document.getElementById(
        "modal-timer"
    ).innerText =
        formatTime(
            timeLeft
        );

    timerInterval =
        setInterval(
            () => {

                timeLeft--;

                document.getElementById(
                    "modal-timer"
                ).innerText =
                    formatTime(
                        timeLeft
                    );

                if (
                    timeLeft <=
                    0
                ) {

                    stopTimer();

                    closePaymentEvents();

                    openModal(
                        "Temps dépassé. Le délai de confirmation du paiement est expiré. Veuillez réessayer.",
                        false
                    );
                }

            },
            1000
        );
}

function stopTimer() {

    if (
        timerInterval
    ) {

        clearInterval(
            timerInterval
        );

        timerInterval =
            null;
    }
}

// =====================================
// SSE
// =====================================

function closePaymentEvents() {

    if (
        eventSource
    ) {

        console.log(
            "Fermeture connexion SSE"
        );

        eventSource.close();

        eventSource =
            null;
    }
}

function startPaymentEvents(
    orderId
) {

    closePaymentEvents();

    if (
        !orderId
    ) {

        console.error(
            "Order ID absent pour SSE."
        );

        return;
    }

    console.log(
        "Connexion SSE :",
        orderId
    );

    eventSource =
        new EventSource(
            `/api/events/${encodeURIComponent(
                orderId
            )}`
        );

    // =================================
    // CONNECTED
    // =================================

    eventSource.addEventListener(
        "connected",
        function (event) {

            console.log(
                "SSE connecté :",
                event.data
            );
        }
    );

    // =================================
    // PAYMENT EVENT
    // =================================

    eventSource.addEventListener(
        "payment",
        function (event) {

            try {

                const payload =
                    JSON.parse(
                        event.data
                    );

                console.log(
                    "📡 WEBHOOK REÇU :",
                    payload
                );

                const eventName =
                    payload.event;

                // =================================
                // PAIEMENT RÉUSSI
                // =================================

                if (
                    eventName ===
                        "payment.collected" ||
                    eventName ===
                        "payment.succeeded"
                ) {

                    closePaymentEvents();

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
                    eventName ===
                    "payment.failed"
                ) {

                    closePaymentEvents();

                    stopTimer();

                    openModal(
                        "❌ Solde insuffisant. Veuillez recharger votre compte de 10 000 FCFA, puis réessayer...",
                        false
                    );

                    return;
                }

                // =================================
                // SSE EXPIRÉ
                // =================================

                if (
                    eventName ===
                    "payment.expired"
                ) {

                    closePaymentEvents();

                    stopTimer();

                    openModal(
                        "Temps dépassé. Le délai de confirmation du paiement est expiré. Veuillez réessayer.",
                        false
                    );

                    return;
                }

            } catch (
                error
            ) {

                console.error(
                    "Erreur traitement webhook SSE :",
                    error
                );
            }
        }
    );

    // =================================
    // ERREUR SSE
    // =================================

    eventSource.onerror =
        function (error) {

            console.error(
                "Erreur connexion SSE :",
                error
            );
        };
}

// =====================================
// MODAL
// =====================================

function openModal(
    message,
    loading = true
) {

    document.getElementById(
        "modal"
    ).style.display =
        "flex";

    document.getElementById(
        "modal-text"
    ).innerText =
        message;

    document.getElementById(
        "modal-loader"
    ).style.display =
        loading
            ? "block"
            : "none";

    document.getElementById(
        "modal-close"
    ).style.display =
        loading
            ? "none"
            : "inline-block";
}

function closeModal() {

    document.getElementById(
        "modal"
    ).style.display =
        "none";

    stopTimer();

    closePaymentEvents();
}

// =====================================
// CANCEL PAYMENT
// =====================================

function cancelPayment() {

    stopTimer();

    closePaymentEvents();

    closeModal();
}

// =====================================
// PAYMENT
// =====================================

async function pay() {

    const phoneInput =
        document.getElementById(
            "phone"
        );

    if (
        !phoneInput
    ) {

        openModal(
            "Champ téléphone introuvable.",
            false
        );

        return;
    }

    const phone =
        phoneInput.value
            .replace(
                /\s/g,
                ""
            )
            .trim();

    // =================================
    // VALIDATION
    // =================================

    if (
        !/^6\d{8}$/.test(
            phone
        )
    ) {

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
        // BACKEND
        // =================================

        const res =
            await fetch(
                "/api/pay",
                {
                    method:
                        "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            phone,
                            gateway:
                                selectedGateway
                        })
                }
            );

        const data =
            await res.json();

        console.log(
            "Réponse paiement :",
            data
        );

        // =================================
        // ERREUR
        // =================================

        if (
            !res.ok ||
            !data.success
        ) {

            throw new Error(
                data.message ||
                "Impossible d'initier le paiement."
            );
        }

        // =================================
        // IDENTIFIANTS
        // =================================

        const paymentId =
            data.paymentId ||
            data.token;

        const orderId =
            data.orderId;

        if (
            !paymentId
        ) {

            throw new Error(
                "Identifiant du paiement absent dans la réponse."
            );
        }

        if (
            !orderId
        ) {

            throw new Error(
                "Identifiant de commande absent dans la réponse."
            );
        }

        // =================================
        // MESSAGE PENDING
        // =================================

        let message =
            "Confirmez le paiement sur votre téléphone...";

        if (
            selectedGateway ===
            "orange"
        ) {

            message =
                "Une demande Orange Money a été envoyée. Confirmez le paiement sur votre téléphone #150*50# . . .";
        }

        if (
            selectedGateway ===
            "mtn"
        ) {

            message =
                "Une demande MTN Mobile Money a été envoyée. Confirmez le paiement sur votre téléphone *126# . . .";
        }

        openModal(
            message,
            true
        );

        // =================================
        // ATTENTE DU WEBHOOK
        // =================================
        //
        // AUCUN POLLING.
        //
        // Reeserva -> /api/webhook/ORDER-ID
        //
        // Backend -> SSE -> navigateur
        //
        // Maximum : 5 minutes.
        //
        // =================================

        startPaymentEvents(
            orderId
        );

    } catch (
        err
    ) {

        console.error(
            "Erreur paiement :",
            err
        );

        stopTimer();

        closePaymentEvents();

        openModal(
            err.message ||
            "Une erreur est survenue lors du paiement.",
            false
        );
    }
}