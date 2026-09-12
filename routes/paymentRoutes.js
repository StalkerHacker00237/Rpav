import express from "express";

import {
    createPayment,
    paymentEvents,
    webhook
} from "../controllers/paymentController.js";

const router =
    express.Router();

// =====================================
// CREATE PAYMENT
// =====================================

router.post(
    "/pay",
    createPayment
);

// =====================================
// SSE PAYMENT EVENTS
// =====================================

router.get(
    "/events/:orderId",
    paymentEvents
);

// =====================================
// REESERVA WEBHOOK GLOBAL
// =====================================
//
// Sert notamment pour les tests du
// dashboard Reeserva.
//
// =====================================

router.post(
    "/webhook",
    webhook
);

// =====================================
// REESERVA WEBHOOK PAR PAIEMENT
// =====================================
//
// Les vrais paiements utilisent cette
// route grâce au notify_url personnalisé.
//
// =====================================

router.post(
    "/webhook/:orderId",
    webhook
);

export default router;