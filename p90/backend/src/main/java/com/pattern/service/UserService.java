package com.pattern.service;

import com.pattern.entity.User;
import com.pattern.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;

    @Transactional
    public User register(User user) {
        if (userRepository.existsByUsername(user.getUsername())) {
            throw new RuntimeException("用户名已存在");
        }
        return userRepository.save(user);
    }

    public Optional<User> login(String username, String password) {
        return userRepository.findByUsername(username)
                .filter(user -> user.getPassword().equals(password));
    }

    public Optional<User> getById(Long id) {
        return userRepository.findById(id);
    }

    @Transactional
    public User update(Long id, User userDetails) {
        return userRepository.findById(id)
                .map(user -> {
                    user.setNickname(userDetails.getNickname());
                    user.setEmail(userDetails.getEmail());
                    user.setAvatar(userDetails.getAvatar());
                    return userRepository.save(user);
                })
                .orElseThrow(() -> new RuntimeException("用户不存在"));
    }
}
