package com.heritage.common.optimization;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.IService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import java.io.Serializable;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.function.Function;
import java.util.stream.Collectors;

@Component
public class QueryOptimizer {

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    private static final String QUERY_CACHE_PREFIX = "heritage:query:";

    public <T> T getByIdWithCache(IService<T> service, Serializable id, Class<T> clazz) {
        String cacheKey = QUERY_CACHE_PREFIX + clazz.getSimpleName() + ":id:" + id;
        
        Object cached = redisTemplate.opsForValue().get(cacheKey);
        if (cached != null) {
            return clazz.cast(cached);
        }

        T result = service.getById(id);
        
        if (result != null) {
            redisTemplate.opsForValue().set(cacheKey, result, 5, TimeUnit.MINUTES);
        }

        return result;
    }

    public <T> List<T> listByIdsWithCache(IService<T> service, Collection<? extends Serializable> ids, Class<T> clazz) {
        if (ids == null || ids.isEmpty()) {
            return Collections.emptyList();
        }

        List<String> cacheKeys = ids.stream()
            .map(id -> QUERY_CACHE_PREFIX + clazz.getSimpleName() + ":id:" + id)
            .collect(Collectors.toList());

        Map<String, Object> cachedMap = redisTemplate.opsForValue().multiGet(cacheKeys)
            .stream()
            .filter(Objects::nonNull)
            .collect(Collectors.toMap(
                obj -> QUERY_CACHE_PREFIX + clazz.getSimpleName() + ":id:" + getIdFromObject(obj),
                Function.identity()
            ));

        List<Serializable> missingIds = ids.stream()
            .filter(id -> !cachedMap.containsKey(QUERY_CACHE_PREFIX + clazz.getSimpleName() + ":id:" + id))
            .collect(Collectors.toList());

        List<T> result = new ArrayList<>();
        result.addAll(cachedMap.values().stream().map(clazz::cast).collect(Collectors.toList()));

        if (!missingIds.isEmpty()) {
            List<T> dbResults = service.listByIds(missingIds);
            result.addAll(dbResults);

            Map<String, Object> toCache = dbResults.stream()
                .collect(Collectors.toMap(
                    item -> QUERY_CACHE_PREFIX + clazz.getSimpleName() + ":id:" + getIdFromObject(item),
                    Function.identity()
                ));
            
            if (!toCache.isEmpty()) {
                redisTemplate.opsForValue().multiSet(toCache);
                toCache.keySet().forEach(key -> 
                    redisTemplate.expire(key, 5, TimeUnit.MINUTES)
                );
            }
        }

        return result;
    }

    public <T> IPage<T> pageWithCache(IService<T> service, int pageNum, int pageSize, 
                                        LambdaQueryWrapper<T> wrapper, Class<T> clazz) {
        String cacheKey = QUERY_CACHE_PREFIX + clazz.getSimpleName() + ":page:" 
                          + pageNum + ":" + pageSize + ":" 
                          + wrapper.getSqlSegment().hashCode();

        Object cached = redisTemplate.opsForValue().get(cacheKey);
        if (cached != null) {
            return (IPage<T>) cached;
        }

        IPage<T> result = service.page(new Page<>(pageNum, pageSize), wrapper);

        redisTemplate.opsForValue().set(cacheKey, result, 2, TimeUnit.MINUTES);

        return result;
    }

    @Async
    public <T> CompletableFuture<List<T>> asyncListByIds(IService<T> service, 
                                                           Collection<? extends Serializable> ids, 
                                                           Class<T> clazz) {
        return CompletableFuture.completedFuture(listByIdsWithCache(service, ids, clazz));
    }

    @Async
    public <T> CompletableFuture<T> asyncGetById(IService<T> service, Serializable id, Class<T> clazz) {
        return CompletableFuture.completedFuture(getByIdWithCache(service, id, clazz));
    }

    public <T> Map<Serializable, T> mapByIds(IService<T> service, Collection<? extends Serializable> ids, 
                                              Class<T> clazz, Function<T, Serializable> idExtractor) {
        List<T> list = listByIdsWithCache(service, ids, clazz);
        return list.stream()
            .collect(Collectors.toMap(idExtractor, Function.identity()));
    }

    public void evictByIdCache(Class<?> clazz, Serializable id) {
        String cacheKey = QUERY_CACHE_PREFIX + clazz.getSimpleName() + ":id:" + id;
        redisTemplate.delete(cacheKey);
    }

    public void evictPageCache(Class<?> clazz) {
        String pattern = QUERY_CACHE_PREFIX + clazz.getSimpleName() + ":page:*";
        Set<String> keys = redisTemplate.keys(pattern);
        if (keys != null && !keys.isEmpty()) {
            redisTemplate.delete(keys);
        }
    }

    public void evictAllCache(Class<?> clazz) {
        String pattern = QUERY_CACHE_PREFIX + clazz.getSimpleName() + ":*";
        Set<String> keys = redisTemplate.keys(pattern);
        if (keys != null && !keys.isEmpty()) {
            redisTemplate.delete(keys);
        }
    }

    private Serializable getIdFromObject(Object obj) {
        try {
            return (Serializable) obj.getClass().getMethod("getId").invoke(obj);
        } catch (Exception e) {
            return obj.hashCode();
        }
    }

    public static class BatchQueryBuilder<T> {
        private IService<T> service;
        private Class<T> clazz;
        private List<Serializable> ids = new ArrayList<>();
        private int batchSize = 100;
        private boolean parallel = true;

        public BatchQueryBuilder(IService<T> service, Class<T> clazz) {
            this.service = service;
            this.clazz = clazz;
        }

        public BatchQueryBuilder<T> addId(Serializable id) {
            this.ids.add(id);
            return this;
        }

        public BatchQueryBuilder<T> addIds(Collection<? extends Serializable> ids) {
            this.ids.addAll(ids);
            return this;
        }

        public BatchQueryBuilder<T> batchSize(int size) {
            this.batchSize = size;
            return this;
        }

        public BatchQueryBuilder<T> parallel(boolean parallel) {
            this.parallel = parallel;
            return this;
        }

        public List<T> execute() {
            if (ids.isEmpty()) {
                return Collections.emptyList();
            }

            List<List<Serializable>> batches = partition(ids, batchSize);
            
            if (parallel) {
                return batches.parallelStream()
                    .map(batch -> service.listByIds(batch))
                    .flatMap(List::stream)
                    .collect(Collectors.toList());
            } else {
                return batches.stream()
                    .map(batch -> service.listByIds(batch))
                    .flatMap(List::stream)
                    .collect(Collectors.toList());
            }
        }

        private <E> List<List<E>> partition(List<E> list, int size) {
            List<List<E>> partitions = new ArrayList<>();
            for (int i = 0; i < list.size(); i += size) {
                partitions.add(list.subList(i, Math.min(i + size, list.size())));
            }
            return partitions;
        }
    }
}