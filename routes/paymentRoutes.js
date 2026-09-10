import express from "express";

import {
    createPayment,
    checkPaymentStatus,
    webhook
} from "../controllers/paymentController.js";

const router = express.Router();

// ======================================
// CREATE PAYMENT
// ======================================

router.post("/pay", createPayment);

// ======================================
// VERIFY PAYMENT STATUS
// ======================================

router.get("/status/:token", checkPaymentStatus);

// ======================================
// REESERVA WEBHOOK
// ======================================

router.post("/webhook", webhook);

export default router;