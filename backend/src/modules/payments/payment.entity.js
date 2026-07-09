"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentEntity = void 0;
var PaymentEntity = /** @class */ (function () {
    function PaymentEntity(props) {
        this.id = props.id;
        this.orderId = props.orderId;
        this.provider = props.provider;
        this.transactionId = props.transactionId;
        this.amount = props.amount;
        this.status = props.status;
        this.createdAt = props.createdAt;
        this.updatedAt = props.updatedAt;
    }
    PaymentEntity.fromDatabase = function (row) {
        return new PaymentEntity(row);
    };
    return PaymentEntity;
}());
exports.PaymentEntity = PaymentEntity;
