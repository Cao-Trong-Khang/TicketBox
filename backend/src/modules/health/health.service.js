"use strict";
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthService = void 0;
var common_1 = require("@nestjs/common");
var app_config_1 = require("../shared/config/app.config");
var HealthService = function () {
    var _classDecorators = [(0, common_1.Injectable)()];
    var _classDescriptor;
    var _classExtraInitializers = [];
    var _classThis;
    var HealthService = _classThis = /** @class */ (function () {
        function HealthService_1(configService) {
            this.configService = configService;
        }
        HealthService_1.prototype.getHealth = function () {
            var http = (0, app_config_1.getHttpConfig)(this.configService);
            var postgres = (0, app_config_1.getPostgresConfig)(this.configService);
            var redis = (0, app_config_1.getRedisConfig)(this.configService);
            var kafka = (0, app_config_1.getKafkaConfig)(this.configService);
            return {
                service: 'TicketBox API',
                status: 'ok',
                environment: this.configService.get('NODE_ENV', 'development'),
                timestamp: new Date().toISOString(),
                http: {
                    port: http.port,
                    frontendOrigins: http.frontendOrigins,
                },
                dependencies: {
                    postgres: {
                        configured: Boolean(postgres.host && postgres.database),
                        host: postgres.host,
                        port: postgres.port,
                        database: postgres.database,
                    },
                    redis: {
                        configured: Boolean(redis.host),
                        host: redis.host,
                        port: redis.port,
                    },
                    kafka: {
                        configured: kafka.brokers.length > 0,
                        brokers: kafka.brokers,
                    },
                },
            };
        };
        return HealthService_1;
    }());
    __setFunctionName(_classThis, "HealthService");
    (function () {
        var _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        HealthService = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return HealthService = _classThis;
}();
exports.HealthService = HealthService;
