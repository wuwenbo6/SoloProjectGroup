package com.crafthub.payment.dto;

import jakarta.validation.constraints.NotBlank;
import java.math.BigDecimal;

public class PaymentCallbackDTO {

    @NotBlank(message = "支付单号不能为空")
    private String paymentNo;

    @NotBlank(message = "第三方交易号不能为空")
    private String thirdPartyTransactionId;

    private String channel;

    private BigDecimal amount;

    private boolean success;

    private String failReason;

    public String getPaymentNo() {
        return paymentNo;
    }

    public void setPaymentNo(String paymentNo) {
        this.paymentNo = paymentNo;
    }

    public String getThirdPartyTransactionId() {
        return thirdPartyTransactionId;
    }

    public void setThirdPartyTransactionId(String thirdPartyTransactionId) {
        this.thirdPartyTransactionId = thirdPartyTransactionId;
    }

    public String getChannel() {
        return channel;
    }

    public void setChannel(String channel) {
        this.channel = channel;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }

    public boolean isSuccess() {
        return success;
    }

    public void setSuccess(boolean success) {
        this.success = success;
    }

    public String getFailReason() {
        return failReason;
    }

    public void setFailReason(String failReason) {
        this.failReason = failReason;
    }
}
