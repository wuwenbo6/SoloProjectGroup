package com.crafthub.payment.enums;

public enum PaymentChannel {
    ALIPAY(1, "支付宝"),
    WECHAT(2, "微信支付"),
    UNIONPAY(3, "银联支付");

    private final int code;
    private final String desc;

    PaymentChannel(int code, String desc) {
        this.code = code;
        this.desc = desc;
    }

    public int getCode() {
        return code;
    }

    public String getDesc() {
        return desc;
    }

    public static PaymentChannel fromCode(int code) {
        for (PaymentChannel channel : values()) {
            if (channel.code == code) {
                return channel;
            }
        }
        throw new IllegalArgumentException("Unknown payment channel code: " + code);
    }
}
