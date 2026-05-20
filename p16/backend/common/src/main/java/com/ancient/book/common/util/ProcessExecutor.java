package com.ancient.book.common.util;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;

@Slf4j
@Component
public class ProcessExecutor {

    private static final long DEFAULT_TIMEOUT = 300;

    public ProcessResult execute(String[] command, Map<String, String> environment) 
            throws IOException, InterruptedException {
        return execute(command, environment, DEFAULT_TIMEOUT, null);
    }

    public ProcessResult execute(String[] command, Map<String, String> environment, 
            long timeoutSeconds, Consumer<String> outputConsumer) 
            throws IOException, InterruptedException {
        
        log.info("执行命令: {}", String.join(" ", command));
        
        ProcessBuilder processBuilder = new ProcessBuilder(command);
        
        if (environment != null && !environment.isEmpty()) {
            Map<String, String> env = processBuilder.environment();
            env.putAll(environment);
            log.debug("设置环境变量: {}", environment.keySet());
        }
        
        processBuilder.redirectErrorStream(true);
        
        long startTime = System.currentTimeMillis();
        Process process = processBuilder.start();
        
        StringBuilder output = new StringBuilder();
        StringBuilder error = new StringBuilder();
        
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                output.append(line).append("\n");
                if (outputConsumer != null) {
                    outputConsumer.accept(line);
                }
            }
        }
        
        boolean completed = process.waitFor(timeoutSeconds, TimeUnit.SECONDS);
        
        if (!completed) {
            process.destroyForcibly();
            log.error("命令执行超时，已强制终止: {}", String.join(" ", command));
            return new ProcessResult(-1, output.toString(), 
                    "执行超时，超过" + timeoutSeconds + "秒");
        }
        
        int exitCode = process.exitValue();
        long duration = System.currentTimeMillis() - startTime;
        
        log.info("命令执行完成，退出码: {}, 耗时: {}ms", exitCode, duration);
        
        if (exitCode != 0) {
            log.warn("命令执行异常，退出码: {}, 输出: {}", exitCode, output.substring(
                    Math.min(0, output.length() - 500)));
        }
        
        return new ProcessResult(exitCode, output.toString(), error.toString());
    }

    public ProcessResult executePythonScript(String scriptPath, String[] args, 
            Map<String, String> environment) throws IOException, InterruptedException {
        
        String pythonExec = findPythonExecutable();
        log.info("使用Python解释器: {}", pythonExec);
        
        String[] command = new String[args.length + 2];
        command[0] = pythonExec;
        command[1] = scriptPath;
        System.arraycopy(args, 0, command, 2, args.length);
        
        return execute(command, environment);
    }

    private String findPythonExecutable() {
        String[] candidates = {"python3", "python", "py"};
        for (String candidate : candidates) {
            try {
                Process process = new ProcessBuilder(candidate, "--version").start();
                if (process.waitFor(5, TimeUnit.SECONDS) && process.exitValue() == 0) {
                    return candidate;
                }
            } catch (Exception e) {
                log.debug("尝试Python解释器失败: {}", candidate);
            }
        }
        log.warn("未找到Python解释器，使用默认值: python3");
        return "python3";
    }

    public static class ProcessResult {
        private final int exitCode;
        private final String output;
        private final String error;

        public ProcessResult(int exitCode, String output, String error) {
            this.exitCode = exitCode;
            this.output = output;
            this.error = error;
        }

        public boolean isSuccess() {
            return exitCode == 0;
        }

        public int getExitCode() {
            return exitCode;
        }

        public String getOutput() {
            return output;
        }

        public String getError() {
            return error;
        }
    }
}
