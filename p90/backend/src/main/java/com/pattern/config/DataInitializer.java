package com.pattern.config;

import com.pattern.entity.Comment;
import com.pattern.entity.Pattern;
import com.pattern.entity.User;
import com.pattern.repository.CommentRepository;
import com.pattern.repository.PatternRepository;
import com.pattern.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PatternRepository patternRepository;
    private final CommentRepository commentRepository;

    @Override
    public void run(String... args) {
        if (userRepository.count() == 0) {
            User user = new User();
            user.setUsername("admin");
            user.setPassword("123456");
            user.setNickname("管理员");
            user.setEmail("admin@example.com");
            userRepository.save(user);

            for (int i = 1; i <= 5; i++) {
                Pattern pattern = new Pattern();
                pattern.setName("脸谱纹样 " + i);
                pattern.setDescription("这是第 " + i + " 个经典脸谱纹样，包含丰富的文化内涵。");
                pattern.setTags(List.of("京剧", "传统", "艺术-" + i));
                pattern.setUserId(user.getId());
                pattern.setAuthorName(user.getNickname());
                pattern.setLikeCount(i * 10);
                pattern.setCommentCount(i * 2);
                pattern.setShareCount(i * 5);
                pattern.setImageData(generateSampleSvg(i));
                patternRepository.save(pattern);

                for (int j = 1; j <= i; j++) {
                    Comment comment = new Comment();
                    comment.setPatternId(pattern.getId());
                    comment.setUserId(user.getId());
                    comment.setUserName(user.getNickname());
                    comment.setContent("这个纹样设计得太棒了！评论 #" + j);
                    commentRepository.save(comment);
                }
            }
        }
    }

    private String generateSampleSvg(int index) {
        String[] colors = {"#E63946", "#F4A261", "#2A9D8F", "#264653", "#E9C46A"};
        String color = colors[index - 1];
        return "data:image/svg+xml;base64," +
                java.util.Base64.getEncoder().encodeToString(
                        ("<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'>" +
                                "<rect width='400' height='400' fill='white'/>" +
                                "<circle cx='200' cy='200' r='150' fill='" + color + "' opacity='0.8'/>" +
                                "<ellipse cx='140' cy='160' rx='30' ry='40' fill='white'/>" +
                                "<ellipse cx='260' cy='160' rx='30' ry='40' fill='white'/>" +
                                "<circle cx='140' cy='160' r='15' fill='black'/>" +
                                "<circle cx='260' cy='160' r='15' fill='black'/>" +
                                "<path d='M140 280 Q200 320 260 280' stroke='black' stroke-width='8' fill='none'/>" +
                                "<text x='200' y='50' text-anchor='middle' font-size='24' fill='black'>脸谱 " + index + "</text>" +
                                "</svg>").getBytes()
                );
    }
}
