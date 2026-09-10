import axios from "axios";

// ========================================
// REESERVA API
// ========================================

const api = axios.create({
    baseURL: "https://riserva.nalovan.cloud/api/v1",
    timeout: 120000,
    headers: {
        "Content-Type": "application/json"
    }
});

// ========================================
// AUTHENTICATION
// ========================================

const headers = (idempotencyKey = null) => {
    const requestHeaders = {
        "Content-Type": "application/json",
        "X-Api-Key": process.env.REESERVA_API_KEY
    };

    if (idempotencyKey) {
        requestHeaders["Idempotency-Key"] = idempotencyKey;
    }

    return requestHeaders;
};

// ========================================
// NORMALIZE OPERATOR
// ========================================

const normalizeOperator = (operator) => {
    const normalized = String(operator || "").trim().toLowerCase();

    if (normalized !== "mtn" && normalized !== "orange") {
        throw new Error(
            "Opérateur invalide. Utilisez uniquement MTN ou Orange."
        );
    }

    return normalized;
};

// ========================================
// NORMALIZE PHONE
// ========================================

const normalizePhone = (phone) => {
    let normalized = String(phone || "").trim();

    // Supprime les espaces, tirets et parenthèses
    normalized = normalized.replace(/[\s\-().]/g, "");

    // Reeserva accepte le + mais recommande les chiffres E.164
    normalized = normalized.replace(/^\+/, "");

    // Si le numéro camerounais est fourni sans 237
    if (/^6\d{8}$/.test(normalized)) {
        normalized = `237${normalized}`;
    }

    if (!/^237\d{9}$/.test(normalized)) {
        throw new Error(
            "Numéro de téléphone camerounais invalide."
        );
    }

    return normalized;
};

// ========================================
// NORMALIZE AMOUNT
// ========================================

const normalizeAmount = (amount) => {
    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount)) {
        throw new Error("Le montant du paiement est invalide.");
    }

    if (!Number.isInteger(numericAmount)) {
        throw new Error("Le montant doit être un nombre entier en XAF.");
    }

    if (numericAmount < 100 || numericAmount > 500000) {
        throw new Error(
            "Le montant doit être compris entre 100 et 500000 XAF."
        );
    }

    return numericAmount;
};

// ========================================
// INITIATE PAYMENT
// ========================================

export const initiatePayment = async ({
    phone,
    operator,
    amount,
    orderId
}) => {
    try {
        if (!process.env.REESERVA_API_KEY) {
            throw new Error(
                "REESERVA_API_KEY n'est pas configurée dans les variables d'environnement."
            );
        }

        if (!orderId) {
            throw new Error("orderId est obligatoire pour initier le paiement.");
        }

        const normalizedOperator = normalizeOperator(operator);
        const normalizedPhone = normalizePhone(phone);
        const normalizedAmount = normalizeAmount(amount);

        /*
         * Une même clé d'idempotence doit être réutilisée
         * lors d'un retry du même paiement.
         *
         * Reeserva conserve les clés pendant 24 heures.
         */
        const idempotencyKey = `rpay-${String(orderId)}`;

        const payload = {
            amount: normalizedAmount,
            currency: "XAF",
            country: "CM",
            operator: normalizedOperator,
            phone_number: normalizedPhone
        };

        /*
         * notify_url est ajouté uniquement si BASE_URL existe.
         * Le webhook global peut également être configuré
         * directement dans Reeserva.
         */
        if (process.env.BASE_URL) {
            payload.notify_url = `${process.env.BASE_URL}/api/webhook`;
        }

        const response = await api.post(
            "/payments/collect",
            payload,
            {
                headers: headers(idempotencyKey)
            }
        );

        return response.data;

    } catch (error) {
        console.error(
            "REESERVA INITIATE ERROR:",
            error.response?.data || error.message
        );

        throw error.response?.data || error;
    }
};

// ========================================
// VERIFY PAYMENT
// ========================================

export const verifyPayment = async (paymentId) => {
    try {
        if (!process.env.REESERVA_API_KEY) {
            throw new Error(
                "REESERVA_API_KEY n'est pas configurée dans les variables d'environnement."
            );
        }

        if (!paymentId) {
            throw new Error(
                "L'identifiant Reeserva du paiement est obligatoire."
            );
        }

        const response = await api.get(
            `/payments/${encodeURIComponent(paymentId)}`,
            {
                headers: headers()
            }
        );

        return response.data;

    } catch (error) {
        console.error(
            "REESERVA VERIFY ERROR:",
            error.response?.data || error.message
        );

        throw error.response?.data || error;
    }
};