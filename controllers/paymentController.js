import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";

import {
    initiatePayment,
    verifyPayment
} from "../services/reeservaService.js";

// =====================================
// CREATE PAYMENT
// =====================================

export const createPayment = async (req, res) => {
    try {
        const { phone, gateway } = req.body;

        if (!phone || !gateway) {
            return res.status(400).json({
                success: false,
                message: "Numéro ou moyen de paiement manquant"
            });
        }

        let formattedPhone = String(phone).trim();

        formattedPhone = formattedPhone.replace(/\s/g, "");

        if (!formattedPhone.startsWith("+237")) {
            formattedPhone = "+237" + formattedPhone;
        }

        let operator = "";

        switch (String(gateway).toLowerCase()) {
            case "orange":
                operator = "orange";
                break;

            case "mtn":
                operator = "mtn";
                break;

            default:
                return res.status(400).json({
                    success: false,
                    message: "Opérateur non supporté"
                });
        }

        const orderId = "ORDER-" + uuidv4();

        const amount = 10000;

        const payment = await initiatePayment({
            phone: formattedPhone,
            operator,
            amount,
            orderId
        });

        console.log(
            "========== REESERVA PAYMENT =========="
        );

        console.log(payment);

        const paymentData =
            payment?.data || payment;

        const paymentId =
            paymentData?.id;

        const paymentStatus =
            String(
                paymentData?.status || "PENDING"
            ).toUpperCase();

        if (!paymentId) {
            console.error(
                "Réponse Reeserva invalide : identifiant de paiement absent",
                payment
            );

            return res.status(502).json({
                success: false,
                message:
                    "Reeserva n'a pas retourné d'identifiant de paiement"
            });
        }

        // =================================
        // PAYMENT FAILED IMMEDIATELY
        // =================================

        if (
            paymentStatus === "FAILED" ||
            paymentStatus === "FAILURE"
        ) {
            return res.status(400).json({
                success: false,
                message:
                    paymentData.failureReason ||
                    paymentData.failedReason ||
                    "Paiement refusé",
                token: paymentId,
                status: paymentStatus
            });
        }

        // =================================
        // SUCCESS RESPONSE TO FRONTEND
        // =================================

        return res.json({
            success: true,

            message:
                paymentData.message ||
                "Demande de paiement envoyée. Validez le paiement sur votre téléphone.",

            token: paymentId,

            status: paymentStatus,

            nextAction:
                paymentStatus === "PENDING"
                    ? "WAITING_FOR_CUSTOMER"
                    : null,

            otpRequired: false,

            paymentId,

            orderId,

            amount,

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

        return res.status(statusCode).json({
            success: false,

            message: errorMessage,

            error:
                reeservaError?.error ||
                undefined
        });
    }
};

// =====================================
// CHECK PAYMENT STATUS
// =====================================

export const checkPaymentStatus = async (req, res) => {
    try {
        const paymentId =
            req.params.token;

        if (!paymentId) {
            return res.status(400).json({
                success: false,
                message:
                    "Identifiant de paiement manquant"
            });
        }

        const payment =
            await verifyPayment(paymentId);

        const paymentData =
            payment?.data || payment;

        const paymentStatus =
            String(
                paymentData?.status ||
                "PENDING"
            ).toUpperCase();

        return res.json({
            success: true,

            ...payment,

            token:
                paymentData?.id ||
                paymentId,

            status:
                paymentStatus,

            paymentId:
                paymentData?.id ||
                paymentId
        });

    } catch (error) {
        console.error(
            "CHECK PAYMENT STATUS ERROR:",
            error.response?.data ||
            error.message ||
            error
        );

        const statusCode =
            error.response?.status ||
            500;

        const reeservaError =
            error.response?.data;

        return res.status(statusCode).json({
            success: false,

            message:
                reeservaError?.error?.message ||
                reeservaError?.message ||
                "Impossible de vérifier le paiement"
        });
    }
};

// =====================================
// REESERVA WEBHOOK
// =====================================
//
// Reeserva signe :
//
// t=<unix_timestamp>,v1=<hex_hmac_sha256>
//
// Signature calculée sur :
//
// timestamp + "." + raw_body
//
// Le raw body est capturé dans server.js
// AVANT express.json() de manière exploitable.
// =====================================

export const webhook = async (req, res) => {
    try {
        console.log(
            "========== REESERVA WEBHOOK =========="
        );

        // =================================
        // WEBHOOK SECRET
        // =================================

        const webhookSecret =
            process.env.REESERVA_WEBHOOK_SECRET;

        if (!webhookSecret) {
            console.error(
                "REESERVA_WEBHOOK_SECRET n'est pas configurée."
            );

            return res.status(500).json({
                success: false,
                message:
                    "Webhook secret non configuré"
            });
        }

        // =================================
        // SIGNATURE HEADER
        // =================================

        const signatureHeader =
            req.get("X-Reeserva-Signature");

        if (!signatureHeader) {
            console.error(
                "Signature Reeserva absente."
            );

            return res.status(401).json({
                success: false,
                message:
                    "Signature webhook absente"
            });
        }

        // =================================
        // PARSE SIGNATURE
        // =================================

        const signatureParts =
            signatureHeader.split(",");

        let timestamp = null;
        let receivedSignature = null;

        for (const part of signatureParts) {
            const separatorIndex =
                part.indexOf("=");

            if (separatorIndex === -1) {
                continue;
            }

            const key =
                part
                    .slice(0, separatorIndex)
                    .trim();

            const value =
                part
                    .slice(separatorIndex + 1)
                    .trim();

            if (key === "t") {
                timestamp = value;
            }

            if (key === "v1") {
                receivedSignature = value;
            }
        }

        if (
            !timestamp ||
            !receivedSignature
        ) {
            console.error(
                "Format de signature Reeserva invalide."
            );

            return res.status(401).json({
                success: false,
                message:
                    "Signature webhook invalide"
            });
        }

        // =================================
        // VALIDATE TIMESTAMP
        // =================================

        const timestampNumber =
            Number(timestamp);

        if (
            !Number.isInteger(timestampNumber)
        ) {
            console.error(
                "Timestamp webhook invalide."
            );

            return res.status(401).json({
                success: false,
                message:
                    "Timestamp webhook invalide"
            });
        }

        const now =
            Math.floor(Date.now() / 1000);

        const age =
            Math.abs(
                now - timestampNumber
            );

        // Reeserva demande une fenêtre
        // maximale de 300 secondes.
        if (age > 300) {
            console.error(
                "Webhook Reeserva trop ancien.",
                {
                    timestamp: timestampNumber,
                    now,
                    age
                }
            );

            return res.status(401).json({
                success: false,
                message:
                    "Webhook expiré"
            });
        }

        // =================================
        // RAW BODY
        // =================================

        if (!req.rawBody) {
            console.error(
                "RAW BODY absent pour le webhook Reeserva."
            );

            return res.status(400).json({
                success: false,
                message:
                    "Raw body webhook indisponible"
            });
        }

        // =================================
        // COMPUTE HMAC SHA-256
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

        // =================================
        // CONSTANT-TIME COMPARE
        // =================================

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
            console.error(
                "Signature Reeserva incorrecte."
            );

            return res.status(401).json({
                success: false,
                message:
                    "Signature webhook invalide"
            });
        }

        const signatureValid =
            crypto.timingSafeEqual(
                expectedBuffer,
                receivedBuffer
            );

        if (!signatureValid) {
            console.error(
                "Signature Reeserva incorrecte."
            );

            return res.status(401).json({
                success: false,
                message:
                    "Signature webhook invalide"
            });
        }

        // =================================
        // SIGNATURE VALID
        // =================================

        const event =
            req.body;

        const eventName =
            event?.event ||
            req.get("X-Reeserva-Event") ||
            "unknown";

        const mode =
            req.get("X-Reeserva-Mode") ||
            "LIVE";

        console.log(
            "Webhook Reeserva authentifié."
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
            "Data :",
            event?.data
        );

        // =================================
        // PAYMENT EVENTS
        // =================================

        switch (eventName) {
            case "payment.collected":

                console.log(
                    "✅ PAIEMENT REESERVA COLLECTÉ"
                );

                console.log(
                    "Transaction ID :",
                    event?.data?.transactionId
                );

                console.log(
                    "Montant :",
                    event?.data?.amount
                );

                console.log(
                    "Téléphone :",
                    event?.data?.payerPhone
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
                    event?.data?.reason
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
        // ACKNOWLEDGE
        // =================================
        //
        // Reeserva considère une réponse 2xx
        // comme une livraison réussie.
        //

        return res.status(200).json({
            received: true
        });

    } catch (error) {
        console.error(
            "WEBHOOK ERROR:",
            error.message ||
            error
        );

        return res.status(500).json({
            success: false
        });
    }
};