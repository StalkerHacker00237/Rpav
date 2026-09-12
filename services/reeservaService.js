import axios from "axios";

// ========================================
// REESERVA API
// ========================================

const api = axios.create({

    baseURL:
        "https://riserva.nalovan.cloud/api/v1",

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

        "Content-Type":
            "application/json",

        "X-Api-Key":
            process.env.REESERVA_API_KEY

    };

    if (idempotencyKey) {

        requestHeaders[
            "Idempotency-Key"
        ] = idempotencyKey;
    }

    return requestHeaders;
};

// ========================================
// NORMALIZE OPERATOR
// ========================================

const normalizeOperator = (operator) => {

    const normalized =
        String(operator || "")
            .trim()
            .toLowerCase();

    if (
        normalized !== "mtn" &&
        normalized !== "orange"
    ) {

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

    let normalized =
        String(phone || "").trim();

    normalized =
        normalized.replace(
            /[\s\-().]/g,
            ""
        );

    normalized =
        normalized.replace(
            /^\+/,
            ""
        );

    if (
        /^6\d{8}$/.test(
            normalized
        )
    ) {

        normalized =
            `237${normalized}`;
    }

    if (
        !/^237\d{9}$/.test(
            normalized
        )
    ) {

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

    const numericAmount =
        Number(amount);

    if (
        !Number.isFinite(
            numericAmount
        )
    ) {

        throw new Error(
            "Le montant du paiement est invalide."
        );
    }

    if (
        !Number.isInteger(
            numericAmount
        )
    ) {

        throw new Error(
            "Le montant doit être un nombre entier en XAF."
        );
    }

    if (
        numericAmount < 100 ||
        numericAmount > 500000
    ) {

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

        if (
            !process.env.REESERVA_API_KEY
        ) {

            throw new Error(
                "REESERVA_API_KEY n'est pas configurée dans les variables d'environnement."
            );
        }

        if (!orderId) {

            throw new Error(
                "orderId est obligatoire pour initier le paiement."
            );
        }

        const normalizedOperator =
            normalizeOperator(
                operator
            );

        const normalizedPhone =
            normalizePhone(
                phone
            );

        const normalizedAmount =
            normalizeAmount(
                amount
            );

        // =================================
        // IDEMPOTENCY
        // =================================

        const idempotencyKey =
            `rpay-${String(orderId)}`;

        // =================================
        // PAYLOAD
        // =================================

        const payload = {

            amount:
                normalizedAmount,

            currency:
                "XAF",

            country:
                "CM",

            operator:
                normalizedOperator,

            phone_number:
                normalizedPhone

        };

        // =================================
        // WEBHOOK UNIQUE À CE PAIEMENT
        // =================================
        //
        // Exemple :
        //
        // https://rpay.up.railway.app/api/webhook/ORDER-xxxxx
        //
        // Cela permet de savoir exactement
        // à quel paiement appartient le webhook.
        //
        // =================================

        if (
            process.env.BASE_URL
        ) {

            payload.notify_url =
                `${process.env.BASE_URL}/api/webhook/${encodeURIComponent(orderId)}`;
        }

        console.log(
            "Reeserva notify_url :",
            payload.notify_url
        );

        // =================================
        // APPEL REESERVA
        // =================================

        const response =
            await api.post(

                "/payments/collect",

                payload,

                {
                    headers:
                        headers(
                            idempotencyKey
                        )
                }

            );

        return response.data;

    } catch (error) {

        console.error(

            "REESERVA INITIATE ERROR:",

            error.response?.data ||
            error.message

        );

        throw (
            error.response?.data ||
            error
        );
    }
};