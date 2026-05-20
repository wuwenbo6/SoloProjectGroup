package com.crafthub.common.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class ResponsiveConfigService {

    private final RedisTemplate<String, Object> redisTemplate;

    private static final String CONFIG_CACHE_KEY = "responsive:config:";
    private static final String DEFAULT_DEVICE = "default";

    public enum DeviceType {
        MOBILE_S("mobile_s", 320, 480, 1.0f),
        MOBILE_M("mobile_m", 375, 667, 2.0f),
        MOBILE_L("mobile_l", 414, 736, 3.0f),
        TABLET_S("tablet_s", 768, 1024, 1.0f),
        TABLET_L("tablet_l", 1024, 1366, 2.0f),
        DESKTOP("desktop", 1920, 1080, 1.0f),
        TV("tv", 3840, 2160, 2.0f);

        private final String type;
        private final int width;
        private final int height;
        private final float density;

        DeviceType(String type, int width, int height, float density) {
            this.type = type;
            this.width = width;
            this.height = height;
            this.density = density;
        }

        public String getType() { return type; }
        public int getWidth() { return width; }
        public int getHeight() { return height; }
        public float getDensity() { return density; }
    }

    public Map<String, Object> getDeviceConfig(String userAgent, int screenWidth, int screenHeight) {
        DeviceType deviceType = detectDeviceType(screenWidth, screenHeight, userAgent);

        String cacheKey = CONFIG_CACHE_KEY + deviceType.getType();
        Map<String, Object> cachedConfig = (Map<String, Object>) redisTemplate.opsForValue().get(cacheKey);

        if (cachedConfig != null) {
            log.debug("命中设备配置缓存, device: {}", deviceType.getType());
            return cachedConfig;
        }

        Map<String, Object> config = generateDeviceConfig(deviceType, screenWidth, screenHeight);
        redisTemplate.opsForValue().set(cacheKey, config, 1, TimeUnit.HOURS);

        log.info("生成设备配置, device: {}, width: {}, height: {}",
            deviceType.getType(), screenWidth, screenHeight);

        return config;
    }

    private DeviceType detectDeviceType(int width, int height, String userAgent) {
        int minDimension = Math.min(width, height);
        int maxDimension = Math.max(width, height);

        if (userAgent != null && userAgent.toLowerCase().contains("tv")) {
            return DeviceType.TV;
        }

        if (userAgent != null && userAgent.toLowerCase().contains("ipad")) {
            return DeviceType.TABLET_L;
        }

        if (minDimension <= 0) {
            minDimension = width;
        }

        if (minDimension <= 320) {
            return DeviceType.MOBILE_S;
        } else if (minDimension <= 375) {
            return DeviceType.MOBILE_M;
        } else if (minDimension <= 414) {
            return DeviceType.MOBILE_L;
        } else if (minDimension <= 768) {
            return DeviceType.TABLET_S;
        } else if (minDimension <= 1024) {
            return DeviceType.TABLET_L;
        } else if (minDimension <= 1920) {
            return DeviceType.DESKTOP;
        } else {
            return DeviceType.TV;
        }
    }

    private Map<String, Object> generateDeviceConfig(DeviceType deviceType, int actualWidth, int actualHeight) {
        Map<String, Object> config = new HashMap<>();

        config.put("deviceType", deviceType.getType());
        config.put("baseWidth", deviceType.getWidth());
        config.put("baseHeight", deviceType.getHeight());
        config.put("actualWidth", actualWidth);
        config.put("actualHeight", actualHeight);
        config.put("density", deviceType.getDensity());

        float scaleX = (float) actualWidth / deviceType.getWidth();
        float scaleY = (float) actualHeight / deviceType.getHeight();
        config.put("scaleX", scaleX);
        config.put("scaleY", scaleY);

        config.put("isMobile", deviceType.name().startsWith("MOBILE"));
        config.put("isTablet", deviceType.name().startsWith("TABLET"));
        config.put("isDesktop", deviceType == DeviceType.DESKTOP);
        config.put("isTV", deviceType == DeviceType.TV);

        Map<String, Integer> breakpoints = new HashMap<>();
        breakpoints.put("xs", 320);
        breakpoints.put("sm", 375);
        breakpoints.put("md", 414);
        breakpoints.put("lg", 768);
        breakpoints.put("xl", 1024);
        breakpoints.put("xxl", 1920);
        config.put("breakpoints", breakpoints);

        Map<String, Object> layout = new HashMap<>();
        layout.put("containerMaxWidth", getContainerMaxWidth(deviceType));
        layout.put("gutter", getGutter(deviceType));
        layout.put("columnCount", getColumnCount(deviceType));
        layout.put("navBarHeight", getNavBarHeight(deviceType));
        layout.put("tabBarHeight", getTabBarHeight(deviceType));
        config.put("layout", layout);

        Map<String, Object> typography = new HashMap<>();
        typography.put("baseFontSize", getBaseFontSize(deviceType));
        typography.put("headingScale", getHeadingScale(deviceType));
        typography.put("lineHeight", getLineHeight(deviceType));
        config.put("typography", typography);

        Map<String, Object> images = new HashMap<>();
        images.put("quality", getImageQuality(deviceType));
        images.put("thumbnailSize", getThumbnailSize(deviceType));
        images.put("maxImageWidth", getMaxImageWidth(deviceType));
        config.put("images", images);

        Map<String, Object> touch = new HashMap<>();
        touch.put("minTargetSize", getMinTouchTarget(deviceType));
        touch.put("iconSize", getIconSize(deviceType));
        touch.put("buttonHeight", getButtonHeight(deviceType));
        config.put("touch", touch);

        return config;
    }

    private int getContainerMaxWidth(DeviceType deviceType) {
        switch (deviceType) {
            case MOBILE_S: return 300;
            case MOBILE_M: return 355;
            case MOBILE_L: return 394;
            case TABLET_S: return 720;
            case TABLET_L: return 960;
            case DESKTOP: return 1200;
            case TV: return 1920;
            default: return 1200;
        }
    }

    private int getGutter(DeviceType deviceType) {
        switch (deviceType) {
            case MOBILE_S:
            case MOBILE_M:
            case MOBILE_L: return 12;
            case TABLET_S:
            case TABLET_L: return 16;
            case DESKTOP:
            case TV: return 24;
            default: return 16;
        }
    }

    private int getColumnCount(DeviceType deviceType) {
        switch (deviceType) {
            case MOBILE_S:
            case MOBILE_M:
            case MOBILE_L: return 4;
            case TABLET_S:
            case TABLET_L: return 8;
            case DESKTOP:
            case TV: return 12;
            default: return 12;
        }
    }

    private int getNavBarHeight(DeviceType deviceType) {
        switch (deviceType) {
            case MOBILE_S:
            case MOBILE_M:
            case MOBILE_L: return 44;
            case TABLET_S:
            case TABLET_L: return 50;
            case DESKTOP:
            case TV: return 64;
            default: return 44;
        }
    }

    private int getTabBarHeight(DeviceType deviceType) {
        switch (deviceType) {
            case MOBILE_S:
            case MOBILE_M:
            case MOBILE_L: return 49;
            case TABLET_S:
            case TABLET_L: return 56;
            default: return 0;
        }
    }

    private float getBaseFontSize(DeviceType deviceType) {
        switch (deviceType) {
            case MOBILE_S: return 12.0f;
            case MOBILE_M:
            case MOBILE_L: return 14.0f;
            case TABLET_S:
            case TABLET_L: return 15.0f;
            case DESKTOP:
            case TV: return 16.0f;
            default: return 14.0f;
        }
    }

    private float[] getHeadingScale(DeviceType deviceType) {
        return new float[]{2.5f, 2.0f, 1.75f, 1.5f, 1.25f, 1.0f};
    }

    private float getLineHeight(DeviceType deviceType) {
        return 1.5f;
    }

    private int getImageQuality(DeviceType deviceType) {
        switch (deviceType) {
            case MOBILE_S:
            case MOBILE_M:
            case MOBILE_L: return 80;
            case TABLET_S:
            case TABLET_L: return 85;
            case DESKTOP:
            case TV: return 90;
            default: return 85;
        }
    }

    private int getThumbnailSize(DeviceType deviceType) {
        switch (deviceType) {
            case MOBILE_S:
            case MOBILE_M:
            case MOBILE_L: return 200;
            case TABLET_S:
            case TABLET_L: return 300;
            case DESKTOP:
            case TV: return 400;
            default: return 200;
        }
    }

    private int getMaxImageWidth(DeviceType deviceType) {
        switch (deviceType) {
            case MOBILE_S: return 640;
            case MOBILE_M:
            case MOBILE_L: return 750;
            case TABLET_S: return 1536;
            case TABLET_L: return 2048;
            case DESKTOP:
            case TV: return 3840;
            default: return 1080;
        }
    }

    private int getMinTouchTarget(DeviceType deviceType) {
        return 44;
    }

    private int getIconSize(DeviceType deviceType) {
        switch (deviceType) {
            case MOBILE_S:
            case MOBILE_M:
            case MOBILE_L: return 24;
            case TABLET_S:
            case TABLET_L: return 28;
            case DESKTOP:
            case TV: return 32;
            default: return 24;
        }
    }

    private int getButtonHeight(DeviceType deviceType) {
        switch (deviceType) {
            case MOBILE_S:
            case MOBILE_M:
            case MOBILE_L: return 44;
            case TABLET_S:
            case TABLET_L: return 48;
            case DESKTOP:
            case TV: return 52;
            default: return 44;
        }
    }

    public void invalidateDeviceConfigCache() {
        redisTemplate.delete(redisTemplate.keys(CONFIG_CACHE_KEY + "*"));
        log.info("已清除所有响应式配置缓存");
    }
}
