"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHttpConfig = getHttpConfig;
exports.getPostgresConfig = getPostgresConfig;
exports.getRedisConfig = getRedisConfig;
exports.getKafkaConfig = getKafkaConfig;
exports.getPaymentGatewayConfig = getPaymentGatewayConfig;
exports.getNotificationConfig = getNotificationConfig;
function getHttpConfig(configService) {
    return {
        port: readNumber(configService, 'PORT', 3000),
        frontendOrigins: readList(configService, 'FRONTEND_ORIGIN', ['http://localhost:5173']),
    };
}
function getPostgresConfig(configService) {
    return {
        host: configService.get('POSTGRES_HOST', 'localhost'),
        port: readNumber(configService, 'POSTGRES_PORT', 5432),
        user: configService.get('POSTGRES_USER', 'ticketbox'),
        password: configService.get('POSTGRES_PASSWORD', 'ticketbox'),
        database: configService.get('POSTGRES_DB', 'ticketbox'),
    };
}
function getRedisConfig(configService) {
    return {
        host: configService.get('REDIS_HOST', 'localhost'),
        port: readNumber(configService, 'REDIS_PORT', 6379),
    };
}
function getKafkaConfig(configService) {
    return {
        brokers: readList(configService, 'KAFKA_BROKERS', ['localhost:9092']),
    };
}
function getPaymentGatewayConfig(configService) {
    return {
        vnpay: {
            paymentUrl: configService.get('VNPAY_URL', 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html'),
            returnUrl: configService.get('VNPAY_RETURN_URL', 'http://localhost:5173/payments/success'),
            ipnUrl: configService.get('VNPAY_IPN_URL', 'http://localhost:3000/payments/webhook'),
            hashSecret: configService.get('VNPAY_HASH_SECRET', 'vnpay-secret'),
            tmnCode: configService.get('VNPAY_TMN_CODE', 'TICKETBOX'),
            webhookSecret: configService.get('VNPAY_WEBHOOK_SECRET', 'vnpay-webhook-secret'),
        },
        momo: {
            paymentUrl: configService.get('MOMO_URL', 'https://test-payment.momo.vn/v2/gateway/api/create'),
            returnUrl: configService.get('MOMO_RETURN_URL', 'http://localhost:5173/payments/success'),
            ipnUrl: configService.get('MOMO_IPN_URL', 'http://localhost:3000/payments/webhook'),
            hashSecret: configService.get('MOMO_SECRET_KEY', 'momo-secret'),
            partnerCode: configService.get('MOMO_PARTNER_CODE', 'MOMO'),
            accessKey: configService.get('MOMO_ACCESS_KEY', 'momo-access-key'),
            webhookSecret: configService.get('MOMO_WEBHOOK_SECRET', 'momo-webhook-secret'),
        },
    };
}
function getNotificationConfig(configService) {
    return {
        email: {
            host: configService.get('EMAIL_HOST', 'localhost'),
            port: readNumber(configService, 'EMAIL_PORT', 1025),
            user: configService.get('EMAIL_USER', ''),
            password: configService.get('EMAIL_PASSWORD', ''),
            fromAddress: configService.get('EMAIL_FROM', 'noreply@ticketbox.local'),
        },
        push: {
            serverKey: configService.get('FCM_SERVER_KEY', ''),
            projectId: configService.get('FCM_PROJECT_ID', 'ticketbox'),
        },
    };
}
function readNumber(configService, key, fallback) {
    var rawValue = configService.get(key, fallback);
    var parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) {
        throw new Error("Invalid numeric environment value for ".concat(key));
    }
    return parsed;
}
function readList(configService, key, fallback) {
    var rawValue = configService.get(key);
    if (!rawValue) {
        return fallback;
    }
    return rawValue
        .split(',')
        .map(function (value) { return value.trim(); })
        .filter(Boolean);
}
