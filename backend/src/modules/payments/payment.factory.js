"use strict";
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
exports.PaymentFactory = void 0;
var PaymentFactory = /** @class */ (function () {
    function PaymentFactory(providers) {
        this.providersByName = new Map(providers.map(function (provider) { return [provider.name, provider]; }));
    }
    PaymentFactory.prototype.getProvider = function (providerName) {
        var provider = this.providersByName.get(providerName);
        if (!provider) {
            throw new Error("Unsupported payment provider: ".concat(providerName));
        }
        return provider;
    };
    PaymentFactory.prototype.listProviders = function () {
        return __spreadArray([], this.providersByName.keys(), true);
    };
    return PaymentFactory;
}());
exports.PaymentFactory = PaymentFactory;
