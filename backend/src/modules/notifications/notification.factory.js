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
exports.NotificationFactory = void 0;
var NotificationFactory = /** @class */ (function () {
    function NotificationFactory(providers) {
        this.providersByName = new Map(providers.map(function (provider) { return [provider.name, provider]; }));
    }
    NotificationFactory.prototype.getProvider = function (channelName) {
        var provider = this.providersByName.get(channelName);
        if (!provider) {
            throw new Error("Unsupported notification channel: ".concat(channelName));
        }
        return provider;
    };
    NotificationFactory.prototype.listChannels = function () {
        return __spreadArray([], this.providersByName.keys(), true);
    };
    return NotificationFactory;
}());
exports.NotificationFactory = NotificationFactory;
