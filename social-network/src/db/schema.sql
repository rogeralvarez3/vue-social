-- =========================================================
-- ESQUEMA DE BASE DE DATOS - RED SOCIAL
-- PostgreSQL
-- =========================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------
-- Funcion generica para actualizar updated_at automaticamente
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------
-- USUARIOS
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username      VARCHAR(30) UNIQUE NOT NULL,
  email         VARCHAR(150) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name     VARCHAR(120) NOT NULL,
  account_type  VARCHAR(20) NOT NULL DEFAULT 'personal', -- personal | negocio
  bio           VARCHAR(280) DEFAULT '',
  country       VARCHAR(100) DEFAULT NULL,
  city          VARCHAR(100) DEFAULT NULL,
  avatar_url    TEXT DEFAULT NULL,
  cover_url     TEXT DEFAULT NULL,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ DEFAULT NULL
);

-- Migracion segura para bases ya existentes (usuarios registrados antes de
-- pedir pais/ciudad/tipo de cuenta quedan con estos campos en NULL/default;
-- el feed trata la ciudad NULL como "todas las ciudades" hasta que completen su perfil).
ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_type VARCHAR(20) NOT NULL DEFAULT 'personal';

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_city ON users(city);

-- ---------------------------------------------------------
-- REFRESH TOKENS (login seguro con rotacion de tokens)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  user_agent  TEXT,
  ip_address  VARCHAR(64),
  revoked     BOOLEAN DEFAULT FALSE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens(user_id);

-- ---------------------------------------------------------
-- PUBLICACIONES (posts)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS posts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     TEXT DEFAULT '',
  media_url   TEXT DEFAULT NULL,
  media_type  VARCHAR(10) DEFAULT NULL, -- photo | video | audio
  privacy     VARCHAR(20) DEFAULT 'public', -- public | friends | private
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ DEFAULT NULL
);

-- Migracion segura para bases ya existentes: si venian con la columna vieja
-- "image_url" (solo fotos), se renombra a "media_url" y se agrega "media_type".
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'image_url')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'media_url') THEN
    ALTER TABLE posts RENAME COLUMN image_url TO media_url;
  END IF;
END $$;

ALTER TABLE posts ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS media_type VARCHAR(10);
-- Las publicaciones antiguas que ya tenian una imagen quedan marcadas como "photo"
UPDATE posts SET media_type = 'photo' WHERE media_url IS NOT NULL AND media_type IS NULL;

DROP TRIGGER IF EXISTS trg_posts_updated_at ON posts;
CREATE TRIGGER trg_posts_updated_at
BEFORE UPDATE ON posts
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);

-- ---------------------------------------------------------
-- COMENTARIOS
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS comments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id   UUID REFERENCES comments(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ DEFAULT NULL
);

-- Por si la tabla ya existia de una version anterior sin comentarios anidados
ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES comments(id) ON DELETE CASCADE;

DROP TRIGGER IF EXISTS trg_comments_updated_at ON comments;
CREATE TRIGGER trg_comments_updated_at
BEFORE UPDATE ON comments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);

-- ---------------------------------------------------------
-- LIKES (posts)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS likes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_likes_post ON likes(post_id);

-- ---------------------------------------------------------
-- AMISTADES
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS friendships (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status        VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | accepted | rejected | blocked
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  CHECK (requester_id <> addressee_id),
  UNIQUE (requester_id, addressee_id)
);

DROP TRIGGER IF EXISTS trg_friendships_updated_at ON friendships;
CREATE TRIGGER trg_friendships_updated_at
BEFORE UPDATE ON friendships
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_friend_requester ON friendships(requester_id);
CREATE INDEX IF NOT EXISTS idx_friend_addressee ON friendships(addressee_id);

-- ---------------------------------------------------------
-- MENSAJES PRIVADOS
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_pair ON messages(sender_id, receiver_id);

-- ---------------------------------------------------------
-- REACCIONES (tipo Facebook: like, love, haha, wow, sad, angry)
-- Sustituye/ampl\u00eda a los simples "likes": cada usuario tiene UNA reaccion
-- por publicacion, pero puede ser de distintos tipos.
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS reactions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        VARCHAR(20) NOT NULL DEFAULT 'like', -- like | love | haha | wow | sad | angry
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_reactions_post ON reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_reactions_created ON reactions(created_at);

-- ---------------------------------------------------------
-- GRUPOS
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS groups (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(120) NOT NULL,
  description TEXT DEFAULT '',
  cover_url   TEXT DEFAULT NULL,
  privacy     VARCHAR(20) NOT NULL DEFAULT 'public', -- public | private
  owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ DEFAULT NULL
);

DROP TRIGGER IF EXISTS trg_groups_updated_at ON groups;
CREATE TRIGGER trg_groups_updated_at
BEFORE UPDATE ON groups
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS group_members (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id    UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        VARCHAR(20) NOT NULL DEFAULT 'member', -- member | admin
  joined_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);

-- Las publicaciones pueden pertenecer a un grupo (si group_id es NULL, es del muro personal)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_posts_group ON posts(group_id);

-- ---------------------------------------------------------
-- MEDIOS: fotos, videos y audios (galeria del usuario)
-- Se alimenta tanto de subidas directas (secciones Fotos/Videos/Audios) como
-- de archivos adjuntados en una publicacion (post_id apunta a esa publicacion).
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS media (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id     UUID REFERENCES posts(id) ON DELETE CASCADE,
  type        VARCHAR(10) NOT NULL, -- photo | video | audio
  url         TEXT NOT NULL,
  caption     VARCHAR(280) DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ DEFAULT NULL
);

ALTER TABLE media ADD COLUMN IF NOT EXISTS post_id UUID REFERENCES posts(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_media_user ON media(user_id, type);
CREATE INDEX IF NOT EXISTS idx_media_post ON media(post_id);

-- ---------------------------------------------------------
-- DOCUMENTOS (archivos compartidos por el usuario)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS documents (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename    VARCHAR(255) NOT NULL,
  url         TEXT NOT NULL,
  mime_type   VARCHAR(120),
  size_bytes  BIGINT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);

-- ---------------------------------------------------------
-- NOTIFICACIONES (para tiempo real)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        VARCHAR(40) NOT NULL, -- like | comment | friend_request | friend_accept | message
  actor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  entity_id   UUID,
  data        JSONB DEFAULT '{}',
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
