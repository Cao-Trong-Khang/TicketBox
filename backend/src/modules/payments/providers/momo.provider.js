"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MomoProvider = void 0;
var node_crypto_1 = require("node:crypto");
var MomoProvider = /** @class */ (function () {
    function MomoProvider(dependencies) {
        this.dependencies = dependencies;
        this.name = 'momo';
    }
    MomoProvider.prototype.createPayment = function (request) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, this.dependencies.circuitBreaker.execute(function () { return __awaiter(_this, void 0, void 0, function () {
                        var transactionId, paymentUrl;
                        return __generator(this, function (_a) {
                            transactionId = "momo_".concat((0, node_crypto_1.randomUUID)().replace(/-/g, ''));
                            paymentUrl = this.buildPaymentUrl(request, transactionId);
                            return [2 /*return*/, {
                                    paymentUrl: paymentUrl,
                                    providerTransactionId: transactionId,
                                    rawPayload: {
                                        provider: this.name,
                                        orderId: request.orderId,
                                        amount: request.amount,
                                    },
                                }];
                        });
                    }); })];
            });
        });
    };
    MomoProvider.prototype.verifyWebhook = function (payload) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, this.dependencies.circuitBreaker.execute(function () { return __awaiter(_this, void 0, void 0, function () {
                        var expectedSignature;
                        var _a;
                        return __generator(this, function (_b) {
                            expectedSignature = this.signPayload({
                                providerTransactionId: payload.providerTransactionId,
                                status: payload.status,
                                orderId: String((_a = payload.rawPayload.orderId) !== null && _a !== void 0 ? _a : ''),
                            });
                            return [2 /*return*/, payload.signature === expectedSignature];
                        });
                    }); })];
            });
        });
    };
    MomoProvider.prototype.buildPaymentUrl = function (request, transactionId) {
        var _a, _b;
        var params = new URLSearchParams();
        params.set('partnerCode', (_a = this.dependencies.config.partnerCode) !== null && _a !== void 0 ? _a : '');
        params.set('accessKey', (_b = this.dependencies.config.accessKey) !== null && _b !== void 0 ? _b : '');
        params.set('requestId', transactionId);
        params.set('orderId', transactionId);
        params.set('amount', String(Math.round(request.amount)));
        params.set('orderInfo', "Payment for order ".concat(request.orderId));
        params.set('returnUrl', request.returnUrl || this.dependencies.config.returnUrl);
        params.set('ipnUrl', request.webhookUrl || this.dependencies.config.ipnUrl);
        var signature = this.signText(params.toString());
        return "".concat(this.dependencies.config.paymentUrl, "?").concat(params.toString(), "&signature=").concat(signature);
    };
    MomoProvider.prototype.signPayload = function (payload) {
        return this.signText("".concat(payload.orderId, "|").concat(payload.providerTransactionId, "|").concat(payload.status));
    };
    MomoProvider.prototype.signText = function (text) {
        return (0, node_crypto_1.createHmac)('sha256', this.dependencies.config.hashSecret).update(text).digest('hex');
    };
    return MomoProvider;
}());
exports.MomoProvider = MomoProvider;
