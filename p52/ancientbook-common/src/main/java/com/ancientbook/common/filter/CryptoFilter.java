package com.ancientbook.common.filter;

import com.ancientbook.common.util.ApiCryptoUtil;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import javax.servlet.*;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletRequestWrapper;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@Component
@Order(1)
@RequiredArgsConstructor
public class CryptoFilter implements Filter {

    private final ObjectMapper objectMapper;

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        HttpServletRequest httpRequest = (HttpServletRequest) request;
        String path = httpRequest.getRequestURI();

        if (path.startsWith("/api/crypto/") || path.startsWith("/api/archive/export/")) {
            chain.doFilter(request, response);
            return;
        }

        String cryptoHeader = httpRequest.getHeader("X-Crypto-Enabled");
        if (!"true".equals(cryptoHeader)) {
            chain.doFilter(request, response);
            return;
        }

        log.debug("加密请求处理: {}", path);

        CachedBodyHttpServletRequest wrappedRequest = new CachedBodyHttpServletRequest(httpRequest);
        String body = new String(wrappedRequest.getCachedBody(), StandardCharsets.UTF_8);

        try {
            JsonNode jsonNode = objectMapper.readTree(body);
            String encryptedData = jsonNode.has("data") ? jsonNode.get("data").asText() : null;
            long timestamp = jsonNode.has("timestamp") ? jsonNode.get("timestamp").asLong() : 0;
            String nonce = jsonNode.has("nonce") ? jsonNode.get("nonce").asText() : null;
            String signature = jsonNode.has("signature") ? jsonNode.get("signature").asText() : null;

            if (encryptedData == null || timestamp == 0 || nonce == null || signature == null) {
                throw new ServletException("加密参数不完整");
            }

            boolean signValid = ApiCryptoUtil.verifySignature(encryptedData, timestamp, nonce, signature);
            if (!signValid) {
                log.warn("请求签名验证失败: {}", path);
                throw new ServletException("签名验证失败");
            }

            String decryptedData = ApiCryptoUtil.decrypt(encryptedData);
            log.debug("解密成功: {}", decryptedData);

            ByteArrayInputStream decryptedInputStream =
                    new ByteArrayInputStream(decryptedData.getBytes(StandardCharsets.UTF_8));

            HttpServletRequestWrapper finalRequest = new HttpServletRequestWrapper(wrappedRequest) {
                @Override
                public ServletInputStream getInputStream() {
                    return new ServletInputStream() {
                        @Override
                        public int read() {
                            return decryptedInputStream.read();
                        }

                        @Override
                        public boolean isFinished() {
                            return decryptedInputStream.available() == 0;
                        }

                        @Override
                        public boolean isReady() {
                            return true;
                        }

                        @Override
                        public void setReadListener(ReadListener readListener) {
                        }
                    };
                }

                @Override
                public BufferedReader getReader() {
                    return new BufferedReader(new InputStreamReader(decryptedInputStream, StandardCharsets.UTF_8));
                }
            };

            chain.doFilter(finalRequest, response);

        } catch (Exception e) {
            log.error("解密请求失败", e);
            throw new ServletException("解密失败: " + e.getMessage(), e);
        }
    }

    private static class CachedBodyHttpServletRequest extends HttpServletRequestWrapper {
        private final byte[] cachedBody;

        public CachedBodyHttpServletRequest(HttpServletRequest request) throws IOException {
            super(request);
            InputStream requestInputStream = request.getInputStream();
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            byte[] bytes = new byte[1024];
            int read;
            while ((read = requestInputStream.read(bytes)) != -1) {
                buffer.write(bytes, 0, read);
            }
            this.cachedBody = buffer.toByteArray();
        }

        public byte[] getCachedBody() {
            return cachedBody;
        }
    }
}
