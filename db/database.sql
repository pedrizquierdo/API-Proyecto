CREATE TABLE users (
    id_user INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    pronouns VARCHAR(20),
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('user', 'admin') DEFAULT 'user',
    avatar_url VARCHAR(255),
    bio TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE games (
    id_game INT PRIMARY KEY AUTO_INCREMENT,
    igdb_id INT NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    cover_url VARCHAR(255), 
    release_date DATE,
    developer VARCHAR(100),
    description TEXT,
    popularity DOUBLE DEFAULT 0, 
    is_trending BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE genres (
    id_genre INT PRIMARY KEY AUTO_INCREMENT,
    igdb_genre_id INT UNIQUE,
    name VARCHAR(50) NOT NULL
);

CREATE TABLE game_genres (
    id_game INT,
    id_genre INT,
    PRIMARY KEY (id_game, id_genre),
    FOREIGN KEY (id_game) REFERENCES games(id_game),
    FOREIGN KEY (id_genre) REFERENCES genres(id_genre)
);

CREATE TABLE user_games (
    id_activity INT PRIMARY KEY AUTO_INCREMENT,
    id_user INT NOT NULL,
    id_game INT NOT NULL,
    status ENUM('played', 'playing', 'plan_to_play', 'dropped') NOT NULL,
    is_favorite BOOLEAN DEFAULT FALSE,
    rating DECIMAL(3, 1),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (id_user) REFERENCES users(id_user),
    FOREIGN KEY (id_game) REFERENCES games(id_game),
    UNIQUE(id_user, id_game)
);

CREATE TABLE reviews (
    id_review INT PRIMARY KEY AUTO_INCREMENT,
    id_user INT NOT NULL,
    id_game INT NOT NULL,
    content TEXT NOT NULL,
    has_spoilers BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (id_user) REFERENCES users(id_user),
    FOREIGN KEY (id_game) REFERENCES games(id_game)
);

CREATE TABLE lists (
    id_list INT PRIMARY KEY AUTO_INCREMENT,
    id_user INT NOT NULL,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT TRUE,
    list_type ENUM('ranking', 'collection') DEFAULT 'collection', 
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (id_user) REFERENCES users(id_user)
);

CREATE TABLE list_items (
    id_item INT PRIMARY KEY AUTO_INCREMENT,
    id_list INT NOT NULL,
    id_game INT NOT NULL,
    position INT NOT NULL, 
    comment TEXT, 
    FOREIGN KEY (id_list) REFERENCES lists(id_list) ON DELETE CASCADE,
    FOREIGN KEY (id_game) REFERENCES games(id_game)
);

CREATE TABLE follows (
    follower_id INT NOT NULL, -- Quien sigue
    following_id INT NOT NULL, -- A quien siguen
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (follower_id, following_id),
    FOREIGN KEY (follower_id) REFERENCES users(id_user),
    FOREIGN KEY (following_id) REFERENCES users(id_user)
);

CREATE TABLE likes (
    id_like INT PRIMARY KEY AUTO_INCREMENT,
    id_user INT NOT NULL,
    id_review INT DEFAULT NULL,
    id_list INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_user) REFERENCES users(id_user),
    FOREIGN KEY (id_review) REFERENCES reviews(id_review) ON DELETE CASCADE,
    FOREIGN KEY (id_list) REFERENCES lists(id_list) ON DELETE CASCADE,
    CHECK (
        (id_review IS NOT NULL AND id_list IS NULL) OR 
        (id_review IS NULL AND id_list IS NOT NULL)
    ),
    UNIQUE(id_user, id_review, id_list)
);