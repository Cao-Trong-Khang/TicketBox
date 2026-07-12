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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VnpayProvider = void 0;
var node_crypto_1 = require("node:crypto");
var VnpayProvider = /** @class */ (function () {
    function VnpayProvider(dependencies) {
        this.dependencies = dependencies;
        this.name = 'vnpay';
    }
    VnpayProvider.prototype.createPayment = function (request) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, this.dependencies.circuitBreaker.execute(function () { return __awaiter(_this, void 0, void 0, function () {
                        var transactionId, paymentUrl;
                        return __generator(this, function (_a) {
                            transactionId = "vnp_".concat((0, node_crypto_1.randomUUID)().replace(/-/g, ''));
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
    VnpayProvider.prototype.verifyWebhook = function (payload) {
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
    VnpayProvider.prototype.buildPaymentUrl = function (request, transactionId) {
        var _a;
        var params = new URLSearchParams();
        params.set('vnp_Version', '2.1.0');
        params.set('vnp_Command', 'pay');
        params.set('vnp_TmnCode', (_a = this.dependencies.config.tmnCode) !== null && _a !== void 0 ? _a : '');
        params.set('vnp_Amount', String(Math.round(request.amount * 100)));
        params.set('vnp_CurrCode', 'VND');
        params.set('vnp_TxnRef', transactionId);
        params.set('vnp_OrderInfo', "Payment for order ".concat(request.orderId));
        params.set('vnp_OrderType', 'other');
        params.set('vnp_ReturnUrl', request.returnUrl || this.dependencies.config.returnUrl);
        params.set('vnp_IpnUrl', request.webhookUrl || this.dependencies.config.ipnUrl);
        params.set('vnp_CreateDate', this.formatDate(new Date()));
        var sortedParams = __spreadArray([], params.entries(), true).sort(function (_a, _b) {
            var left = _a[0];
            var right = _b[0];
            return left.localeCompare(right);
        });
        var queryString = sortedParams.map(function (_a) {
            var key = _a[0], value = _a[1];
            return "".concat(key, "=").concat(encodeURIComponent(value));
        }).join('&');
        var secureHash = this.signText(queryString);
        return "".concat(this.dependencies.config.paymentUrl, "?").concat(queryString, "&vnp_SecureHash=").concat(secureHash);
    };
    VnpayProvider.prototype.signPayload = function (payload) {
        return this.signText("".concat(payload.orderId, "|").concat(payload.providerTransactionId, "|").concat(payload.status));
    };
    VnpayProvider.prototype.signText = function (text) {
        return (0, node_crypto_1.createHmac)('sha512', this.dependencies.config.hashSecret).update(text).digest('hex');
    };
    VnpayProvider.prototype.formatDate = function (date) {
        var year = String(date.getUTCFullYear());
        var month = String(date.getUTCMonth() + 1).padStart(2, '0');
        var day = String(date.getUTCDate()).padStart(2, '0');
        var hour = String(date.getUTCHours()).padStart(2, '0');
        var minute = String(date.getUTCMinutes()).padStart(2, '0');
        var second = String(date.getUTCSeconds()).padStart(2, '0');
        return "".concat(year).concat(month).concat(day).concat(hour).concat(minute).concat(second);
    };
    return VnpayProvider;
}());
exports.VnpayProvider = VnpayProvider;
