CREATE DATABASE IF NOT EXISTS card_battle DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE card_battle;

CREATE TABLE IF NOT EXISTS player (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(100) NOT NULL,
    nickname VARCHAR(50) NOT NULL,
    level INT DEFAULT 1,
    exp INT DEFAULT 0,
    rank_id INT DEFAULT 1,
    rank_points INT DEFAULT 0,
    wins INT DEFAULT 0,
    losses INT DEFAULT 0,
    draws INT DEFAULT 0,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    status INT DEFAULT 1,
    INDEX idx_username (username),
    INDEX idx_rank_id (rank_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS card (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    type INT NOT NULL COMMENT '1:攻击, 2:防御, 3:治疗, 4:特殊',
    cost INT NOT NULL DEFAULT 1,
    attack INT DEFAULT 0,
    health INT DEFAULT 0,
    effect VARCHAR(50) COMMENT '卡牌效果标识',
    description VARCHAR(200),
    rarity INT DEFAULT 1 COMMENT '1:普通, 2:稀有, 3:史诗, 4:传说',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    status INT DEFAULT 1,
    INDEX idx_type (type),
    INDEX idx_rarity (rarity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS player_card (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    player_id BIGINT NOT NULL,
    card_id BIGINT NOT NULL,
    count INT DEFAULT 1,
    obtain_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_player_card (player_id, card_id),
    INDEX idx_player_id (player_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS battle_record (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    battle_id VARCHAR(64) NOT NULL UNIQUE,
    player1_id BIGINT NOT NULL,
    player2_id BIGINT NOT NULL,
    winner_id BIGINT,
    duration INT DEFAULT 0 COMMENT '战斗时长(秒)',
    turn_count INT DEFAULT 0,
    replay_data TEXT COMMENT '回放数据JSON',
    start_time DATETIME,
    end_time DATETIME,
    status INT DEFAULT 1,
    INDEX idx_battle_id (battle_id),
    INDEX idx_player1_id (player1_id),
    INDEX idx_player2_id (player2_id),
    INDEX idx_winner_id (winner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rank (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(20) NOT NULL,
    min_points INT NOT NULL DEFAULT 0,
    max_points INT NOT NULL DEFAULT 9999,
    icon VARCHAR(100),
    order INT NOT NULL DEFAULT 0,
    INDEX idx_order (order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO rank (name, min_points, max_points, order) VALUES
('青铜', 0, 999, 1),
('白银', 1000, 1999, 2),
('黄金', 2000, 2999, 3),
('铂金', 3000, 3999, 4),
('钻石', 4000, 4999, 5),
('大师', 5000, 5999, 6),
('王者', 6000, 9999, 7);

INSERT INTO card (name, type, cost, attack, health, effect, description, rarity) VALUES
('火球术', 1, 2, 5, 0, 'DAMAGE', '对敌方造成5点伤害', 1),
('治愈术', 3, 2, 0, 5, 'HEAL', '恢复5点生命值', 1),
('力量祝福', 4, 1, 2, 0, 'BUFF_ATTACK', '本回合攻击力+2', 1),
('闪电链', 1, 3, 8, 0, 'DAMAGE', '对敌方造成8点伤害', 2),
('神圣护盾', 2, 2, 0, 10, 'SHIELD', '获得10点护盾，持续3回合', 2),
('铁壁防御', 2, 1, 0, 5, 'BUFF_DEFENSE', '本回合防御力+3', 1),
('抽牌术', 4, 1, 0, 0, 'DRAW', '抽取一张卡牌', 1),
('烈焰风暴', 1, 5, 12, 0, 'DAMAGE', '对敌方造成12点伤害', 3),
('生命源泉', 3, 4, 0, 15, 'HEAL', '恢复15点生命值', 3),
('绝对防御', 2, 3, 0, 20, 'SHIELD', '获得20点护盾，持续3回合', 3);

INSERT INTO player (username, password, nickname, level, exp, rank_id, rank_points) VALUES
('player1', 'password123', '玩家一号', 1, 0, 1, 0),
('player2', 'password123', '玩家二号', 1, 0, 1, 0);

CREATE TABLE IF NOT EXISTS season (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    description VARCHAR(200),
    start_time DATETIME,
    end_time DATETIME,
    status INT DEFAULT 0 COMMENT '0:未开始, 1:进行中, 2:已结束',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS season_reward (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    season_id INT NOT NULL,
    min_rank_id INT NOT NULL,
    max_rank_id INT NOT NULL,
    rank_name VARCHAR(20) NOT NULL,
    reward_type VARCHAR(20) NOT NULL COMMENT 'CARD, TITLE, AVATAR, COINS',
    reward_name VARCHAR(50) NOT NULL,
    reward_value INT DEFAULT 0,
    reward_description VARCHAR(200),
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_season_id (season_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS player_season_record (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    player_id BIGINT NOT NULL,
    season_id INT NOT NULL,
    highest_rank_id INT DEFAULT 1,
    highest_rank_points INT DEFAULT 0,
    final_rank_id INT DEFAULT 1,
    final_rank_points INT DEFAULT 0,
    wins INT DEFAULT 0,
    losses INT DEFAULT 0,
    draws INT DEFAULT 0,
    win_streak INT DEFAULT 0,
    max_win_streak INT DEFAULT 0,
    battle_count INT DEFAULT 0,
    rewards_claimed INT DEFAULT 0 COMMENT '0:未领取, 1:已领取',
    claim_time DATETIME,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_player_season (player_id, season_id),
    INDEX idx_player_id (player_id),
    INDEX idx_season_id (season_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO season (name, description, start_time, end_time, status) VALUES
('第一赛季 - 青铜启航', '卡牌对战第一赛季，欢迎大家参与！', NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY), 1);

INSERT INTO season_reward (season_id, min_rank_id, max_rank_id, rank_name, reward_type, reward_name, reward_value, reward_description) VALUES
(1, 7, 7, '王者', 'TITLE', '王者称号', 0, '第一赛季王者专属称号'),
(1, 6, 6, '大师', 'TITLE', '大师称号', 0, '第一赛季大师专属称号'),
(1, 5, 5, '钻石', 'TITLE', '钻石称号', 0, '第一赛季钻石专属称号'),
(1, 4, 4, '铂金', 'TITLE', '铂金称号', 0, '第一赛季铂金专属称号'),
(1, 3, 3, '黄金', 'TITLE', '黄金称号', 0, '第一赛季黄金专属称号'),
(1, 2, 2, '白银', 'TITLE', '白银称号', 0, '第一赛季白银专属称号'),
(1, 1, 1, '青铜', 'TITLE', '青铜称号', 0, '第一赛季青铜参与称号');
