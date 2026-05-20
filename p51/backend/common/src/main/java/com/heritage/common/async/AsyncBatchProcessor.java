package com.heritage.common.async;

import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.AsyncResult;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.concurrent.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Component
public class AsyncBatchProcessor {

    private final ExecutorService executorService = Executors.newFixedThreadPool(
        Runtime.getRuntime().availableProcessors() * 2
    );

    @Async
    public <T, R> CompletableFuture<List<R>> processBatch(
        List<T> items,
        Function<T, R> processor,
        int batchSize
    ) {
        if (items == null || items.isEmpty()) {
            return CompletableFuture.completedFuture(Collections.emptyList());
        }

        List<List<T>> batches = partition(items, batchSize);
        
        List<CompletableFuture<List<R>>> futures = batches.stream()
            .map(batch -> CompletableFuture.supplyAsync(
                () -> batch.stream().map(processor).collect(Collectors.toList()),
                executorService
            ))
            .collect(Collectors.toList());

        return CompletableFuture.allOf(futures.toArray(new CompletableFuture[0]))
            .thenApply(v -> futures.stream()
                .map(CompletableFuture::join)
                .flatMap(List::stream)
                .collect(Collectors.toList())
            );
    }

    @Async
    public <T> CompletableFuture<Void> processBatchAsync(
        List<T> items,
        java.util.function.Consumer<T> processor,
        int batchSize
    ) {
        if (items == null || items.isEmpty()) {
            return CompletableFuture.completedFuture(null);
        }

        List<List<T>> batches = partition(items, batchSize);
        
        List<CompletableFuture<Void>> futures = batches.stream()
            .map(batch -> CompletableFuture.runAsync(
                () -> batch.forEach(processor),
                executorService
            ))
            .collect(Collectors.toList());

        return CompletableFuture.allOf(futures.toArray(new CompletableFuture[0]));
    }

    public <T, R> List<R> processBatchParallel(
        List<T> items,
        Function<T, R> processor,
        int batchSize
    ) {
        if (items == null || items.isEmpty()) {
            return Collections.emptyList();
        }

        List<List<T>> batches = partition(items, batchSize);
        
        return batches.parallelStream()
            .map(batch -> batch.stream().map(processor).collect(Collectors.toList()))
            .flatMap(List::stream)
            .collect(Collectors.toList());
    }

    public <T, R> CompletableFuture<R> submitWithTimeout(
        Callable<R> task,
        long timeout,
        TimeUnit unit,
        R defaultValue
    ) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                return task.call();
            } catch (Exception e) {
                return defaultValue;
            }
        }, executorService).orTimeout(timeout, unit).exceptionally(ex -> defaultValue);
    }

    public <T> CompletableFuture<T> withFallback(
        CompletableFuture<T> future,
        T fallbackValue
    ) {
        return future.exceptionally(ex -> fallbackValue);
    }

    public <T> List<CompletableFuture<T>> executeAll(
        List<Callable<T>> tasks,
        long timeout,
        TimeUnit unit
    ) {
        return tasks.stream()
            .map(task -> CompletableFuture.supplyAsync(() -> {
                try {
                    return task.call();
                } catch (Exception e) {
                    throw new CompletionException(e);
                }
            }, executorService).orTimeout(timeout, unit))
            .collect(Collectors.toList());
    }

    private <T> List<List<T>> partition(List<T> list, int size) {
        List<List<T>> partitions = new ArrayList<>();
        for (int i = 0; i < list.size(); i += size) {
            partitions.add(list.subList(i, Math.min(i + size, list.size())));
        }
        return partitions;
    }

    public void shutdown() {
        executorService.shutdown();
        try {
            if (!executorService.awaitTermination(60, TimeUnit.SECONDS)) {
                executorService.shutdownNow();
            }
        } catch (InterruptedException e) {
            executorService.shutdownNow();
            Thread.currentThread().interrupt();
        }
    }

    public ExecutorService getExecutorService() {
        return executorService;
    }
}