import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";

import {
    initiatePayment
} from "../services/reeservaService.js";

// =====================================
// CONFIGURATION SSE
// =====================================

const SSE_TIMEOUT_MS =
    5 * 60 * 1000;

// =====================================
// SSE CONNECTIONS
// =====================================

const paymentStreams =
    new Map();

// =====================================
// SSE EXPIRATION TIMERS
// =====================================

const paymentStreamTimers =
    new Map();

// =====================================
// WEBHOOKS ARRIVÉS AVANT SSE
// =====================================

const pendingWebhookEvents =
    new Map();

// =====================================
// PENDING WEBHOOK CLEANUP TIMERS
// =====================================

const pendingWebhookTimers =
    new Map();

// =====================================
// CREATE PAYMENT
// =====================================

export const createPayment = async (
    req,
    res
) => {

    try {

        const {
            phone,
            gateway
        } = req.body;

        if (
            !phone ||
            !gateway
        ) {

            return res.status(400).json({
                success: false,
                message:
                    "Numéro ou moyen de paiement manquant"
            });
        }

        let formattedPhone =
            String(phone).trim();

        formattedPhone =
            formattedPhone.replace(
                /\s/g,
                ""
            );

        if (
            !formattedPhone.startsWith(
                "+237"
            )
        ) {

            formattedPhone =
                "+237" +
                formattedPhone;
        }

        let operator =
            "";

        switch (
            String(
                gateway
            ).toLowerCase()
        ) {

            case "orange":

                operator =
                    "orange";

                break;

            case "mtn":

                operator =
                    "mtn";

                break;

            default:

                return res.status(400).json({
                    success: false,
                    message:
                        "Opérateur non supporté"
                });
        }

        // =================================
        // ORDER ID UNIQUE
        // =================================

        const orderId =
            "ORDER-" +
            uuidv4();

        const amount =
            10000;

        // =================================
        // INITIATE REESERVA
        // =================================

        const payment =
            await initiatePayment({

                phone:
                    formattedPhone,

                operator,

                amount,

                orderId
            });

        console.log(
            "========== REESERVA PAYMENT =========="
        );

        console.log(
            payment
        );

        const paymentData =
            payment?.data ||
            payment;

        // =================================
        // PAYMENT ID
        // =================================

        const paymentId =
            paymentData?.id ||
            paymentData?.paymentId ||
            paymentData?.transactionId;

        const transactionId =
            paymentData?.transactionId ||
            paymentData?.id ||
            null;

        const paymentStatus =
            String(
                paymentData?.status ||
                "PENDING"
            ).toUpperCase();

        if (!paymentId) {

            console.error(
                "Réponse Reeserva invalide : identifiant absent",
                payment
            );

            return res.status(502).json({
                success: false,
                message:
                    "Reeserva n'a pas retourné d'identifiant de paiement"
            });
        }

        // =================================
        // PAIEMENT DÉJÀ ÉCHOUÉ
        // =================================

        if (
            paymentStatus ===
                "FAILED" ||
            paymentStatus ===
                "FAILURE"
        ) {

            return res.status(400).json({

                success:
                    false,

                message:
                    paymentData.failureReason ||
                    paymentData.failedReason ||
                    "Paiement refusé",

                token:
                    paymentId,

                paymentId:
                    paymentId,

                status:
                    paymentStatus,

                orderId
            });
        }

        console.log(
            "Payment ID :",
            paymentId
        );

        console.log(
            "Transaction ID :",
            transactionId
        );

        console.log(
            "Order ID :",
            orderId
        );

        // =================================
        // RÉPONSE AU CLIENT
        // =================================

        return res.json({

            success:
                true,

            message:
                "Demande de paiement envoyée. Validez le paiement sur votre téléphone.",

            token:
                paymentId,

            paymentId:
                paymentId,

            transactionId:
                transactionId,

            orderId:
                orderId,

            status:
                paymentStatus,

            nextAction:
                "WAITING_FOR_WEBHOOK",

            otpRequired:
                false,

            amount:
                amount,

            operator:
                operator
        });

    } catch (error) {

        console.error(
            "CREATE PAYMENT ERROR:",
            error.response?.data ||
            error.message ||
            error
        );

        const reeservaError =
            error.response?.data ||
            error;

        const errorMessage =
            reeservaError?.error?.message ||
            reeservaError?.message ||
            error.message ||
            "Erreur serveur";

        const statusCode =
            error.response?.status ||
            500;

        return res.status(
            statusCode
        ).json({

            success:
                false,

            message:
                errorMessage,

            error:
                reeservaError?.error ||
                undefined
        });
    }
};

// =====================================
// SSE PAYMENT EVENTS
// =====================================

export const paymentEvents = async (
    req,
    res
) => {

    const orderId =
        req.params.orderId;

    if (!orderId) {

        return res.status(
            400
        ).end();
    }

    console.log(
        "SSE CONNECTÉ :",
        orderId
    );

    // =================================
    // SSE HEADERS
    // =================================

    res.writeHead(
        200,
        {

            "Content-Type":
                "text/event-stream",

            "Cache-Control":
                "no-cache, no-transform",

            "Connection":
                "keep-alive",

            "X-Accel-Buffering":
                "no"
        }
    );

    // =================================
    // ENREGISTRER CLIENT
    // =================================

    paymentStreams.set(
        orderId,
        res
    );

    // =================================
    // CONNEXION
    // =================================

    res.write(

        `event: connected\n` +

        `data: ${JSON.stringify({
            connected:
                true,
            orderId
        })}\n\n`
    );

    // =================================
    // EXPIRATION SERVEUR : 5 MINUTES
    // =================================

    const expirationTimer =
        setTimeout(
            () => {

                const current =
                    paymentStreams.get(
                        orderId
                    );

                if (
                    current !==
                    res
                ) {

                    return;
                }

                console.log(
                    "⏱️ SSE EXPIRÉ APRÈS 5 MINUTES :",
                    orderId
                );

                try {

                    if (
                        !res.writableEnded
                    ) {

                        res.write(
                            `event: payment\n` +
                            `data: ${JSON.stringify({
                                event:
                                    "payment.expired",
                                orderId:
                                    orderId
                            })}\n\n`
                        );

                        res.end();
                    }

                } catch (
                    error
                ) {

                    console.error(
                        "Erreur fermeture SSE expirée :",
                        error.message
                    );
                }

                paymentStreams.delete(
                    orderId
                );

                paymentStreamTimers.delete(
                    orderId
                );

            },
            SSE_TIMEOUT_MS
        );

    paymentStreamTimers.set(
        orderId,
        expirationTimer
    );

    // =================================
    // WEBHOOK DÉJÀ REÇU ?
    // =================================

    if (
        pendingWebhookEvents.has(
            orderId
        )
    ) {

        const savedEvent =
            pendingWebhookEvents.get(
                orderId
            );

        console.log(
            "📦 Webhook en attente envoyé au client :",
            orderId
        );

        res.write(

            `event: payment\n` +

            `data: ${JSON.stringify(
                savedEvent
            )}\n\n`
        );

        pendingWebhookEvents.delete(
            orderId
        );

        const pendingTimer =
            pendingWebhookTimers.get(
                orderId
            );

        if (
            pendingTimer
        ) {

            clearTimeout(
                pendingTimer
            );

            pendingWebhookTimers.delete(
                orderId
            );
        }

        // =================================
        // ÉVÉNEMENT FINAL
        // =================================

        if (

            savedEvent.event ===
                "payment.collected" ||

            savedEvent.event ===
                "payment.succeeded" ||

            savedEvent.event ===
                "payment.failed"

        ) {

            clearTimeout(
                expirationTimer
            );

            paymentStreamTimers.delete(
                orderId
            );

            res.end();

            paymentStreams.delete(
                orderId
            );

            return;
        }
    }

    // =================================
    // KEEP ALIVE
    // =================================

    const keepAlive =
        setInterval(
            () => {

                if (
                    !res.writableEnded
                ) {

                    res.write(
                        ": keep-alive\n\n"
                    );
                }

            },
            20000
        );

    // =================================
    // CLIENT DÉCONNECTÉ
    // =================================

    req.on(
        "close",
        () => {

            clearInterval(
                keepAlive
            );

            clearTimeout(
                expirationTimer
            );

            paymentStreamTimers.delete(
                orderId
            );

            const current =
                paymentStreams.get(
                    orderId
                );

            if (
                current ===
                res
            ) {

                paymentStreams.delete(
                    orderId
                );
            }

            console.log(
                "SSE DÉCONNECTÉ :",
                orderId
            );
        }
    );
};

// =====================================
// REESERVA WEBHOOK
// =====================================

export const webhook = async (
    req,
    res
) => {

    try {

        console.log(
            "========== REESERVA WEBHOOK =========="
        );

        // =================================
        // ORDER ID
        // =================================

        const orderId =
            req.params.orderId ||
            null;

        console.log(
            "Order ID webhook :",
            orderId
        );

        // =================================
        // SECRET
        // =================================

        const webhookSecret =
            process.env.REESERVA_WEBHOOK_SECRET;

        if (!webhookSecret) {

            console.error(
                "REESERVA_WEBHOOK_SECRET n'est pas configurée."
            );

            return res.status(
                500
            ).json({

                success:
                    false,

                message:
                    "Webhook secret non configuré"
            });
        }

        // =================================
        // SIGNATURE
        // =================================

        const signatureHeader =
            req.get(
                "X-Reeserva-Signature"
            );

        if (!signatureHeader) {

            console.error(
                "Signature Reeserva absente."
            );

            return res.status(
                401
            ).json({

                success:
                    false,

                message:
                    "Signature webhook absente"
            });
        }

        const signatureParts =
            signatureHeader.split(
                ","
            );

        let timestamp =
            null;

        let receivedSignature =
            null;

        for (
            const part
            of signatureParts
        ) {

            const separatorIndex =
                part.indexOf("=");

            if (
                separatorIndex ===
                -1
            ) {

                continue;
            }

            const key =
                part
                    .slice(
                        0,
                        separatorIndex
                    )
                    .trim();

            const value =
                part
                    .slice(
                        separatorIndex + 1
                    )
                    .trim();

            if (
                key ===
                "t"
            ) {

                timestamp =
                    value;
            }

            if (
                key ===
                "v1"
            ) {

                receivedSignature =
                    value;
            }
        }

        if (
            !timestamp ||
            !receivedSignature
        ) {

            return res.status(
                401
            ).json({

                success:
                    false,

                message:
                    "Signature webhook invalide"
            });
        }

        // =================================
        // TIMESTAMP
        // =================================

        const timestampNumber =
            Number(
                timestamp
            );

        if (
            !Number.isInteger(
                timestampNumber
            )
        ) {

            return res.status(
                401
            ).json({

                success:
                    false,

                message:
                    "Timestamp webhook invalide"
            });
        }

        const now =
            Math.floor(
                Date.now() / 1000
            );

        const age =
            Math.abs(
                now -
                timestampNumber
            );

        if (
            age > 300
        ) {

            console.error(
                "Webhook Reeserva trop ancien."
            );

            return res.status(
                401
            ).json({

                success:
                    false,

                message:
                    "Webhook expiré"
            });
        }

        // =================================
        // RAW BODY
        // =================================

        if (
            !req.rawBody
        ) {

            console.error(
                "RAW BODY absent."
            );

            return res.status(
                400
            ).json({

                success:
                    false,

                message:
                    "Raw body webhook indisponible"
            });
        }

        // =================================
        // VERIFY HMAC
        // =================================

        const signedPayload =
            `${timestamp}.${req.rawBody.toString("utf8")}`;

        const expectedSignature =
            crypto
                .createHmac(
                    "sha256",
                    webhookSecret
                )
                .update(
                    signedPayload,
                    "utf8"
                )
                .digest("hex");

        const expectedBuffer =
            Buffer.from(
                expectedSignature,
                "utf8"
            );

        const receivedBuffer =
            Buffer.from(
                receivedSignature,
                "utf8"
            );

        if (
            expectedBuffer.length !==
            receivedBuffer.length
        ) {

            return res.status(
                401
            ).json({

                success:
                    false,

                message:
                    "Signature webhook invalide"
            });
        }

        const signatureValid =
            crypto.timingSafeEqual(
                expectedBuffer,
                receivedBuffer
            );

        if (
            !signatureValid
        ) {

            console.error(
                "Signature Reeserva incorrecte."
            );

            return res.status(
                401
            ).json({

                success:
                    false,

                message:
                    "Signature webhook invalide"
            });
        }

        // =================================
        // WEBHOOK AUTHENTIFIÉ
        // =================================

        const event =
            req.body;

        const eventName =
            event?.event ||
            req.get(
                "X-Reeserva-Event"
            ) ||
            "unknown";

        const mode =
            req.get(
                "X-Reeserva-Mode"
            ) ||
            "LIVE";

        const eventData =
            event?.data ||
            {};

        const transactionId =
            eventData?.transactionId ||
            null;

        console.log(
            "✅ WEBHOOK AUTHENTIFIÉ"
        );

        console.log(
            "Mode :",
            mode
        );

        console.log(
            "Event :",
            eventName
        );

        console.log(
            "Transaction ID :",
            transactionId
        );

        console.log(
            "Data :",
            eventData
        );

        // =================================
        // ÉVÉNEMENT À ENVOYER AU CLIENT
        // =================================

        const clientEvent = {

            event:
                eventName,

            data:
                eventData,

            mode:
                mode,

            transactionId:
                transactionId,

            orderId:
                orderId
        };

        // =================================
        // TROUVER LE CLIENT
        // =================================

        const client =
            orderId
                ? paymentStreams.get(
                    orderId
                )
                : null;

        if (client) {

            console.log(
                "📡 Envoi webhook au navigateur :",
                orderId
            );

            client.write(

                `event: payment\n` +

                `data: ${JSON.stringify(
                    clientEvent
                )}\n\n`
            );

            // =================================
            // ÉVÉNEMENT FINAL
            // =================================

            if (

                eventName ===
                    "payment.collected" ||

                eventName ===
                    "payment.succeeded" ||

                eventName ===
                    "payment.failed"

            ) {

                const expirationTimer =
                    paymentStreamTimers.get(
                        orderId
                    );

                if (
                    expirationTimer
                ) {

                    clearTimeout(
                        expirationTimer
                    );

                    paymentStreamTimers.delete(
                        orderId
                    );
                }

                client.end();

                paymentStreams.delete(
                    orderId
                );

                console.log(
                    "📡 SSE terminé :",
                    orderId
                );
            }

        } else if (
            orderId
        ) {

            // =================================
            // CLIENT PAS ENCORE CONNECTÉ
            // =================================

            console.log(
                "📦 Client SSE pas encore connecté. Événement sauvegardé :",
                orderId
            );

            pendingWebhookEvents.set(
                orderId,
                clientEvent
            );

            // =================================
            // NETTOYAGE APRÈS 5 MINUTES
            // =================================

            const oldTimer =
                pendingWebhookTimers.get(
                    orderId
                );

            if (
                oldTimer
            ) {

                clearTimeout(
                    oldTimer
                );
            }

            const cleanupTimer =
                setTimeout(
                    () => {

                        pendingWebhookEvents.delete(
                            orderId
                        );

                        pendingWebhookTimers.delete(
                            orderId
                        );

                        console.log(
                            "🧹 Webhook en attente supprimé après 5 minutes :",
                            orderId
                        );

                    },
                    SSE_TIMEOUT_MS
                );

            pendingWebhookTimers.set(
                orderId,
                cleanupTimer
            );
        }

        // =================================
        // LOG ÉVÉNEMENT
        // =================================

        switch (
            eventName
        ) {

            case "payment.collected":

                console.log(
                    "✅ PAIEMENT REESERVA COLLECTÉ"
                );

                break;

            case "payment.succeeded":

                console.log(
                    "✅ PAIEMENT REESERVA RÉUSSI"
                );

                break;

            case "payment.failed":

                console.log(
                    "❌ PAIEMENT REESERVA ÉCHOUÉ"
                );

                console.log(
                    "Raison :",
                    eventData?.reason
                );

                break;

            case "webhook.test":

                console.log(
                    "✅ TEST WEBHOOK REESERVA REÇU"
                );

                break;

            default:

                console.log(
                    "Événement Reeserva reçu :",
                    eventName
                );

                break;
        }

        // =================================
        // RÉPONSE REESERVA
        // =================================

        return res.status(
            200
        ).json({

            received:
                true
        });

    } catch (error) {

        console.error(
            "WEBHOOK ERROR:",
            error.message ||
            error
        );

        return res.status(
            500
        ).json({

            success:
                false
        });
    }
};